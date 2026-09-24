"""
clipost Backend — FastAPI
"""
import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import Request
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


def _setup_youtube_cookies():
    """Decodifica YOUTUBE_COOKIES_B64 (base64) para /tmp/yt_cookies.txt e seta YOUTUBE_COOKIES_FILE."""
    b64 = os.environ.get("YOUTUBE_COOKIES_B64")
    cookies_path = "/tmp/yt_cookies.txt"
    if not b64:
        if os.path.exists(cookies_path):
            os.environ["YOUTUBE_COOKIES_FILE"] = cookies_path
            print("[startup] cookies do YouTube encontrados em /tmp/yt_cookies.txt (sem YOUTUBE_COOKIES_B64)")
        else:
            print("[startup] YOUTUBE_COOKIES_B64 não definido — downloads do YouTube podem ser bloqueados por bot-detection")
        return
    try:
        import base64
        with open(cookies_path, "wb") as f:
            f.write(base64.b64decode(b64))
        os.environ["YOUTUBE_COOKIES_FILE"] = cookies_path
        print(f"[startup] cookies do YouTube carregados ({len(b64)} bytes b64) — bot-detection contornado")
    except Exception as e:
        print(f"[startup] falha ao carregar cookies do YouTube: {e}")


_STEP_MESSAGES = {
    "step:download": "YouTube bloqueou o download (detecção de bot). Tente novamente ou use outro vídeo.",
    "step:transcricao": "Falhou durante a transcrição do áudio. Tente com um vídeo mais curto.",
    "step:ia_curator": "Falhou durante a análise por IA. Serviço temporariamente indisponível.",
    "step:gerando_clipes": "Falhou durante a criação dos clipes. Tente novamente em alguns minutos.",
}


async def _mark_stuck_projects(label: str = "recovery"):
    """No startup: salva projetos processing que têm clips como done, resto como failed.
    Na recovery periódica: apenas marca projetos com >180min como failed."""
    try:
        if not supabase:
            return
        from datetime import timedelta
        is_startup = label == "startup"

        if is_startup:
            # No startup (após deploy), todos os projetos processing foram interrompidos
            result = supabase.table("projects") \
                .select("id, error_message, clips(id,storage_url)") \
                .eq("status", "processing") \
                .execute()
        else:
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=180)).isoformat()
            result = supabase.table("projects") \
                .select("id, error_message") \
                .eq("status", "processing") \
                .lt("created_at", cutoff) \
                .execute()

        rows = result.data or []
        done_count = 0
        failed_count = 0
        for row in rows:
            if is_startup:
                clips = row.get("clips") or []
                ready = [c for c in clips if c.get("storage_url")]
                if ready:
                    supabase.table("projects").update({"status": "done", "error_message": None}).eq("id", row["id"]).execute()
                    done_count += 1
                    print(f"[{label}] projeto {row['id'][:8]} -> done ({len(ready)} clips)")
                    continue
            step_key = (row.get("error_message") or "").strip()
            friendly = _STEP_MESSAGES.get(step_key, "Pipeline interrompido. Clique em Tentar Novamente.")
            supabase.table("projects").update({"status": "failed", "error_message": friendly}).eq("id", row["id"]).execute()
            failed_count += 1
        if rows:
            print(f"[{label}] {done_count} done + {failed_count} failed de {len(rows)} projetos travados")
    except Exception as e:
        print(f"[{label}] erro ao limpar projetos travados: {e}")


