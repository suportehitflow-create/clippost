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
        q = supabase.table("social_accounts").select("account_id, page_token, access_token")
        if social_account_id:
            q = q.eq("id", social_account_id)
        else:
            q = q.eq("user_id", user_id).eq("platform", platform).eq("is_active", True)
        res = maybe_one(q)
        return res.data
    except Exception:
        return None


def _finish(post_id: str, status: str, detail: str) -> None:
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

        if not video_url:
            _finish(post["id"], "failed", "clipe sem video_url")
            failed += 1
            continue

        try:
            if platform in META_PLATFORMS:
                # Usa token direto da tabela social_accounts
                account = _get_meta_token(post["user_id"], platform, post.get("social_account_id"))
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