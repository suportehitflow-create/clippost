"""
Preferências por usuário guardadas no Storage (sem precisar de coluna nova no banco).
Hoje: de quanto em quanto tempo o Autopilot verifica os canais monitorados.
"""
import json
import os
import time

from supabase import create_client

AUTOPILOT_MIN_MINUTES = 15
AUTOPILOT_DEFAULT_MINUTES = 60
AUTOPILOT_ALLOWED = (15, 30, 60, 180, 360, 720, 1440)

_BUCKET = "videos"
_CACHE_TTL = 120
_cache: dict[str, tuple[float, dict]] = {}

_client = create_client(
    os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "https://alntulecjshpbrhesaoo.supabase.co",
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "",
)


def _path(user_id: str) -> str:
    return f"_settings/{user_id}.json"


def get_settings(user_id: str) -> dict:
    hit = _cache.get(user_id)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return dict(hit[1])
    try:
        data = json.loads(_client.storage.from_(_BUCKET).download(_path(user_id)))
    except Exception:
        data = {}
    _cache[user_id] = (time.time(), data)
    return dict(data)


def save_settings(user_id: str, **fields) -> dict:
    data = {**get_settings(user_id), **fields}
    _client.storage.from_(_BUCKET).upload(
        _path(user_id),
        json.dumps(data).encode("utf-8"),
        file_options={"content-type": "application/json", "upsert": "true"},
    )
    _cache[user_id] = (time.time(), data)
    return data


def autopilot_interval_minutes(user_id: str) -> int:
    try:
        minutes = int(get_settings(user_id).get("autopilot_interval_minutes") or AUTOPILOT_DEFAULT_MINUTES)
    except (TypeError, ValueError):
        minutes = AUTOPILOT_DEFAULT_MINUTES
    return max(AUTOPILOT_MIN_MINUTES, minutes)