async def _cleanup_old_projects():
    """Apaga projetos e clipes: failed sem clips imediatamente + done/others há mais de 24h.
    Projetos failed COM clips prontos (storage_url) são resgatados como done."""
    try:
        if not supabase:
            return
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        cutoff_24h = (now - timedelta(hours=24)).isoformat()

        failed_res = supabase.table("projects").select("id").eq("status", "failed").execute()
        old_res = supabase.table("projects").select("id").lt("created_at", cutoff_24h).execute()

        failed_ids = {r["id"] for r in (failed_res.data or [])}
        old_ids = {r["id"] for r in (old_res.data or [])}

        # Salvar projetos failed que têm clips prontos
        saved = 0
        for pid in list(failed_ids):
            clips_res = supabase.table("clips").select("id, storage_url").eq("project_id", pid).execute()
            ready = [c for c in (clips_res.data or []) if c.get("storage_url")]
            if ready:
                supabase.table("projects").update({"status": "done"}).eq("id", pid).execute()
                failed_ids.discard(pid)
                saved += 1
                print(f"[cleanup] projeto {pid[:8]} resgatado: {len(ready)} clips prontos → done")

        ids_to_delete = list(failed_ids | old_ids)
        if not ids_to_delete:
            if saved:
                print(f"[cleanup] {saved} projeto(s) resgatados de failed para done")
            return

        deleted = 0
        for pid in ids_to_delete:
            try:
                supabase.table("clips").delete().eq("project_id", pid).execute()
                supabase.table("projects").delete().eq("id", pid).execute()
                deleted += 1
            except Exception as e:
                print(f"[cleanup] erro ao deletar projeto {pid}: {e}")

        if saved:
            print(f"[cleanup] {saved} projeto(s) resgatados de failed para done")
        if deleted:
            print(f"[cleanup] {deleted} projeto(s) antigos/falhos removidos")
    except Exception as e:
        print(f"[cleanup] erro: {e}")


async def _periodic_recovery_loop():
    """Roda a cada 5 minutos para marcar pipelines travados e limpar projetos antigos."""
    import asyncio
    while True:
        await asyncio.sleep(300)
        await _mark_stuck_projects("recovery")
        await _cleanup_old_projects()


def _sync_save_processing_projects():
    """Chamado pelo atexit: salva projetos 'processing' com clips como 'done'."""
    try:
        if not supabase:
            return
        res = supabase.table("projects").select("id").eq("status", "processing").execute()
        for row in (res.data or []):
            pid = row["id"]
            clips_res = supabase.table("clips").select("id, storage_url").eq("project_id", pid).execute()
            ready = [c for c in (clips_res.data or []) if c.get("storage_url")]
            new_status = "done" if ready else "failed"
            msg = None if ready else "Pipeline interrompido por deploy. Clique em Tentar Novamente."
            supabase.table("projects").update({"status": new_status, "error_message": msg}).eq("id", pid).execute()
            print(f"[shutdown] projeto {pid[:8]} -> {new_status} ({len(ready)} clips)")
    except Exception as e:
        print(f"[shutdown] erro: {e}")


import atexit
atexit.register(_sync_save_processing_projects)

from job_tracker import run_tracked as _run_tracked, snapshot as _active_jobs_snapshot


async def _in_process_scheduler():
    """Sem worker/beat do Celery no Fly, as tarefas periódicas rodam aqui mesmo:
    publicação dos posts agendados (60s) e checagem de canais do Autopilot (15 min)."""
    import asyncio
    try:
        from tasks import check_channel_watches
        from workers.scheduler_tasks import check_and_publish_scheduled_posts
    except Exception as e:
        print(f"[scheduler] não iniciou: {e}")
        return
    print("[scheduler] agendador interno ativo (posts 60s, autopilot 15min)")
    last_autopilot = 0.0
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(check_and_publish_scheduled_posts)
        except Exception as e:
            print(f"[scheduler] posts agendados falharam: {e}")
        now = asyncio.get_event_loop().time()
        if now - last_autopilot >= 900:
            last_autopilot = now
            try:
                result = await asyncio.to_thread(check_channel_watches)
                if result and result.get("novos"):
                    print(f"[autopilot] {result['novos']} vídeo(s) novo(s) enfileirado(s)")
            except Exception as e:
                print(f"[autopilot] checagem falhou: {e}")


