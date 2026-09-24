"""
Edição em massa: aplica o template do usuário em cada vídeo inteiro (sem cortar).

Fontes: arquivos enviados (URLs do Storage) ou um perfil inteiro (TikTok, Instagram,
Facebook, YouTube). Cada vídeo vira um projeto com um clipe, então aparece nas
mesmas telas dos cortes. O andamento do lote fica em memória (GET /api/bulk/{id}).
"""
import copy
import os
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

import httpx
import yt_dlp

from services.ai_curator import generate_hook_title
from services.downloader import detect_platform, list_profile_videos, _cookies_args
from services.ffmpeg_engine import create_vertical_clip
from services.stripe_service import check_clip_limit, increment_clips_used
from services.subtitle_generator import generate_ass
from services.template_detector import crop_to_region, detect_video_region
from tasks import _recompress_if_needed, _upload_clip_to_storage, supabase, transcribe_media

_MAX_VIDEO_SECS = 10 * 60
_BATCH_TTL_SECS = 24 * 3600

_batches: dict[str, dict] = {}
_batches_lock = threading.Lock()


def create_batch(user_id: str, source: str) -> str:
    batch_id = uuid.uuid4().hex[:12]
    now = time.time()
    with _batches_lock:
        for bid in [b for b, v in _batches.items() if now - v["created_at"] > _BATCH_TTL_SECS]:
            _batches.pop(bid, None)
        _batches[batch_id] = {
            "id": batch_id, "user_id": user_id, "source": source,
            "status": "listing" if source == "profile" else "processing",
            "error": None, "created_at": now, "items": [],
        }
    return batch_id


def get_batch(batch_id: str) -> dict | None:
    with _batches_lock:
        batch = _batches.get(batch_id)
        return copy.deepcopy(batch) if batch else None


def _set_batch(batch_id: str, **fields):
    with _batches_lock:
        if batch_id in _batches:
            _batches[batch_id].update(fields)


def _set_item(batch_id: str, idx: int, **fields):
    with _batches_lock:
        batch = _batches.get(batch_id)
        if batch and idx < len(batch["items"]):
            batch["items"][idx].update(fields)


def _load_brand_kit(user_id: str, template_config: dict | None) -> dict:
    resp = supabase.table("brand_kits").select("*").eq("user_id", user_id).maybe_single().execute()
    brand_kit = (resp.data if resp and resp.data else {}) or {}
    if template_config:
        brand_kit["layout_config"] = {**(brand_kit.get("layout_config") or {}), **template_config}
        if template_config.get("brandHandle"):
            brand_kit["username"] = template_config["brandHandle"]
    return brand_kit


def _download(url: str, tmp_dir: Path) -> tuple[str, dict]:
    if "/storage/v1/object/" in url:
        dest = tmp_dir / "source.mp4"
        with httpx.stream("GET", url, timeout=600.0, follow_redirects=True) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_bytes(1024 * 1024):
                    f.write(chunk)
        return str(dest), {}

    opts = {
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "outtmpl": str(tmp_dir / "source.%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "noprogress": True,
        "socket_timeout": 60,
        "retries": 3,
    }
    cookies = _cookies_args(detect_platform(url))
    if cookies:
        opts["cookiefile"] = cookies[1]
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True) or {}
    files = sorted(tmp_dir.glob("source.*"), key=lambda p: p.stat().st_size, reverse=True)
    if not files:
        raise RuntimeError("download não gerou arquivo de vídeo")
    return str(files[0]), info


def _probe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, timeout=30,
    )
    return float(out.stdout.strip() or 0)


