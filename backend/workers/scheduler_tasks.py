"""
Celery Beat Task — publica os posts agendados que já venceram.

Roda a cada 60s (beat_schedule em celery_app.py). A publicação passa pela
Upload-Post, que guarda os tokens de TikTok, Instagram e YouTube de cada usuário.
"""
import os
from datetime import datetime, timezone

from celery_app import celery
from supabase import create_client, Client
from dotenv import load_dotenv
from services.upload_post import publish_video, UploadPostError

load_dotenv()

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
)

# Nome na tabela scheduled_posts -> nome na Upload-Post
PLATFORM_MAP = {"tiktok": "tiktok", "instagram": "instagram", "youtube_shorts": "youtube"}


def _finish(post_id: str, status: str, detail: str) -> None:
    supabase.table("scheduled_posts").update({"status": status}).eq("id", post_id).execute()
    print(f"[scheduler] post {post_id} -> {status}: {detail}")


@celery.task(name="check_and_publish_scheduled_posts")
def check_and_publish_scheduled_posts():
    now_iso = datetime.now(timezone.utc).isoformat()
    due = (
        supabase.table("scheduled_posts")
        .select("id, user_id, clip_id, platform, caption")
        .eq("status", "scheduled")
        .lte("scheduled_at", now_iso)
        .execute()
    )
    if not due.data:
        return {"published": 0, "failed": 0}

    published = failed = 0
    for post in due.data:
        platform = PLATFORM_MAP.get(post["platform"])
        clip = supabase.table("clips").select("storage_url, title").eq("id", post["clip_id"]).maybe_single().execute()
        clip_data = (clip.data if clip else None) or {}
        video_url = clip_data.get("storage_url")

        if not platform or not video_url:
            _finish(post["id"], "failed", f"plataforma '{post['platform']}' sem suporte ou clipe sem vídeo")
            failed += 1
            continue

        # O Idempotency-Key (id do post) impede publicação duplicada se o beat
        # enfileirar o mesmo post de novo enquanto este upload ainda roda.
        try:
            result = publish_video(
                user_id=post["user_id"],
                platform=platform,
                video_url=video_url,
                caption=post.get("caption") or "",
                title=clip_data.get("title") or "",
                post_id=post["id"],
            )
            _finish(post["id"], "published", result.get("url", ""))
            published += 1
        except UploadPostError as e:
            _finish(post["id"], "failed", str(e)[:500])
            failed += 1
        except Exception as e:
            _finish(post["id"], "failed", f"erro inesperado: {str(e)[:500]}")
            failed += 1

    return {"published": published, "failed": failed}
