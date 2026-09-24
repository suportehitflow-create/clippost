"""
Registro dos trabalhos em andamento neste processo.

O deploy.ps1 consulta /api/admin/active-jobs e só publica quando está zerado,
para um deploy não derrubar o corte de outra pessoa.
"""
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

CELERY_ENABLED = os.getenv("CELERY_ENABLED", "false").lower() == "true"

_active_jobs: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()
# Trabalhos disparados pelo agendador (Autopilot) rodam um por vez para não disputar CPU
_background_queue = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bgjob")


def run_tracked(kind: str, fn, *args):
    key = uuid.uuid4().hex
    with _lock:
        _active_jobs[key] = (kind, time.time())
    try:
        return fn(*args)
    finally:
        with _lock:
            _active_jobs.pop(key, None)


def enqueue(kind: str, fn, *args):
    """Enfileira fora de uma requisição (sem BackgroundTasks do FastAPI)."""
    return _background_queue.submit(run_tracked, kind, fn, *args)


def snapshot() -> list[dict]:
    now = time.time()
    with _lock:
        return [{"kind": kind, "running_for_s": int(now - started)} for kind, started in _active_jobs.values()]
