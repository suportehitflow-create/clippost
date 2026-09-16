"""
clipost Backend — FastAPI
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import Request
from tasks import process_youtube_video, process_bulk_videos
from supabase import create_client
from services import upload_post
from services.stripe_service import (
    create_checkout_session, handle_webhook,
    get_plan_status, get_billing_portal_url,
)
from services.db_utils import maybe_one
from services.youtube_channel import resolve_channel, CanalNaoEncontrado
from services.downloader import fetch_video_info, get_playlist_videos

load_dotenv()

app = FastAPI(title="clipost API")

FRONTEND_ORIGINS = [
    "https://clippost-three.vercel.app",
    "http://localhost:3000",
    os.environ.get("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in FRONTEND_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
)


class ProcessRequest(BaseModel):
    url: str
    user_id: str
    clip_duration: str = "auto"  # "30", "60", "auto"
    project_id: str | None = None  # projeto já criado pela tela de upload


class BrandKitRequest(BaseModel):
    user_id: str
    avatar_url: str | None = None
    username: str | None = None
    layout_config: dict | None = None


class SchedulePostRequest(BaseModel):
    user_id: str
    clip_id: str
    platform: str  # tiktok | instagram | youtube_shorts
    caption: str
    scheduled_at: str  # ISO 8601


class ConnectRequest(BaseModel):
    user_id: str


class WatchRequest(BaseModel):
    user_id: str
    canal: str  # @handle, URL do canal ou ID UC...
    clip_duration: str = "auto"


SCHEDULE_PLATFORMS = {"tiktok", "instagram", "youtube_shorts"}


class SocialAccountRequest(BaseModel):
    user_id: str
    platform: str = "instagram"
    access_token: str
    account_id: str
    username: str | None = None


class CheckoutRequest(BaseModel):
    user_id: str
    email: str


class BulkProcessRequest(BaseModel):
    urls: list[str]
    user_id: str
    clip_duration: str = "auto"


class InstagramListRequest(BaseModel):
    username_or_url: str
    limit: int = 10
    sort_by: str = "recent"  # "recent" | "views"


@app.get("/api/brand-kit/{user_id}")
async def get_brand_kit(user_id: str):
    try:
        resp = maybe_one(supabase.table("brand_kits").select("*").eq("user_id", user_id))
        return {"brand_kit": resp.data}
    except Exception:
        return {"brand_kit": None}


@app.post("/api/brand-kit")
async def upsert_brand_kit(req: BrandKitRequest):
    existing = maybe_one(supabase.table("brand_kits").select("id").eq("user_id", req.user_id))
    data = {
        "user_id": req.user_id,
        **({"avatar_url": req.avatar_url} if req.avatar_url is not None else {}),
        **({"username": req.username} if req.username is not None else {}),
        **({"layout_config": req.layout_config} if req.layout_config is not None else {}),
    }
    if existing.data:
        supabase.table("brand_kits").update(data).eq("user_id", req.user_id).execute()
    else:
        supabase.table("brand_kits").insert(data).execute()
    result = maybe_one(supabase.table("brand_kits").select("*").eq("user_id", req.user_id))
    return {"brand_kit": result.data}


@app.get("/api/social-accounts/{user_id}")
async def list_social_accounts(user_id: str):
    resp = supabase.table("social_accounts").select("id,platform,username,account_id,created_at").eq("user_id", user_id).execute()
    return {"accounts": resp.data}


@app.post("/api/social-accounts")
async def upsert_social_account(req: SocialAccountRequest):
    existing = maybe_one(supabase.table("social_accounts").select("id").eq("user_id", req.user_id).eq("platform", req.platform).eq("account_id", req.account_id))
    data = {"user_id": req.user_id, "platform": req.platform, "access_token": req.access_token, "account_id": req.account_id, "username": req.username}
    if existing.data:
        supabase.table("social_accounts").update(data).eq("id", existing.data["id"]).execute()
        record_id = existing.data["id"]
    else:
        record_id = supabase.table("social_accounts").insert(data).execute().data[0]["id"]
    result = maybe_one(supabase.table("social_accounts").select("*").eq("id", record_id))
    return {"account": result.data}


@app.get("/api/scheduled-posts/{user_id}")
async def list_scheduled_posts(user_id: str):
    try:
        posts = (
            supabase.table("scheduled_posts")
            .select("*")
            .eq("user_id", user_id)
            .order("scheduled_at", desc=False)
            .execute()
        )
        rows = posts.data or []
        for row in rows:
            try:
                c = maybe_one(supabase.table("clips").select("title, storage_url").eq("id", row["clip_id"]))
                row["clips"] = c.data
            except Exception:
                row["clips"] = None
        return {"posts": rows}
    except Exception:
        return {"posts": []}


@app.post("/api/scheduled-posts")
async def create_scheduled_post(req: SchedulePostRequest):
    if req.platform not in SCHEDULE_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Plataforma inválida: {req.platform}")
    data = {
        "user_id": req.user_id,
        "clip_id": req.clip_id,
        "platform": req.platform,
        "caption": req.caption,
        "scheduled_at": req.scheduled_at,
        "status": "scheduled",
    }
    resp = supabase.table("scheduled_posts").insert(data).execute()
    return {"post": resp.data[0] if resp.data else None}


@app.delete("/api/scheduled-posts/{post_id}")
async def delete_scheduled_post(post_id: str):
    supabase.table("scheduled_posts").delete().eq("id", post_id).eq("status", "scheduled").execute()
    return {"deleted": True}


@app.get("/api/analytics/{user_id}")
async def get_analytics(user_id: str):
    try:
        from datetime import timedelta
        from collections import defaultdict
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()

        projects = supabase.table("projects").select("id, created_at").eq("user_id", user_id).execute()
        project_ids = [p["id"] for p in (projects.data or [])]

        total_clips = 0
        if project_ids:
            clips_resp = supabase.table("clips").select("id", count="exact").in_("project_id", project_ids).execute()
            total_clips = clips_resp.count or 0

        posts_data: list = []
        try:
            posts = supabase.table("scheduled_posts").select("status, created_at").eq("user_id", user_id).execute()
            posts_data = posts.data or []
        except Exception:
            pass

        published = sum(1 for p in posts_data if p["status"] == "published")
        failed = sum(1 for p in posts_data if p["status"] == "failed")
        pending = sum(1 for p in posts_data if p["status"] == "scheduled")
        total_finished = published + failed
        success_rate = round(published / total_finished * 100) if total_finished > 0 else 0

        recent_clips: list[dict] = []
        if project_ids:
            rc = supabase.table("clips").select("created_at").in_("project_id", project_ids).gte("created_at", seven_days_ago).execute()
            recent_clips = rc.data or []

        daily: dict[str, int] = defaultdict(int)
        for c in recent_clips:
            day = c["created_at"][:10]
            daily[day] += 1
        activity = [{"date": k, "clips": v} for k, v in sorted(daily.items())]

        return {
            "total_projects": len(projects.data or []),
            "total_clips": total_clips,
            "pending_posts": pending,
            "published_posts": published,
            "failed_posts": failed,
            "success_rate": success_rate,
            "activity_last_7_days": activity,
        }
    except Exception:
        return {
            "total_projects": 0, "total_clips": 0,
            "pending_posts": 0, "published_posts": 0,
            "failed_posts": 0, "success_rate": 0,
            "activity_last_7_days": [],
        }


@app.get("/api/billing/status/{user_id}")
async def billing_status(user_id: str):
    return get_plan_status(user_id)


@app.post("/api/billing/checkout")
async def billing_checkout(req: CheckoutRequest):
    url = create_checkout_session(req.user_id, req.email)
    return {"url": url}


@app.get("/api/billing/portal/{user_id}")
async def billing_portal(user_id: str):
    url = get_billing_portal_url(user_id)
    if not url:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura encontrada")
    return {"url": url}


@app.post("/api/billing/webhook")
async def billing_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        handle_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"received": True}


@app.post("/api/social/connect-url")
async def social_connect_url(req: ConnectRequest):
    try:
        return {"access_url": upload_post.connect_url(req.user_id)}
    except upload_post.UploadPostError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/social/accounts/{user_id}")
async def list_connected_social(user_id: str):
    if not os.environ.get("UPLOAD_POST_API_KEY"):
        return {"configured": False, "accounts": []}
    try:
        accounts = upload_post.connected_accounts(user_id)
    except upload_post.UploadPostError as e:
        raise HTTPException(status_code=502, detail=str(e))
    for a in accounts:
        if a["platform"] == "youtube":
            a["platform"] = "youtube_shorts"
    return {"configured": True, "accounts": accounts}


@app.post("/api/autopilot/watches")
async def criar_watch(req: WatchRequest):
    if req.clip_duration not in {"30", "60", "auto"}:
        raise HTTPException(status_code=400, detail=f"Duração inválida: {req.clip_duration}")
    try:
        info = resolve_channel(req.canal)
    except CanalNaoEncontrado as e:
        raise HTTPException(status_code=400, detail=str(e))

    ja_existe = (
        supabase.table("channel_watches").select("id")
        .eq("user_id", req.user_id).eq("channel_id", info["channel_id"])
        .execute().data
    )
    if ja_existe:
        raise HTTPException(status_code=409, detail="Esse canal já está sendo monitorado.")

    row = supabase.table("channel_watches").insert({
        "user_id": req.user_id,
        "channel_id": info["channel_id"],
        "channel_handle": req.canal.strip(),
        "channel_name": info["channel_name"],
        "baseline_video_id": info["baseline_video_id"],
        "clip_duration": req.clip_duration,
    }).execute().data[0]
    return {"watch": row, "ultimo_video": info["ultimo_video"]}


@app.get("/api/autopilot/watches/{user_id}")
async def listar_watches(user_id: str):
    resp = (
        supabase.table("channel_watches").select("*")
        .eq("user_id", user_id).order("created_at", desc=True).execute()
    )
    return {"watches": resp.data or []}


@app.delete("/api/autopilot/watches/{watch_id}")
async def remover_watch(watch_id: str):
    supabase.table("channel_watches").delete().eq("id", watch_id).execute()
    return {"deleted": True}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/process-url")
async def process_url(req: ProcessRequest):
    try:
        task = process_youtube_video.delay(req.url, req.user_id, req.clip_duration)
        return {"task_id": task.id, "status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Worker unavailable: {str(e)}")


@app.post("/api/process-bulk")
async def process_bulk(req: BulkProcessRequest):
    """Fila de processamento em massa — apenas Pro."""
    if not req.urls:
        raise HTTPException(status_code=400, detail="Nenhuma URL fornecida")
    if len(req.urls) > 20:
        raise HTTPException(status_code=400, detail="Máximo de 20 URLs por vez")
    task = process_bulk_videos.delay(req.urls, req.user_id, req.clip_duration)
    return {"task_id": task.id, "status": "queued", "count": len(req.urls)}


@app.post("/api/instagram/list")
async def instagram_list(req: InstagramListRequest):
    """Lista vídeos de um perfil público do Instagram."""
    try:
        from services.instagram_scraper import list_instagram_videos
        videos = list_instagram_videos(req.username_or_url, limit=req.limit, sort_by=req.sort_by)
        return {"videos": videos, "count": len(videos)}
    except Exception as e:
        return {"videos": [], "count": 0, "error": str(e)}


@app.post("/api/jobs")
async def create_job(req: ProcessRequest):
    """Alias de /api/process-url para compatibilidade."""
    try:
        task = process_youtube_video.delay(req.url, req.user_id, req.clip_duration, req.project_id)
        return {"task_id": task.id, "status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Worker unavailable: {str(e)}")


@app.get("/api/projects/{user_id}")
async def list_projects(user_id: str):
    try:
        resp = (
            supabase.table("projects")
            .select("id, title, source_url, platform, raw_video_url, status, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"projects": resp.data or []}
    except Exception:
        return {"projects": []}


@app.get("/api/clips/{project_id}")
async def list_clips(project_id: str):
    """Lista os clipes gerados para um projeto, ordenados por ai_score."""
    proj = maybe_one(supabase.table("projects").select("*").eq("id", project_id))
    if not proj.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    clips = (
        supabase.table("clips")
        .select("*")
        .eq("project_id", project_id)
        .order("score", desc=True)
        .execute()
    )
    return {
        "project": proj.data,
        "clips": clips.data,
    }


@app.get("/api/jobs/{project_id}")
async def get_job_status(project_id: str):
    """Status de um job pelo project_id."""
    proj = maybe_one(supabase.table("projects").select("*").eq("id", project_id))
    if not proj.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    clips = (
        supabase.table("clips")
        .select("*")
        .eq("project_id", project_id)
        .order("score", desc=True)
        .execute()
    )
    return {
        "project_id": project_id,
        "status": proj.data["status"],
        "title": proj.data.get("title"),
        "raw_video_url": proj.data.get("raw_video_url"),
        "clips": clips.data,
    }


class SourceInfoRequest(BaseModel):
    url: str


class PlaylistRequest(BaseModel):
    url: str
    limit: int = 50


@app.post("/api/sources/info")
async def source_info(req: SourceInfoRequest):
    """
    Retorna metadados de qualquer URL suportada pelo yt-dlp antes de criar o projeto.

    Algoritmo do ReClip: seleciona o melhor bitrate por resolução para cada
    qualidade disponível. Funciona para YouTube, TikTok, Instagram, Twitter/X,
    Twitch, Vimeo, Reddit e 1000+ outras plataformas.

    O frontend usa isso para mostrar thumbnail, duração e opções de qualidade
    antes de o usuário confirmar o processamento.
    """
    try:
        info = fetch_video_info(req.url)
        return info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar metadados: {str(e)}")


@app.post("/api/sources/playlist")
async def source_playlist(req: PlaylistRequest):
    """
    Lista vídeos de uma playlist, canal ou perfil sem baixar nenhum arquivo.

    Suporta: playlists do YouTube, canais (@handle/videos), perfis do TikTok,
    perfis do Instagram (público), etc.

    Retorna os vídeos ordenados por visualizações (mais viral primeiro).
    Limite máximo: 50 vídeos.
    """
    if req.limit > 50:
        req.limit = 50
    try:
        resultado = get_playlist_videos(req.url, limit=req.limit)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar playlist: {str(e)}")
