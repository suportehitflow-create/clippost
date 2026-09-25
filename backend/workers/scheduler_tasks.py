"""
Celery Beat Task — publica os posts agendados que já venceram.

Roda a cada 60s (beat_schedule em celery_app.py). Para plataformas Meta
(instagram e facebook), usa os tokens da tabela social_accounts. Para
TikTok e YouTube, delega ao Upload-Post via publish_video().
"""
import os
from datetime import datetime, timezone

from celery_app import celery
from supabase import create_client, Client
from dotenv import load_dotenv
from services.upload_post import publish_video, UploadPostError
from services.social_publisher import publish_reel, publish_facebook_page, InstagramPublishError
from services.db_utils import maybe_one

load_dotenv()

_SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or "https://alntulecjshpbrhesaoo.supabase.co"
)
_SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
try:
    supabase: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
except Exception:
    supabase = None

# Plataformas gerenciadas via Upload-Post
UPLOAD_POST_PLATFORMS = {"tiktok", "youtube_shorts", "youtube"}
# Plataformas com tokens diretos na tabela social_accounts
META_PLATFORMS = {"instagram", "facebook"}


def _get_meta_token(user_id: str, platform: str, social_account_id: str | None) -> dict | None:
    """Retorna a conta social com page_token para publicação Meta."""
    try:
        # page_token não existe no banco de produção: o token da página fica em access_token
        q = supabase.table("social_accounts").select("account_id, access_token")
        if social_account_id:
            q = q.eq("id", social_account_id)
        else:
            # sem conta específica: a primeira conta daquela plataforma (não existe is_active no banco)
            q = q.eq("user_id", user_id).eq("platform", platform).limit(1)
        res = maybe_one(q)
        return res.data
    except Exception:
        return None


def _quebras_seguras(caption: str) -> str:
    """Instagram/TikTok/Facebook juntam linhas em branco e cortam espaços no fim de linha:
    tira os espaços finais e troca cada linha vazia por um caractere invisível (U+2800),
    assim o espaçamento que a pessoa escreveu aparece igual no post."""
    linhas = [l.rstrip() for l in (caption or "").replace("\r\n", "\n").split("\n")]
    while linhas and not linhas[-1]:
        linhas.pop()
    return "\n".join(l if l else "⠀" for l in linhas)


def _finish(post_id: str, status: str, detail: str) -> None:
    campos = {"status": status}
    # motivo da falha / data de publicação aparecem no Calendário & Publicações
    if status == "failed":
        campos["error_message"] = (detail or "")[:900]
    elif status == "published":
        campos["published_at"] = datetime.now(timezone.utc).isoformat()
        campos["error_message"] = None
    try:
        supabase.table("scheduled_posts").update(campos).eq("id", post_id).execute()
    except Exception:
        # banco sem as colunas extras: grava ao menos o status
        supabase.table("scheduled_posts").update({"status": status}).eq("id", post_id).execute()
    print(f"[scheduler] post {post_id} -> {status}: {detail}")


@celery.task(name="check_and_publish_scheduled_posts")
def check_and_publish_scheduled_posts():
    now_iso = datetime.now(timezone.utc).isoformat()
    due = (
        supabase.table("scheduled_posts")
        .select("id, user_id, clip_id, platform, caption, social_account_id")
        .eq("status", "scheduled")
        .lte("scheduled_at", now_iso)
        .execute()
    )
    if not due.data:
        return {"published": 0, "failed": 0}

    published = failed = 0
    for post in due.data:
        platform = post["platform"]
        clip = maybe_one(supabase.table("clips").select("storage_url, title").eq("id", post["clip_id"]))
        clip_data = (clip.data if clip else None) or {}
        video_url = clip_data.get("storage_url")
        caption = post.get("caption") or clip_data.get("title") or ""
        if platform in ("instagram", "facebook", "tiktok"):
            caption = _quebras_seguras(caption)

        if not video_url:
            _finish(post["id"], "failed", "clipe sem video_url")
            failed += 1
            continue

        try:
            # Instagram conectado pelo Upload-Post (sem token da Meta na tabela) publica pelo Upload-Post
            meta_account = _get_meta_token(post["user_id"], platform, post.get("social_account_id")) if platform in META_PLATFORMS else None
            if platform == "instagram" and not (meta_account and (meta_account.get("page_token") or meta_account.get("access_token"))):
                result = publish_video(
                    user_id=post["user_id"],
                    platform="instagram",
                    video_url=video_url,
                    caption=caption,
                    title=clip_data.get("title") or "",
                    post_id=post["id"],
                )
                _finish(post["id"], "published", result.get("url", ""))
            elif platform in META_PLATFORMS:
                # Usa token direto da tabela social_accounts (conexão pela Meta)
                account = meta_account
                if not account:
                    raise Exception(f"Nenhuma conta {platform} conectada ou sem token para o usuário.")
                token = account.get("page_token") or account.get("access_token")
                acc_id = account.get("account_id")
                if not token or not acc_id:
                    raise Exception(f"Token ou account_id ausente para {platform}.")
                if platform == "instagram":
                    result = publish_reel(
                        account_id=acc_id,
                        access_token=token,
                        video_url=video_url,
                        caption=caption,
                    )
                    _finish(post["id"], "published", result.get("permalink", ""))
                elif platform == "facebook":
                    result = publish_facebook_page(
                        page_id=acc_id,
                        page_token=token,
                        video_url=video_url,
                        caption=caption,
                        title=clip_data.get("title") or "",
                    )
                    _finish(post["id"], "published", result.get("permalink", ""))

            elif platform in UPLOAD_POST_PLATFORMS:
                up_platform = "youtube" if platform == "youtube_shorts" else platform
                result = publish_video(
                    user_id=post["user_id"],
                    platform=up_platform,
                    video_url=video_url,
                    caption=caption,
                    title=clip_data.get("title") or "",
                    post_id=post["id"],
                )
                _finish(post["id"], "published", result.get("url", ""))

            else:
                _finish(post["id"], "failed", f"plataforma '{platform}' sem suporte")
                failed += 1
                continue

            published += 1

        except (InstagramPublishError, UploadPostError) as e:
            _finish(post["id"], "failed", str(e)[:500])
            failed += 1
        except Exception as e:
            _finish(post["id"], "failed", f"erro inesperado: {str(e)[:500]}")
            failed += 1

    return {"published": published, "failed": failed}