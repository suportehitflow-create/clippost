"""
clipost Backend — FastAPI
"""
import asyncio
import os
import re
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


_COOKIE_PLATFORMS = ("instagram", "facebook", "tiktok")


def _setup_platform_cookies():
    """INSTAGRAM_COOKIES_B64 / FACEBOOK_COOKIES_B64 / TIKTOK_COOKIES_B64 -> arquivo + <P>_COOKIES_FILE.
    Sem login, Instagram e Facebook só deixam listar poucos vídeos de um perfil."""
    import base64
    for platform in _COOKIE_PLATFORMS:
        b64 = os.environ.get(f"{platform.upper()}_COOKIES_B64")
        if not b64:
            continue
        path = f"/tmp/{platform}_cookies.txt"
        try:
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64))
            os.environ[f"{platform.upper()}_COOKIES_FILE"] = path
            print(f"[startup] cookies do {platform} carregados")
        except Exception as e:
            print(f"[startup] falha ao carregar cookies do {platform}: {e}")


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
                if ready and len(clips) > 0 and len(ready) == len(clips):
                    supabase.table("projects").update({"status": "done", "error_message": None}).eq("id", row["id"]).execute()
                    done_count += 1
                    print(f"[{label}] projeto {row['id'][:8]} -> done ({len(ready)}/{len(clips)} clips)")
                    continue
                elif ready:
                    msg = f"Processamento interrompido após {len(ready)}/{len(clips)} clipes prontos. Clique em Tentar Novamente."
                    supabase.table("projects").update({"status": "failed", "error_message": msg}).eq("id", row["id"]).execute()
                    failed_count += 1
                    print(f"[{label}] projeto {row['id'][:8]} -> failed ({len(ready)}/{len(clips)} clips prontos)")
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
    publicação dos posts agendados (60s) e Autopilot (a cada 5 min olha quais canais
    já passaram do intervalo escolhido pelo usuário, mínimo 15 min)."""
    import asyncio
    try:
        from tasks import check_channel_watches
        from workers.scheduler_tasks import check_and_publish_scheduled_posts
    except Exception as e:
        print(f"[scheduler] não iniciou: {e}")
        return
    print("[scheduler] agendador interno ativo (posts 60s, autopilot conforme intervalo do usuário)")
    last_autopilot = 0.0
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(check_and_publish_scheduled_posts)
        except Exception as e:
            print(f"[scheduler] posts agendados falharam: {e}")
        now = asyncio.get_event_loop().time()
        if now - last_autopilot >= 300:
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
    _setup_platform_cookies()
    _restore_cookies_from_storage()
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

def _restore_cookies_from_storage():
    """Restaura cookies salvos no Supabase Storage para /tmp na inicialização do servidor."""
    try:
        import os
        from pathlib import Path
        if not supabase:
            return
        for platform in ("instagram", "youtube", "tiktok", "facebook"):
            target_path = Path(f"/tmp/{platform}_cookies.txt")
            try:
                # bucket privado (o "videos" é público — cookies nunca ficam lá)
                raw_bytes = supabase.storage.from_("config-privado").download(f"{platform}_cookies.txt")
                if raw_bytes and len(raw_bytes) > 10:
                    target_path.write_bytes(raw_bytes)
                    os.environ[f"{platform.upper()}_COOKIES_FILE"] = str(target_path)
                    print(f"[startup] cookies do {platform} restaurados do Supabase Storage ({len(raw_bytes)} bytes)")
            except Exception:
                pass
    except Exception as e:
        print(f"[startup] aviso na restauração de cookies: {e}")



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
    canal: str  # YouTube: @handle, URL do canal ou ID UC... | Instagram/TikTok/Facebook: link do perfil
    clip_duration: str = "auto"
    auto_post: bool = False  # publicar sozinho os cortes de cada vídeo novo
    modo: str | None = None  # biblioteca | aprovar | auto (substitui o auto_post)


class WatchUpdateRequest(BaseModel):
    user_id: str
    auto_post: bool | None = None
    modo: str | None = None
    is_active: bool | None = None


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


_PREFIXO_PERFIL = {"instagram": "ig", "tiktok": "tt", "facebook": "fb"}


def _autopost_map(user_id: str) -> dict:
    from services.user_settings import get_settings
    return dict(get_settings(user_id).get("autopilot_autopost") or {})


def _salvar_autopost(user_id: str, watch_id: str, valor: bool) -> None:
    from services.user_settings import save_settings
    mapa = _autopost_map(user_id)
    mapa[watch_id] = bool(valor)
    save_settings(user_id, autopilot_autopost=mapa)


_MODOS_AUTOPILOT = {"biblioteca", "aprovar", "auto"}


def _salvar_modo(user_id: str, watch_id: str, modo: str) -> None:
    from services.user_settings import get_settings, save_settings
    s = get_settings(user_id)
    modos = dict(s.get("autopilot_modo") or {})
    modos[watch_id] = modo
    auto = dict(s.get("autopilot_autopost") or {})
    auto[watch_id] = modo == "auto"  # mantém o formato antigo em dia
    save_settings(user_id, autopilot_modo=modos, autopilot_autopost=auto)


@app.post("/api/autopilot/watches")
async def criar_watch(req: WatchRequest):
    if req.clip_duration not in {"30", "60", "90", "120", "auto"}:
        raise HTTPException(status_code=400, detail=f"Duração inválida: {req.clip_duration}")

    # Instagram / TikTok / Facebook: monitora o perfil pela listagem de vídeos (precisa dos
    # cookies da plataforma no servidor para o Instagram); YouTube continua pelo RSS do canal
    from services.downloader import profile_key, latest_profile_videos
    try:
        perfil = profile_key(req.canal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if perfil:
        plataforma, nome, url_perfil = perfil
        try:
            recentes = await asyncio.to_thread(latest_profile_videos, url_perfil, 3, req.user_id)
        except Exception as e:
            dica = " Conecte os cookies do Instagram em Edição em Massa → Baixar de um perfil." if plataforma == "instagram" else ""
            raise HTTPException(status_code=400, detail=f"Não consegui ler os vídeos desse perfil agora.{dica} ({str(e)[:160]})")
        info = {
            "channel_id": f"{_PREFIXO_PERFIL[plataforma]}:{nome.lower()}",
            "channel_name": f"@{nome}",
            "baseline_video_id": recentes[0]["key"] if recentes else None,
            "ultimo_video": ({"titulo": recentes[0].get("title") or "", "url": recentes[0]["url"]} if recentes else None),
            "handle": url_perfil,
        }
    else:
        try:
            info = resolve_channel(req.canal)
        except CanalNaoEncontrado as e:
            raise HTTPException(status_code=400, detail=str(e))
        info["handle"] = req.canal.strip()

    ja_existe = (
        supabase.table("channel_watches").select("id")
        .eq("user_id", req.user_id).eq("channel_id", info["channel_id"])
        .execute().data
    )
    if ja_existe:
        raise HTTPException(status_code=409, detail="Esse perfil/canal já está sendo monitorado.")

    row = supabase.table("channel_watches").insert({
        "user_id": req.user_id,
        "channel_id": info["channel_id"],
        "channel_handle": info["handle"],
        "channel_name": info["channel_name"],
        "baseline_video_id": info["baseline_video_id"],
        "clip_duration": req.clip_duration,
    }).execute().data[0]
    modo = req.modo if req.modo in _MODOS_AUTOPILOT else ("auto" if req.auto_post else "biblioteca")
    await asyncio.to_thread(_salvar_modo, req.user_id, row["id"], modo)
    row["auto_post"] = modo == "auto"
    row["modo"] = modo
    return {"watch": row, "ultimo_video": info["ultimo_video"]}


@app.get("/api/autopilot/watches/{user_id}")
async def listar_watches(user_id: str):
    resp = (
        supabase.table("channel_watches").select("*")
        .eq("user_id", user_id).order("created_at", desc=True).execute()
    )
    from services.user_settings import get_settings
    from tasks import modo_autopilot
    s = await asyncio.to_thread(get_settings, user_id)
    watches = []
    for w in resp.data or []:
        modo = modo_autopilot(user_id, w["id"], s)
        watches.append({**w, "modo": modo, "auto_post": modo == "auto"})
    return {"watches": watches}


@app.patch("/api/autopilot/watches/{watch_id}")
async def atualizar_watch(watch_id: str, req: WatchUpdateRequest):
    """Liga/desliga o monitoramento e o 'Postar automaticamente' de um canal/perfil."""
    dono = maybe_one(supabase.table("channel_watches").select("id").eq("id", watch_id).eq("user_id", req.user_id))
    if not dono or not dono.data:
        raise HTTPException(status_code=404, detail="Monitoramento não encontrado.")
    if req.is_active is not None:
        supabase.table("channel_watches").update({"is_active": req.is_active}).eq("id", watch_id).execute()
    if req.modo in _MODOS_AUTOPILOT:
        await asyncio.to_thread(_salvar_modo, req.user_id, watch_id, req.modo)
    elif req.auto_post is not None:
        await asyncio.to_thread(_salvar_modo, req.user_id, watch_id, "auto" if req.auto_post else "biblioteca")
    return {"ok": True}


class AprovacaoRequest(BaseModel):
    user_id: str
    clip_ids: list[str]
    acao: str  # aprovar | recusar
    legenda: str | None = None


def _dados_aprovacao(user_id: str) -> dict:
    """Cortes do Autopilot dos monitoramentos em 'Eu aprovo antes': aguardando, aprovados e recusados."""
    from services.user_settings import get_settings
    from tasks import modo_autopilot
    s = get_settings(user_id)
    recusados = set(s.get("autopilot_recusados") or [])
    watches = supabase.table("channel_watches").select("id, channel_name, channel_id").eq("user_id", user_id).execute().data or []
    aprovar = {w["id"]: w.get("channel_name") or w["channel_id"] for w in watches if modo_autopilot(user_id, w["id"], s) == "aprovar"}
    if not aprovar:
        return {"pendentes": [], "historico": [], "monitoramentos_aprovar": 0}
    origem = (
        supabase.table("autopilot_processed").select("project_id, watch_id")
        .eq("user_id", user_id).in_("watch_id", list(aprovar)).order("created_at", desc=True).limit(200).execute().data or []
    )
    canal_do_projeto = {o["project_id"]: aprovar.get(o["watch_id"], "") for o in origem if o.get("project_id")}
    if not canal_do_projeto:
        return {"pendentes": [], "historico": [], "monitoramentos_aprovar": len(aprovar)}
    cortes = (
        supabase.table("clips").select("id, title, hook, storage_url, score, created_at, project_id")
        .in_("project_id", list(canal_do_projeto)).eq("status", "ready").order("created_at", desc=True).limit(300).execute().data or []
    )
    posts = {}
    if cortes:
        for p in supabase.table("scheduled_posts").select("clip_id, status, scheduled_at").in_("clip_id", [c["id"] for c in cortes]).execute().data or []:
            posts.setdefault(p["clip_id"], p)
    pendentes, historico = [], []
    for c in cortes:
        item = {**c, "canal": canal_do_projeto.get(c["project_id"], "")}
        if c["id"] in posts:
            historico.append({**item, "decisao": "aprovado", "post_status": posts[c["id"]]["status"], "agendado_para": posts[c["id"]]["scheduled_at"]})
        elif c["id"] in recusados:
            historico.append({**item, "decisao": "recusado"})
        else:
            pendentes.append(item)
    pendentes.sort(key=lambda c: c.get("score") or 0, reverse=True)
    return {"pendentes": pendentes, "historico": historico[:80], "monitoramentos_aprovar": len(aprovar)}


@app.get("/api/autopilot/aprovacao/{user_id}")
async def autopilot_aprovacao(user_id: str):
    return await asyncio.to_thread(_dados_aprovacao, user_id)


@app.post("/api/autopilot/aprovacao")
async def autopilot_decidir(req: AprovacaoRequest):
    """Aprovar = agenda (um a cada 3h, depois da fila atual). Recusar = some da lista (fica no histórico)."""
    if req.acao not in ("aprovar", "recusar") or not req.clip_ids:
        raise HTTPException(status_code=400, detail="Ação inválida.")
    ids = list(dict.fromkeys(req.clip_ids))[:100]
    cortes = supabase.table("clips").select("id, title, hook, score").in_("id", ids).eq("user_id", req.user_id).execute().data or []
    if not cortes:
        raise HTTPException(status_code=404, detail="Cortes não encontrados.")
    if req.acao == "recusar":
        from services.user_settings import get_settings, save_settings
        s = await asyncio.to_thread(get_settings, req.user_id)
        lista = [i for i in (s.get("autopilot_recusados") or []) if i not in ids] + [c["id"] for c in cortes]
        await asyncio.to_thread(save_settings, req.user_id, autopilot_recusados=lista[-2000:])
        return {"recusados": len(cortes)}
    from tasks import agendar_cortes_autopilot
    ordem = {i: k for k, i in enumerate(ids)}
    cortes.sort(key=lambda c: ordem.get(c["id"], 0))
    criados = await asyncio.to_thread(agendar_cortes_autopilot, req.user_id, cortes, (req.legenda or "").strip() or None)
    if not criados:
        raise HTTPException(status_code=400, detail="Conecte uma conta em Ajustes para agendar.")
    return {"agendados": criados}


class AutopilotSettingsRequest(BaseModel):
    user_id: str
    interval_minutes: int


@app.get("/api/autopilot/settings/{user_id}")
async def autopilot_settings(user_id: str):
    from services.user_settings import AUTOPILOT_ALLOWED, autopilot_interval_minutes
    minutes = await asyncio.to_thread(autopilot_interval_minutes, user_id)
    return {"interval_minutes": minutes, "allowed": list(AUTOPILOT_ALLOWED)}


@app.post("/api/autopilot/settings")
async def salvar_autopilot_settings(req: AutopilotSettingsRequest):
    from services.user_settings import AUTOPILOT_ALLOWED, save_settings
    if req.interval_minutes not in AUTOPILOT_ALLOWED:
        raise HTTPException(status_code=400, detail="Intervalo inválido (mínimo 15 minutos).")
    await asyncio.to_thread(save_settings, req.user_id, autopilot_interval_minutes=req.interval_minutes)
    return {"interval_minutes": req.interval_minutes}


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


_BUCKET_PRIVADO = "config-privado"


def _storage_privado():
    """Bucket PRIVADO para segredos (cookies de login). O bucket "videos" é público: nunca usar para isso."""
    if supabase is None:
        return None
    try:
        nomes = {b.name for b in supabase.storage.list_buckets()}
        if _BUCKET_PRIVADO not in nomes:
            supabase.storage.create_bucket(_BUCKET_PRIVADO, options={"public": False})
    except Exception as e:
        print(f"[storage] bucket privado indisponível: {e}")
    return supabase.storage.from_(_BUCKET_PRIVADO)


async def _usuario_logado(request: Request):
    """Usuário do token de login (Bearer) validado no Supabase; 401 se não houver."""
    token = (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    if not token or supabase is None:
        raise HTTPException(status_code=401, detail="Faça login.")
    try:
        resp = await asyncio.to_thread(lambda: supabase.auth.get_user(token))
        user = resp.user
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    return user


async def _exigir_login(request: Request) -> str:
    """Login obrigatório; com ADMIN_EMAILS definido, só esses e-mails passam."""
    user = await _usuario_logado(request)
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    if admins and (user.email or "").lower() not in admins:
        raise HTTPException(status_code=403, detail="Só o administrador pode alterar os cookies do servidor.")
    return user.id


@app.post("/api/admin/set-instagram-cookies")
async def set_instagram_cookies(request: Request):
    """Carrega cookies do Instagram via HTTP e persiste no Storage PRIVADO. Exige login."""
    await _exigir_login(request)
    body = await request.json()
    cookies_raw = body.get("cookies", "") or body.get("cookies_b64", "")
    if not cookies_raw.strip():
        raise HTTPException(status_code=400, detail="cookies ou cookies_b64 é obrigatório")
    try:
        import base64
        if body.get("cookies_b64"):
            raw = base64.b64decode(cookies_raw).decode("utf-8", errors="replace")
        else:
            raw = cookies_raw
        cookies_path = "/tmp/instagram_cookies.txt"
        with open(cookies_path, "w", encoding="utf-8") as f:
            f.write(raw)
        os.environ["INSTAGRAM_COOKIES_FILE"] = cookies_path
        
        # Persiste no bucket PRIVADO para não perder ao reiniciar a máquina
        try:
            privado = _storage_privado()
            if privado:
                privado.upload(
                    "instagram_cookies.txt",
                    raw.encode("utf-8"),
                    file_options={"content-type": "text/plain", "upsert": "true"}
                )
                print(f"[admin] cookies do Instagram persistidos no Storage privado")
        except Exception as st_err:
            print(f"[admin] aviso ao persistir cookies no storage: {st_err}")

        return {"ok": True, "bytes_written": len(raw), "path": cookies_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"falha ao salvar cookies do Instagram: {e}")


@app.get("/api/instagram-oficial/status")
async def instagram_oficial_status(request: Request):
    """Se a API oficial (Business Discovery) está pronta para este usuário — sem expor o token."""
    user = await _usuario_logado(request)
    from services.instagram_oficial import credenciais
    cred = await asyncio.to_thread(credenciais, user.id)
    if not cred:
        return {"configurado": False}
    return {"configurado": True, "origem": cred["origem"], "usuario": cred.get("usuario")}


@app.post("/api/instagram-oficial")
async def instagram_oficial_salvar(request: Request):
    """Salva a credencial da API oficial (token de longa duração + ID da conta IG Business). Exige login."""
    await _exigir_login(request)
    body = await request.json()
    token = str(body.get("token") or "").strip()
    ig_id = str(body.get("ig_id") or "").strip()
    if not token or not ig_id.isdigit():
        raise HTTPException(status_code=400, detail="Informe o token e o ID numérico da conta Instagram Business.")
    from services.instagram_oficial import salvar, validar
    try:
        usuario = await asyncio.to_thread(validar, token, ig_id)
        await asyncio.to_thread(salvar, token, ig_id, usuario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[instagram-oficial] não salvou: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Não foi possível salvar agora.")
    return {"configurado": True, "usuario": usuario}


@app.delete("/api/instagram-oficial")
async def instagram_oficial_remover(request: Request):
    await _exigir_login(request)
    from services.instagram_oficial import remover
    await asyncio.to_thread(remover)
    return {"configurado": False}


@app.get("/api/admin/instagram-cookies-status")
async def instagram_cookies_status():
    """Verifica se cookies do Instagram estão carregados."""
    cookies_path = os.environ.get("INSTAGRAM_COOKIES_FILE", "/tmp/instagram_cookies.txt")
    import pathlib
    p = pathlib.Path(cookies_path)
    exists = p.exists()
    size = p.stat().st_size if exists else 0
    return {
        "cookies_file_exists": exists,
        "cookies_file_size_bytes": size,
        "cookies_path": cookies_path,
    }


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


@app.get("/api/admin/cookies-status")
async def cookies_status():
    """Quais plataformas têm cookies de login carregados (sem expor o conteúdo)."""
    status = {}
    for platform in ("youtube",) + _COOKIE_PLATFORMS:
        path = os.environ.get(f"{platform.upper()}_COOKIES_FILE") or ""
        status[platform] = bool(path) and os.path.exists(path) and os.path.getsize(path) > 0
    return status


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


@app.post("/api/tools/explorar")
async def ferramenta_explorar(request: Request):
    """Explorador de perfis. Corpo: { perfil, limite, ordem: recentes|curtidos|visualizados, periodo_dias }"""
    user = await _usuario_logado(request)
    body = await request.json()
    perfil = str(body.get("perfil") or "").strip()
    if not perfil:
        raise HTTPException(status_code=400, detail="Digite o @ ou cole o link do perfil.")
    from services.ferramentas import explorar_perfil
    try:
        return await asyncio.to_thread(
            explorar_perfil, perfil, int(body.get("limite") or 50), str(body.get("ordem") or "recentes"),
            int(body.get("periodo_dias") or 0), user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)[:400])
    except Exception as e:
        print(f"[explorar] falhou: {type(e).__name__}: {str(e)[:160]}")
        raise HTTPException(status_code=502, detail="Não consegui ler esse perfil agora.")


# ---- download assinado (o navegador baixa direto do backend, sem cabeçalho de login) ----
import base64 as _b64
import hashlib as _hashlib
import hmac as _hmac
import json as _json
import time as _time

_URL_PERMITIDA = re.compile(
    r"^https://([^/]*\.)?(cdninstagram\.com|fbcdn\.net|tiktokcdn[^/]*\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com)/",
    re.I,
)


def _chave_download() -> bytes:
    base = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or "clipost"
    return _hashlib.sha256(f"baixar:{base}".encode()).digest()


@app.post("/api/tools/baixar-link")
async def ferramenta_baixar_link(request: Request):
    """Gera um link de download assinado (15 min). Corpo: { itens: [{url, nome}] } — 1 item baixa o vídeo, vários viram .zip"""
    await _usuario_logado(request)
    body = await request.json()
    itens = [
        {"url": str(i.get("url") or ""), "nome": re.sub(r"[^\w\- ]+", "", str(i.get("nome") or "video"))[:60] or "video"}
        for i in (body.get("itens") or [])[:100]
    ]
    itens = [i for i in itens if _URL_PERMITIDA.match(i["url"])]
    if not itens:
        raise HTTPException(status_code=400, detail="Nenhum link de vídeo válido.")
    carga = _b64.urlsafe_b64encode(_json.dumps({"i": itens, "e": int(_time.time()) + 900}).encode()).decode()
    assinatura = _hmac.new(_chave_download(), carga.encode(), _hashlib.sha256).hexdigest()[:32]
    base = os.environ.get("PUBLIC_BACKEND_URL", "https://clippost-backend.fly.dev").rstrip("/")
    return {"url": f"{base}/api/tools/baixar/{carga}.{assinatura}"}


@app.get("/api/tools/baixar/{token}")
async def ferramenta_baixar(token: str):
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask
    import shutil
    import tempfile
    import zipfile
    from pathlib import Path

    carga, _, assinatura = token.rpartition(".")
    esperado = _hmac.new(_chave_download(), carga.encode(), _hashlib.sha256).hexdigest()[:32]
    if not carga or not _hmac.compare_digest(assinatura, esperado):
        raise HTTPException(status_code=403, detail="Link inválido.")
    dados = _json.loads(_b64.urlsafe_b64decode(carga.encode()))
    if dados.get("e", 0) < _time.time():
        raise HTTPException(status_code=410, detail="Link expirado. Gere de novo no Clipost.")
    itens = dados.get("i") or []

    tmp = Path(tempfile.mkdtemp(prefix="clippost_baixar_"))

    def _baixar_um(i: int, item: dict) -> Path | None:
        from bulk_tasks import _download
        pasta = tmp / f"item{i}"
        pasta.mkdir()
        try:
            caminho, _ = _download(item["url"], pasta)
            destino = tmp / f"{i + 1:02d} - {item['nome']}.mp4"
            shutil.move(caminho, destino)
            return destino
        except Exception as e:
            print(f"[baixar] item {i} falhou: {type(e).__name__}")
            return None

    arquivos = [p for p in [await asyncio.to_thread(_baixar_um, i, it) for i, it in enumerate(itens)] if p]
    if not arquivos:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(status_code=502, detail="Não consegui baixar os vídeos (os links podem ter expirado).")
    limpar = BackgroundTask(shutil.rmtree, tmp, True)
    if len(arquivos) == 1:
        return FileResponse(arquivos[0], media_type="video/mp4", filename=arquivos[0].name, background=limpar)
    zip_path = tmp / "clipost-videos.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:
        for a in arquivos:
            z.write(a, a.name)
    return FileResponse(zip_path, media_type="application/zip", filename="clipost-videos.zip", background=limpar)


@app.post("/api/tools/youtube-texto")
async def ferramenta_youtube_texto(request: Request):
    """Legenda de um vídeo do YouTube em texto/Markdown (base para roteiros). Corpo: { url }"""
    await _usuario_logado(request)
    body = await request.json()
    from services.ferramentas import youtube_para_texto
    try:
        return await asyncio.to_thread(youtube_para_texto, str(body.get("url") or "").strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[youtube-texto] falhou: {type(e).__name__}: {str(e)[:160]}")
        raise HTTPException(status_code=502, detail="Não consegui ler esse vídeo agora. Confira o link e tente de novo.")


@app.post("/api/tools/raio-x")
async def ferramenta_raio_x(request: Request):
    """Nota de desempenho de um perfil a partir dos vídeos recentes. Corpo: { perfil }"""
    await _usuario_logado(request)
    body = await request.json()
    perfil = str(body.get("perfil") or "").strip()
    if not perfil:
        raise HTTPException(status_code=400, detail="Cole o link do perfil ou canal.")
    from services.ferramentas import raio_x_perfil
    try:
        return await asyncio.to_thread(raio_x_perfil, perfil, 20)
    except ValueError as e:
        dica = " Para Instagram, conecte o Instagram no Autopilot." if "instagram" in perfil.lower() else ""
        raise HTTPException(status_code=400, detail=f"{str(e)[:200]}{dica}")
    except Exception as e:
        print(f"[raio-x] falhou: {type(e).__name__}: {str(e)[:160]}")
        raise HTTPException(status_code=502, detail="Não consegui analisar esse perfil agora.")


@app.post("/api/frases/gerar")
async def frases_gerar(request: Request):
    """Vídeos com frases: fotos × frases × música → MP4 9:16 prontos na Biblioteca.
    Corpo: { fotos: [url], frases: [str], modo: pares|todas, musica_url?, musica_inicio?, variar_trecho?,
             duracao?, arroba?, estilo: {fonte, tamanho, cor, contorno, cor_contorno, posicao, escurecer, maiusculas} }"""
    user = await _usuario_logado(request)
    body = await request.json()
    if not [f for f in body.get("frases") or [] if str(f).strip()]:
        raise HTTPException(status_code=400, detail="Escreva pelo menos uma frase.")
    from services import frases
    job_id = frases.iniciar(user.id, body, supabase)
    return {"job_id": job_id}


@app.get("/api/frases/{job_id}")
async def frases_status(job_id: str, request: Request):
    user = await _usuario_logado(request)
    from services import frases
    st = frases.status(job_id, user.id)
    if st is None:
        raise HTTPException(status_code=404, detail="Geração não encontrada (o servidor pode ter reiniciado).")
    return st


@app.post("/api/tools/raio-x-pagina")
async def ferramenta_raio_x_pagina(request: Request):
    """Painel da página (estilo Insights): KPIs, melhor horário, formato campeão, séries por dia,
    mapa dia×hora, top posts e evolução de seguidores. Corpo: { perfil, dias: 7|30|90|180 }"""
    user = await _usuario_logado(request)
    body = await request.json()
    perfil = str(body.get("perfil") or "").strip()
    if not perfil:
        raise HTTPException(status_code=400, detail="Escolha uma conta ou digite o @.")
    try:
        dias = int(body.get("dias") or 30)
    except (TypeError, ValueError):
        dias = 30
    from services.ferramentas import raio_x_pagina
    try:
        return await asyncio.to_thread(raio_x_pagina, perfil, dias, user.id, _storage_privado())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)[:200])
    except Exception as e:
        print(f"[raio-x-pagina] falhou: {type(e).__name__}: {str(e)[:160]}")
        raise HTTPException(status_code=502, detail="Não consegui ler essa página agora. Tente de novo em instantes.")


@app.post("/api/captions/generate")
async def gerar_legenda_post(request: Request):
    """3 opções de legenda + hashtags para um corte (usa o título e o que é falado nele).
    Corpo: { clip_id?, titulo?, plataforma?, tom? }"""
    user = await _usuario_logado(request)
    body = await request.json()
    titulo = str(body.get("titulo") or "")[:300]
    plataforma = str(body.get("plataforma") or "instagram")
    tom = str(body.get("tom") or "viral")
    transcricao = ""
    clip_id = body.get("clip_id")
    if clip_id:
        from services.legenda_post import texto_do_trecho
        clip = maybe_one(supabase.table("clips").select("title, hook, start_time, end_time, project_id, user_id").eq("id", clip_id))
        c = clip.data if clip else None
        if c and c.get("user_id") == user.id:
            titulo = titulo or c.get("hook") or c.get("title") or ""
            proj = maybe_one(supabase.table("projects").select("transcript").eq("id", c.get("project_id")))
            transcricao = texto_do_trecho((proj.data or {}).get("transcript") if proj else None,
                                          float(c.get("start_time") or 0), float(c.get("end_time") or 0))
    if not titulo and not transcricao:
        raise HTTPException(status_code=400, detail="Informe um título ou escolha um corte.")
    from services.legenda_post import gerar_legendas
    try:
        opcoes = await asyncio.to_thread(gerar_legendas, titulo, transcricao, plataforma, tom)
    except Exception as e:
        print(f"[legenda-post] falhou: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="A IA não conseguiu gerar agora. Tente de novo em instantes.")
    return {"opcoes": opcoes}


@app.post("/api/subtitles/ass")
async def gerar_legendas_ass(request: Request):
    """Legendas para o Editor em Massa: recebe o ÁUDIO já no tempo final do vídeo (cortado,
    sem silêncios e com a velocidade aplicada), transcreve (Groq Whisper, fallback Whisper local)
    e devolve o .ass no preset escolhido. Exige o token de login do usuário (Bearer)."""
    token = (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    if not token or supabase is None:
        raise HTTPException(status_code=401, detail="Faça login para gerar legendas.")
    try:
        user = await asyncio.to_thread(lambda: supabase.auth.get_user(token))
        if not getattr(user, "user", None):
            raise ValueError("sem usuário")
    except Exception:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")

    form = await request.form()
    arquivo = form.get("file")
    if arquivo is None or not hasattr(arquivo, "read"):
        raise HTTPException(status_code=400, detail="Envie o áudio no campo 'file'.")
    dados = await arquivo.read()
    if len(dados) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Áudio grande demais (máx. 25MB).")
    preset = str(form.get("preset") or "hormozi_yellow")
    font_family = str(form.get("font_family") or "") or None
    try:
        margin_v = max(10, min(1200, int(float(form.get("margin_v") or 120))))
    except ValueError:
        margin_v = 120

    import tempfile
    from pathlib import Path
    from tasks import transcribe_media
    from services.subtitle_generator import generate_ass

    def _rodar() -> tuple[str, int]:
        with tempfile.TemporaryDirectory(prefix="clippost_leg_") as tmp:
            entrada = Path(tmp) / "entrada.mp3"
            entrada.write_bytes(dados)
            tr = transcribe_media(str(entrada), str(Path(tmp) / "audio.mp3"))
            saida = generate_ass(
                tr.get("segments") or [], str(Path(tmp) / "legenda.ass"),
                words=tr.get("words") or None, margin_v=margin_v,
                subtitle_preset=preset, font_family=font_family,
            )
            return Path(saida).read_text(encoding="utf-8"), len(tr.get("words") or [])

    try:
        ass, palavras = await asyncio.to_thread(_rodar)
    except Exception as e:
        print(f"[legendas] falhou: {e}")
        raise HTTPException(status_code=500, detail=f"Não foi possível gerar as legendas: {e}")
    return {"ass": ass, "palavras": palavras}


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
    from services.downloader import list_profile_videos
    sort_map = {
        "most_viewed": "views",
        "most_liked": "likes",
        "engagement": "engagement",
        "recent": "date",
    }
    sort_by = sort_map.get(req.sort_by, "views")

    try:
        data = await asyncio.to_thread(list_profile_videos, req.profile, req.limit or 50, sort_by)
        videos = data.get("videos") or []
        items = []
        for i, v in enumerate(videos):
            items.append({
                "id": str(i + 1),
                "title": v.get("title") or f"Vídeo {i + 1}",
                "url": v["url"],
                "thumbnail": v.get("thumbnail"),
                "views": v.get("view_count") or 0,
                "likes": v.get("like_count") or 0,
                "duration": v.get("duration") or 30,
                "type": "reel",
            })

        clean_handle = req.profile.strip().lstrip("@").split("/")[-1]
        total_views = sum(it.get("views", 0) for it in items)
        total_likes = sum(it.get("likes", 0) for it in items)

        return {
            "profile": {
                "handle": clean_handle,
                "name": clean_handle.replace(".", " ").replace("_", " ").upper(),
                "followers": 0,
                "views_total": str(total_views),
                "likes_total": str(total_likes),
                "posts_count": len(items),
                "platform": data.get("platform", "instagram"),
            },
            "items": items,
        }
    except Exception as e:
        print(f"[sources/profile] erro ao listar perfil {req.profile}: {e}")
        raise HTTPException(
            status_code=404,
            detail=f"Não foi possível listar vídeos do perfil: {e}",
        )

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