@app.on_event("startup")
async def recover_stuck_projects():
    import asyncio
    _setup_youtube_cookies()
    await _mark_stuck_projects("startup")
    await _cleanup_old_projects()
    asyncio.create_task(_periodic_recovery_loop())
    if os.getenv("CELERY_ENABLED", "false").lower() != "true":
        asyncio.create_task(_in_process_scheduler())
    try:
        from bulk_tasks import resume_pending_batches
        from job_tracker import enqueue
        await asyncio.to_thread(resume_pending_batches, enqueue)
    except Exception as e:
        print(f"[startup] retomada de lotes falhou: {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}

# Lista explícita de origens permitidas
ALLOWED_ORIGINS = [
    "https://clippost-three.vercel.app",
    "https://clippost-silk.vercel.app",
    "https://clippost.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.options("/{full_path:path}")
async def preflight_handler(full_path: str, request: Request):
    origin = request.headers.get("origin", "https://clippost-three.vercel.app")
    return JSONResponse(
        content={"status": "ok"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        },
    )

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or "https://alntulecjshpbrhesaoo.supabase.co"
)
SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None


class ProcessRequest(BaseModel):
    url: str
    user_id: str
    clip_duration: str = "auto"  # "30", "60", "90", "120", "auto"
    project_id: str | None = None
    remove_silence: bool = False  # default False para evitar drift acústico de PTS
    template_config: dict | None = None


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


SCHEDULE_PLATFORMS = {"tiktok", "instagram", "youtube_shorts", "facebook"}


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
async def get_billing_status(user_id: str):
    try:
        res = supabase.table("user_plans").select("*").eq("user_id", user_id).execute()
        plan = res.data[0] if res.data else {"plan": "free", "clips_used_this_month": 0, "clips_limit": 5}
        return {"status": "ok", "plan": plan}
    except Exception as e:
        return {"status": "ok", "plan": {"plan": "free", "clips_used_this_month": 0, "clips_limit": 5}}


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
    if req.clip_duration not in {"30", "60", "90", "120", "auto"}:
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


@app.post("/api/process-url")
async def process_url(req: ProcessRequest, background_tasks: BackgroundTasks):
    from tasks import process_youtube_video
    if CELERY_ENABLED:
        try:
            task = process_youtube_video.apply_async(args=[req.url, req.user_id, req.clip_duration, req.project_id, req.remove_silence, req.template_config])
            return {"task_id": task.id, "status": "processing"}
        except Exception as e:
            print(f"[process-url] Celery falhou ({e}), usando BackgroundTasks")
    background_tasks.add_task(_run_tracked, "process", process_youtube_video, req.url, req.user_id, req.clip_duration, req.project_id, req.remove_silence, req.template_config)
    return {"task_id": "bg_process", "status": "processing"}


@app.post("/api/process-bulk")
async def process_bulk(req: BulkProcessRequest, background_tasks: BackgroundTasks):
    from tasks import process_bulk_videos, process_youtube_video
    """Fila de processamento em massa — apenas Pro."""
    if not req.urls:
        raise HTTPException(status_code=400, detail="Nenhuma URL fornecida")
    if len(req.urls) > 20:
        raise HTTPException(status_code=400, detail="Máximo de 20 URLs por vez")
    if CELERY_ENABLED:
        try:
            task = process_bulk_videos.delay(req.urls, req.user_id, req.clip_duration)
            return {"task_id": task.id, "status": "queued", "count": len(req.urls)}
        except Exception as e:
            print(f"[bulk] Celery falhou ({e}), usando BackgroundTasks")
    for url in req.urls:
        background_tasks.add_task(_run_tracked, "bulk", process_youtube_video, url, req.user_id, req.clip_duration, None, False, None)
    return {"task_id": "bg_bulk", "status": "queued", "count": len(req.urls)}


@app.post("/api/instagram/list")
async def instagram_list(req: InstagramListRequest):
    """Lista vídeos de um perfil público do Instagram."""
    try:
        from services.instagram_scraper import list_instagram_videos
        videos = list_instagram_videos(req.username_or_url, limit=req.limit, sort_by=req.sort_by)
        return {"videos": videos, "count": len(videos)}
    except Exception as e:
        return {"videos": [], "count": 0, "error": str(e)}


CELERY_ENABLED = os.getenv("CELERY_ENABLED", "false").lower() == "true"


@app.post("/api/jobs")
async def create_job(req: ProcessRequest, background_tasks: BackgroundTasks):
    from tasks import process_youtube_video
    """Dispara processamento: Celery se CELERY_ENABLED=true, senão BackgroundTasks."""
    if req.project_id:
        try:
            supabase.table("projects").update({"status": "processing"}).eq("id", req.project_id).execute()
        except Exception:
            pass

    if CELERY_ENABLED:
        try:
            task = process_youtube_video.apply_async(
                args=[req.url, req.user_id, req.clip_duration, req.project_id, req.remove_silence, req.template_config],
            )
            print(f"[jobs] Tarefa enfileirada no Celery: {task.id}")
            return {"task_id": task.id, "status": "processing"}
        except Exception as e:
            print(f"[jobs] Celery falhou ({e}), usando BackgroundTasks")

    background_tasks.add_task(
        _run_tracked, "process", process_youtube_video,
        req.url, req.user_id, req.clip_duration,
        req.project_id, req.remove_silence, req.template_config,
    )
    print(f"[jobs] BackgroundTask iniciada para projeto {req.project_id}")
    return {"task_id": f"bg_{req.project_id or 'local'}", "status": "processing"}


class BulkStartRequest(BaseModel):
    user_id: str
    source: str  # "profile" | "files"
    profile_url: str | None = None
    limit: int = 0  # 0 = todos os vídeos do perfil
    sort_by: str = "views"  # views | likes | engagement | date
    videos: list[dict] = []  # [{url, title}] quando source == "files"
    template_config: dict | None = None
    options: dict = {}


@app.post("/api/bulk/start")
async def bulk_start(req: BulkStartRequest, background_tasks: BackgroundTasks):
    """Edição em massa: aplica o template em cada vídeo inteiro de um perfil ou dos arquivos enviados."""
    from bulk_tasks import create_batch, run_batch
    if req.source == "profile" and not (req.profile_url or "").strip():
        raise HTTPException(status_code=400, detail="Informe o link do perfil.")
    if req.source == "files" and not req.videos:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")
    if req.source not in ("profile", "files"):
        raise HTTPException(status_code=400, detail="Fonte inválida.")
    payload = req.model_dump()
    batch_id = create_batch(req.user_id, payload)
    background_tasks.add_task(_run_tracked, "bulk", run_batch, batch_id, payload)
    return {"batch_id": batch_id, "status": "started"}


@app.get("/api/bulk/{batch_id}")
async def bulk_status(batch_id: str, user_id: str):
    from bulk_tasks import get_batch
    batch = get_batch(batch_id)
    if not batch or batch["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Lote não encontrado (o servidor pode ter reiniciado).")
    return batch


@app.get("/api/admin/active-jobs")
async def active_jobs():
    """Quantos cortes estão rodando agora — usado pelo deploy.ps1 antes de publicar."""
    jobs = _active_jobs_snapshot()
    return {"active": len(jobs), "jobs": jobs}


@app.post("/api/admin/set-youtube-cookies")
async def set_youtube_cookies(request: Request):
    """Carrega cookies do YouTube via HTTP (contorna limitação de injeção de secrets do Fly.io)."""
    admin_key = os.environ.get("ADMIN_SECRET", "")
    if not admin_key or request.headers.get("X-Admin-Token") != admin_key:
        raise HTTPException(status_code=403, detail="admin token inválido")
    body = await request.json()
    cookies_b64 = body.get("cookies_b64", "").strip()
    if not cookies_b64:
        raise HTTPException(status_code=400, detail="cookies_b64 é obrigatório")
    try:
        import base64
        cookies_path = "/tmp/yt_cookies.txt"
        with open(cookies_path, "wb") as f:
            f.write(base64.b64decode(cookies_b64))
        os.environ["YOUTUBE_COOKIES_FILE"] = cookies_path
        os.environ["YOUTUBE_COOKIES_B64"] = cookies_b64
        lines = cookies_b64.count("youtube") + cookies_b64.count("google")
        print(f"[admin] cookies do YouTube atualizados via HTTP — {len(cookies_b64)} chars b64")
        return {"ok": True, "bytes_written": len(base64.b64decode(cookies_b64)), "path": cookies_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"falha ao salvar cookies: {e}")


@app.get("/api/admin/youtube-cookies-status")
async def youtube_cookies_status():
    """Verifica se cookies do YouTube estão carregados (sem expor o conteúdo)."""
    cookies_path = os.environ.get("YOUTUBE_COOKIES_FILE", "/tmp/yt_cookies.txt")
    import pathlib
    p = pathlib.Path(cookies_path)
    exists = p.exists()
    size = p.stat().st_size if exists else 0
    b64_set = bool(os.environ.get("YOUTUBE_COOKIES_B64"))
    return {
        "cookies_file_exists": exists,
        "cookies_file_size_bytes": size,
        "youtube_cookies_b64_in_env": b64_set,
        "cookies_path": cookies_path,
    }


@app.delete("/api/admin/test-projects")
async def delete_test_projects(user_id: str, video_id: str):
    """Remove projetos e clips de um vídeo específico para re-teste."""
    projs = supabase.table("projects").select("id").eq("user_id", user_id).like("source_url", f"%{video_id}%").execute()
    deleted = 0
    for p in (projs.data or []):
        supabase.table("clips").delete().eq("project_id", p["id"]).execute()
        supabase.table("projects").delete().eq("id", p["id"]).execute()
        deleted += 1
    return {"deleted": deleted, "video_id": video_id}


@app.post("/api/admin/force-done/{project_id}")
async def force_done_project(project_id: str):
    """Força projeto para status=done se tiver clipes prontos, ou failed caso contrário."""
    if not supabase:
        raise HTTPException(status_code=503, detail="supabase indisponível")
    clips_res = supabase.table("clips").select("id, storage_url").eq("project_id", project_id).execute()
    clips = clips_res.data or []
    ready = [c for c in clips if c.get("storage_url")]
    new_status = "done" if ready else "failed"
    supabase.table("projects").update({"status": new_status, "error_message": None}).eq("id", project_id).execute()
    return {"project_id": project_id, "status": new_status, "clips_ready": len(ready)}


@app.get("/api/projects/{user_id}")
async def list_projects(user_id: str):
    try:
        resp = (
            supabase.table("projects")
            .select("id, title, source_url, platform, raw_video_url, status, created_at, clips(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"projects": resp.data or []}
    except Exception as e:
        print(f"[projects] erro ao buscar projetos do usuario {user_id}: {e}")
        return {"projects": []}


class RerenderRequest(BaseModel):
    subtitle_preset: str = "hormozi_yellow"
    subtitle_y: float = 80.0
    words: list[dict] | None = None


@app.post("/api/clips/{clip_id}/re-render")
async def rerender_clip(clip_id: str, req: RerenderRequest, background_tasks: BackgroundTasks):
    """Atualiza estilo/palavras e re-renderiza o clipe com FFmpeg."""
    clip_res = maybe_one(supabase.table("clips").select("*").eq("id", clip_id))
    if not clip_res.data:
        raise HTTPException(status_code=404, detail="Clipe não encontrado")

    clip = clip_res.data

    try:
        supabase.table("clips").update({"status": "processing"}).eq("id", clip_id).execute()
    except Exception as e:
        print(f"[re-render] erro ao atualizar status do clip: {e}")

    from tasks import rerender_clip_task
    if CELERY_ENABLED:
        try:
            rerender_clip_task.delay(clip_id, req.subtitle_preset, req.subtitle_y, req.words)
            return {"status": "queued", "clip_id": clip_id}
        except Exception as e:
            print(f"[re-render] Celery falhou ({e}), usando BackgroundTasks")

    background_tasks.add_task(_run_tracked, "rerender", rerender_clip_task, clip_id, req.subtitle_preset, req.subtitle_y, req.words)
    return {"status": "rerendering", "clip_id": clip_id}


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


class ProfileScrapeRequest(BaseModel):
    profile: str
    limit: int = 50
    sort_by: str = "most_viewed"


@app.post("/api/sources/profile")
async def scrape_profile_reels(req: ProfileScrapeRequest):
    """
    Mineracao de reels/videos de perfis publicos (Instagram, TikTok, YouTube).
    Permite filtrar por mais visualizados, mais curtidos e ordenar em lote.
    """
    import subprocess
    import json

    handle = req.profile.strip().lstrip("@")
    if "/" in handle:
        parts = [p for p in handle.split("/") if p]
        handle = parts[-1] if parts else handle

    clean_handle = handle.replace("https://", "").replace("http://", "").replace("www.instagram.com/", "").replace("instagram.com/", "").split("?")[0].strip("/")

    items = []
    try:
        url = f"https://www.instagram.com/{clean_handle}/reels/"
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--playlist-end", str(min(req.limit or 50, 60)),
            "--no-warnings",
            "--quiet",
            url
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
        if proc.returncode == 0 and proc.stdout.strip():
            for line in proc.stdout.strip().split("\n"):
                if line:
                    try:
                        data = json.loads(line)
                        items.append({
                            "id": data.get("id") or str(len(items) + 1),
                            "title": data.get("title") or f"Reel de @{clean_handle}",
                            "url": data.get("url") or data.get("webpage_url") or f"https://www.instagram.com/reel/{data.get('id')}/",
                            "thumbnail": data.get("thumbnail") or (data.get("thumbnails", [{}])[-1].get("url") if data.get("thumbnails") else None),
                            "views": data.get("view_count") or 0,
                            "likes": data.get("like_count") or 0,
                            "duration": data.get("duration") or 30,
                            "type": "reel"
                        })
                    except Exception:
                        continue
    except Exception as e:
        print(f"Scrape attempt error: {e}")

    if not items:
        raise HTTPException(
            status_code=404,
            detail=f"Não foi possível listar vídeos do perfil @{clean_handle}. "
                   "O Instagram bloqueia scraping automatizado. "
                   "Tente colar a URL diretamente de um Reel específico."
        )

    if req.sort_by == "most_viewed":
        items.sort(key=lambda x: x.get("views", 0), reverse=True)
    elif req.sort_by == "most_liked":
        items.sort(key=lambda x: x.get("likes", 0), reverse=True)

    total_views = sum(it.get("views", 0) for it in items)
    total_likes = sum(it.get("likes", 0) for it in items)

    return {
        "profile": {
            "handle": clean_handle,
            "name": clean_handle.replace(".", " ").replace("_", " ").upper(),
            "followers": 38400,
            "views_total": str(total_views),
            "likes_total": str(total_likes),
            "posts_count": len(items),
            "avatar_url": f"https://api.dicebear.com/7.x/bottts/svg?seed={clean_handle}",
        },
        "items": items,
    }

# ==========================================
# Rotas: Radar de Tendências & Creator Studio
# ==========================================
from services.trends_service import get_trend_categories, explore_trends
from services.creator_service import get_creator_templates, generate_ai_script

@app.get("/api/trends/categories")
async def api_trend_categories():
    return {"categories": get_trend_categories()}

@app.get("/api/trends/explore")
async def api_explore_trends(category: str = "all", query: str = ""):
    return {"items": explore_trends(category=category, query=query)}

class ScriptRequest(BaseModel):
    topic: str
    template_id: str = "hormozi"
    tone: str = "Direto e enérgico"
    duration_secs: int = 45
    target_audience: str = "Empreendedores e Criadores"

@app.get("/api/creator/templates")
async def api_creator_templates():
    return {"templates": get_creator_templates()}

@app.post("/api/creator/generate-script")
async def api_generate_script(req: ScriptRequest):
    return generate_ai_script(
        topic=req.topic,
        template_id=req.template_id,
        tone=req.tone,
        duration_secs=req.duration_secs,
        target_audience=req.target_audience
    )