def _process_item(user_id: str, item: dict, brand_kit: dict, options: dict) -> dict:
    """Baixa, (re)enquadra, legenda e renderiza um vídeo. Retorna campos do item."""
    platform = detect_platform(item["url"])
    source_type = "file" if "/storage/v1/object/" in item["url"] else "url"
    project = supabase.table("projects").insert({
        "user_id": user_id,
        "title": (item.get("title") or "Vídeo").strip()[:200] or "Vídeo",
        "source_url": item["url"],
        "source_type": source_type,
        "platform": platform if platform != "unknown" else source_type,
        "status": "processing",
    }).execute().data[0]
    project_id = project["id"]

    tmp_dir = Path(tempfile.mkdtemp(prefix="clippost_bulk_"))
    try:
        video_path, info = _download(item["url"], tmp_dir)
        duration = min(_probe_duration(video_path), _MAX_VIDEO_SECS)
        if duration < 1:
            raise RuntimeError("vídeo sem duração válida")

        replaced = False
        if options.get("replace_template", True):
            region = detect_video_region(video_path)
            if region:
                print(f"[bulk] template de outra página detectado — recortando área {region}")
                video_path = crop_to_region(video_path, str(tmp_dir / "cropped.mp4"), region)
                replaced = True

        segments, words = [], []
        if options.get("subtitles", True):
            try:
                transcript = transcribe_media(video_path, str(tmp_dir / "audio.mp3"))
                segments, words = transcript.get("segments", []), transcript.get("words", [])
            except Exception as e:
                print(f"[bulk] transcrição falhou ({e}), seguindo sem legenda")

        original_title = item.get("title") or info.get("title") or info.get("description") or ""
        spoken = " ".join(s.get("text", "") for s in segments)
        hook = generate_hook_title(spoken, original_title) or "ASSISTA ATÉ O FINAL"

        layout = brand_kit.get("layout_config") or {}
        subtitle_file = None
        if segments:
            sub_y = float((layout.get("subtitlePos") or {}).get("y", 78))
            subtitle_file = generate_ass(
                segments, str(tmp_dir / "subtitles.ass"),
                clip_start=0.0, clip_end=duration, words=words,
                margin_v=max(50, min(800, int(1280 * (1.0 - sub_y / 100.0)) - 25)),
                subtitle_preset=options.get("subtitle_preset") or layout.get("subtitle_preset") or "hormozi_yellow",
                font_family=layout.get("fontFamily"),
                font_size=layout.get("fontSize"),
            )

        out_path = str(tmp_dir / "final.mp4")
        create_vertical_clip(
            input_video=video_path,
            output_video=out_path,
            start=0.0,
            end=duration,
            brand_kit=brand_kit,
            subtitle_file=subtitle_file,
            hook_title=hook,
            hflip=bool(options.get("hflip")),
            remove_silence=bool(options.get("remove_silence")),
            speed=float(options.get("speed") or 1.0),
        )
        if not os.path.exists(out_path):
            raise RuntimeError("renderização não gerou o vídeo final")

        clip_url = _upload_clip_to_storage(f"{user_id}/{project_id}/bulk_0.mp4", _recompress_if_needed(out_path))
        supabase.table("clips").insert({
            "project_id": project_id,
            "user_id": user_id,
            "title": hook,
            "hook": hook,
            "start_time": 0.0,
            "end_time": duration,
            "score": 0.9,
            "storage_url": clip_url,
            "status": "ready",
        }).execute()
        supabase.table("projects").update({"status": "done", "error_message": None}).eq("id", project_id).execute()
        try:
            increment_clips_used(user_id)
        except Exception as inc_err:
            print(f"[bulk] increment_clips_used falhou (não crítico): {inc_err}")
        return {"status": "done", "project_id": project_id, "clip_url": clip_url,
                "hook": hook, "template_replaced": replaced}
    except Exception as e:
        supabase.table("projects").update({"status": "failed", "error_message": str(e)[:900]}).eq("id", project_id).execute()
        raise RuntimeError(str(e)) from e
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def run_batch(batch_id: str, req: dict):
    user_id = req["user_id"]
    options = req.get("options") or {}
    try:
        if req.get("source") == "profile":
            listing = list_profile_videos(req.get("profile_url") or "", int(req.get("limit") or 0), req.get("sort_by") or "views")
            videos = listing["videos"]
            _set_batch(batch_id, profile_url=listing["profile_url"], platform=listing["platform"])
        else:
            videos = req.get("videos") or []
        with _batches_lock:
            _batches[batch_id]["items"] = [
                {"url": v["url"], "title": v.get("title") or "", "thumbnail": v.get("thumbnail"),
                 "view_count": v.get("view_count"), "like_count": v.get("like_count"),
                 "status": "pending", "project_id": None, "error": None}
                for v in videos if v.get("url")
            ]
            items = copy.deepcopy(_batches[batch_id]["items"])
        _set_batch(batch_id, status="processing")

        brand_kit = _load_brand_kit(user_id, req.get("template_config"))
        for idx, item in enumerate(items):
            try:
                check_clip_limit(user_id)
            except Exception as limit_err:
                for rest in range(idx, len(items)):
                    _set_item(batch_id, rest, status="failed", error=str(limit_err))
                break
            _set_item(batch_id, idx, status="processing")
            try:
                _set_item(batch_id, idx, **_process_item(user_id, item, brand_kit, options))
            except Exception as e:
                print(f"[bulk] item {idx} falhou: {e}")
                _set_item(batch_id, idx, status="failed", error=str(e)[:300])
        _set_batch(batch_id, status="done")
    except Exception as e:
        print(f"[bulk] lote {batch_id} falhou: {e}")
        _set_batch(batch_id, status="failed", error=str(e)[:500])
