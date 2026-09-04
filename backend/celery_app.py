import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

celery = Celery(
    "clippost",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks", "workers.scheduler_tasks"],
)
celery.conf.task_serializer = "json"
celery.conf.result_serializer = "json"
celery.conf.accept_content = ["json"]
celery.conf.timezone = "UTC"
celery.conf.enable_utc = True

# Celery Beat — agenda a verificação de posts a cada 60s
celery.conf.beat_schedule = {
    "check-scheduled-posts": {
        "task": "check_and_publish_scheduled_posts",
        "schedule": 60.0,
    },
}
