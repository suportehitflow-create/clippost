"""
Celery Beat Task — varre scheduled_posts e publica no Instagram os que estão pendentes.

Configurar no celery_app.py:
    celery.conf.beat_schedule = {
        "check-scheduled-posts": {
            "task": "check_and_publish_scheduled_posts",
            "schedule": 60.0,  # a cada 60 segundos
        }
    }
    celery.conf.timezone = "UTC"
"""
import os
from datetime import datetime, timezone

from celery_app import celery
from supabase import create_client, Client
from dotenv import load_dotenv
from services.social_publisher import publish_reel, InstagramPublishError

load_dotenv()

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
)


@celery.task(name="check_and_publish_scheduled_posts")
def check_and_publish_scheduled_posts():
    """
    Busca posts pendentes com scheduled_time <= agora e publica no Instagram.
    Roda a cada minuto via Celery Beat.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    pending = (
        supabase.table("scheduled_posts")
        .select("*, clips(storage_url, title), social_accounts(account_id, access_token, platform)")
        .eq("status", "pending")
        .lte("scheduled_time", now_iso)
        .execute()
    )

    if not pending.data:
        return {"published": 0, "failed": 0}

    published = 0
    failed = 0

    for post in pending.data:
        post_id = post["id"]
        clip = post.get("clips") or {}
        account = post.get("social_accounts") or {}

        video_url = clip.get("storage_url", "")
        caption = post.get("caption", "")
        account_id = account.get("account_id", "")
        access_token = account.get("access_token", "")
        platform = account.get("platform", "instagram")

        if platform != "instagram" or not all([video_url, account_id, access_token]):
            supabase.table("scheduled_posts").update({
                "status": "failed",
                "error_log": "Dados insuficientes: video_url, account_id ou access_token ausente.",
            }).eq("id", post_id).execute()
            failed += 1
            continue

        try:
            result = publish_reel(
                account_id=account_id,
                access_token=access_token,
                video_url=video_url,
                caption=caption,
            )
            supabase.table("scheduled_posts").update({
                "status": "published",
                "error_log": f"media_id={result['media_id']} permalink={result.get('permalink', '')}",
            }).eq("id", post_id).execute()
            published += 1
        except InstagramPublishError as e:
            supabase.table("scheduled_posts").update({
                "status": "failed",
                "error_log": str(e)[:1000],
            }).eq("id", post_id).execute()
            failed += 1
        except Exception as e:
            supabase.table("scheduled_posts").update({
                "status": "failed",
                "error_log": f"Erro inesperado: {str(e)[:900]}",
            }).eq("id", post_id).execute()
            failed += 1

    return {"published": published, "failed": failed}
