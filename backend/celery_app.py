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
# O Redis gerenciado derruba conexões ociosas ("Broken pipe" / "Connection closed
# by server" nos logs do worker). Sem keepalive e health check o worker só
# percebe a queda ao tentar usar o socket, e tarefas ficam paradas na fila.
celery.conf.broker_connection_retry_on_startup = True
celery.conf.broker_transport_options = {
    "socket_keepalive": True,
    "health_check_interval": 30,
    # Maior que o download+render mais longo, para a tarefa não ser reentregue
    # a outro worker enquanto ainda está rodando.
    "visibility_timeout": 3600,
}
celery.conf.result_backend_transport_options = dict(celery.conf.broker_transport_options)

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
