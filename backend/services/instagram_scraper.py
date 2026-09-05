"""
Instagram scraper via yt-dlp — perfis públicos, sem token necessário.
"""
import subprocess
import json
import re


def _run_ytdlp(args: list[str]) -> dict:
    cmd = ["yt-dlp", "--no-warnings", "--quiet"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return {"stdout": result.stdout, "stderr": result.stderr, "code": result.returncode}


def list_instagram_videos(username_or_url: str, limit: int = 10, sort_by: str = "recent") -> list[dict]:
    """
    Lista vídeos de um perfil público do Instagram.
    sort_by: "recent" | "views"
    """
    # Normalizar username
    if not username_or_url.startswith("http"):
        handle = username_or_url.lstrip("@")
        url = f"https://www.instagram.com/{handle}/"
    else:
        url = username_or_url

    result = _run_ytdlp([
        "--flat-playlist",
        "--playlist-end", str(limit * 2),  # pegar mais para depois filtrar
        "--print", '{"id":"%(id)s","title":"%(title)s","url":"%(webpage_url)s","view_count":%(view_count)s,"timestamp":%(timestamp)s,"duration":%(duration)s}',
        url,
    ])

    videos = []
    for line in result["stdout"].splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            v = json.loads(line)
            # Filtrar apenas vídeos (descartar posts sem duração)
            if v.get("duration") and v["duration"] > 0:
                videos.append({
                    "id": v.get("id", ""),
                    "title": v.get("title", "Sem título"),
                    "url": v.get("url", ""),
                    "view_count": v.get("view_count") or 0,
                    "timestamp": v.get("timestamp") or 0,
                    "duration": v.get("duration", 0),
                    "platform": "instagram",
                })
        except (json.JSONDecodeError, KeyError):
            continue

    # Ordenação
    if sort_by == "views":
        videos.sort(key=lambda x: x["view_count"], reverse=True)
    else:  # recent
        videos.sort(key=lambda x: x["timestamp"], reverse=True)

    return videos[:limit]


def get_instagram_video_url(post_url: str) -> str | None:
    """Extrai URL direta de download de um post do Instagram."""
    result = _run_ytdlp([
        "--get-url",
        "-f", "best[ext=mp4]/best",
        post_url,
    ])
    url = result["stdout"].strip()
    return url if url.startswith("http") else None
