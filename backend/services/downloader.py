"""
Funções de download e metadados — inspiradas no algoritmo do ReClip.

O ReClip provou que yt-dlp funciona para 1000+ plataformas com uma única
lógica: pegar o melhor bitrate por resolução, sem tentar formatos específicos
por plataforma. Adotamos o mesmo algoritmo aqui.
"""
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone


# Padrões de plataforma para ajuste de pipeline
_PLATAFORMAS = {
    "youtube":   [r"youtube\.com", r"youtu\.be"],
    "tiktok":    [r"tiktok\.com"],
    "instagram": [r"instagram\.com"],
    "twitter":   [r"twitter\.com", r"x\.com"],
    "twitch":    [r"twitch\.tv"],
    "reddit":    [r"reddit\.com", r"redd\.it"],
    "vimeo":     [r"vimeo\.com"],
    "facebook":  [r"facebook\.com", r"fb\.com", r"fb\.watch"],
}


def detect_platform(url: str) -> str:
    """Detecta a plataforma a partir da URL."""
    for plataforma, padroes in _PLATAFORMAS.items():
        for p in padroes:
            if re.search(p, url, re.IGNORECASE):
                return plataforma
    return "unknown"


def get_pipeline_config(platform: str) -> dict:
    """Configuração de pipeline por plataforma."""
    configs = {
        "youtube": {
            "try_auto_captions": True,
            "transcription": "auto",
            "supports_playlists": True,
        },
        "tiktok": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": True,
        },
        "instagram": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": True,
        },
        "twitter": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": False,
        },
    }
    return configs.get(platform, {
        "try_auto_captions": False,
        "transcription": "whisper",
        "supports_playlists": False,
    })


def fetch_video_info(url: str) -> dict:
    """
    Obtém metadados do vídeo de qualquer plataforma suportada pelo yt-dlp.

    Algoritmo do ReClip: seleciona o melhor bitrate por resolução em vez de
    forçar um par de formato específico — funciona em 1000+ plataformas sem
    nenhuma lógica por site.

    Retorna: title, thumbnail, duration, uploader, platform, formats
    """
    cmd = ["yt-dlp", "--no-playlist", "-j", "--no-warnings", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        ultimo_erro = (result.stderr.strip().split("\n") or ["Erro desconhecido"])[-1]
        raise ValueError(ultimo_erro)

    info = json.loads(result.stdout)

    # Algoritmo do ReClip: melhor bitrate por resolução
    best_by_height: dict = {}
    for f in info.get("formats", []):
        height = f.get("height")
        if height and f.get("vcodec", "none") != "none":
            tbr = f.get("tbr") or 0
            existing = best_by_height.get(height)
            if existing is None or tbr > (existing.get("tbr") or 0):
                best_by_height[height] = f

    formats = sorted(
        [
            {"id": f["format_id"], "label": f"{h}p", "height": h}
            for h, f in best_by_height.items()
        ],
        key=lambda x: x["height"],
        reverse=True,
    )

    plataforma = detect_platform(url) or info.get("extractor_key", "unknown").lower()
    subtitles = info.get("subtitles") or {}
    auto_subtitles = info.get("automatic_captions") or {}
    has_native_subs = bool(
        any(k in subtitles for k in ("pt", "pt-BR", "pt-pt", "en")) or
        any(k in auto_subtitles for k in ("pt", "pt-BR", "pt-pt", "en"))
    )
    subs_langs = list(set(list(subtitles.keys()) + list(auto_subtitles.keys())))[:5]
    raw_chapters = info.get("chapters") or []
    chapters = [
        {
            "title": c.get("title", ""),
            "start_time": round(float(c.get("start_time", 0.0)), 2),
            "end_time": round(float(c.get("end_time", 0.0)), 2),
        }
        for c in raw_chapters
        if c.get("title")
    ]

    return {
        "title":       info.get("title", ""),
        "thumbnail":   info.get("thumbnail", ""),
        "duration":    info.get("duration"),
        "uploader":    info.get("uploader", ""),
        "platform":    plataforma,
        "formats":     formats,
        "webpage_url": info.get("webpage_url", url),
        "pipeline":    get_pipeline_config(plataforma),
        "has_native_subtitles": has_native_subs,
        "native_subtitle_languages": subs_langs,
        "processing_speed": "turbo_native" if has_native_subs else "whisper_standard",
        "estimated_time": "~15s (Modo Turbo: Legenda Nativa)" if has_native_subs else "1-3min (Whisper IA)",
        "chapters": chapters,
        "has_chapters": len(chapters) > 0,
        "chapter_count": len(chapters),
    }


def get_playlist_videos(url: str, limit: int = 50) -> dict:
    """
    Lista vídeos de uma playlist, canal ou perfil sem baixar nenhum vídeo.

    Funciona para: playlists do YouTube, canais (@handle/videos),
    perfis do TikTok, perfis do Instagram (público), e outros.

    Retorna os vídeos ordenados por visualizações (mais viral primeiro).
    """
    cmd = [
        "yt-dlp", "--flat-playlist", "-J",
        "--no-warnings",
        "--playlist-end", str(limit),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        ultimo_erro = (result.stderr.strip().split("\n") or ["Erro desconhecido"])[-1]
        raise ValueError(ultimo_erro)

    info = json.loads(result.stdout)
    entradas = info.get("entries", []) or []

    videos = []
    for e in entradas:
        if not e.get("url"):
            continue
        videos.append({
            "url":         e.get("url"),
            "title":       e.get("title", ""),
            "duration":    e.get("duration"),
            "thumbnail":   (e.get("thumbnail") or
                            (e.get("thumbnails") or [{}])[-1].get("url")),
            "view_count":  e.get("view_count"),
            "upload_date": e.get("upload_date"),
        })

    # Mais viral primeiro (do ReClip)
    videos.sort(key=lambda x: x.get("view_count") or 0, reverse=True)

    return {
        "playlist_title": info.get("title", ""),
        "uploader":       info.get("uploader", ""),
        "total":          len(videos),
        "videos":         videos,
    }


# ─── Perfis inteiros (edição em massa) ────────────────────────────────────────

_PROFILE_SORTS = {"views", "likes", "engagement", "date"}
_MAX_PROFILE_SCAN = 1000
_MAX_ENRICH = 300


def _cookies_args(platform: str) -> list[str]:
    """Cookies de login opcionais por plataforma (INSTAGRAM_COOKIES_FILE, TIKTOK_COOKIES_FILE...)."""
    path = os.environ.get(f"{platform.upper()}_COOKIES_FILE") or ""
    if not path and platform == "youtube" and os.path.exists("/tmp/yt_cookies.txt"):
        path = "/tmp/yt_cookies.txt"
    return ["--cookies", path] if path and os.path.exists(path) else []


def _proxy_args() -> list[str]:
    """Proxy residencial opcional (YTDLP_PROXY) para contornar bloqueio de IP de datacenter."""
    proxy = os.environ.get("YTDLP_PROXY")
    return ["--proxy", proxy] if proxy else []


def normalize_profile_url(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("http"):
        url = raw
    elif raw.startswith("@"):
        url = f"https://www.tiktok.com/{raw}"
    else:
        url = f"https://{raw}"
    platform = detect_platform(url)
    if platform == "youtube" and re.search(r"youtube\.com/(@[^/]+|channel/[^/]+|c/[^/]+)/?$", url):
        url = url.rstrip("/") + "/shorts"
    if platform == "facebook" and "/videos" not in url and "/reel" not in url:
        url = url.rstrip("/") + "/videos"
    return url


def _entry_to_video(e: dict) -> dict | None:
    url = e.get("webpage_url") or e.get("url")
    if not url or not str(url).startswith("http"):
        return None
    ts = e.get("timestamp")
    if not ts and e.get("upload_date"):
        try:
            ts = datetime.strptime(e["upload_date"], "%Y%m%d").replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            ts = None
    return {
        "url": url,
        "title": e.get("title") or e.get("description") or "",
        "duration": e.get("duration"),
        "thumbnail": e.get("thumbnail") or ((e.get("thumbnails") or [{}])[-1].get("url")),
        "view_count": e.get("view_count"),
        "like_count": e.get("like_count"),
        "comment_count": e.get("comment_count"),
        "timestamp": ts,
    }


def _enrich(video: dict, cookies: list[str]) -> dict:
    """Metadados completos de um vídeo (a listagem 'flat' às vezes não traz curtidas/views)."""
    try:
        r = subprocess.run(["yt-dlp", "-j", "--no-playlist", "--no-warnings", *cookies, *_proxy_args(), video["url"]],
                           capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            full = _entry_to_video(json.loads(r.stdout)) or {}
            return {**video, **{k: v for k, v in full.items() if v is not None}}
    except Exception as e:
        print(f"[profile] metadados de {video['url'][:60]} falharam: {e}")
    return video


def _instagram_web_profile(url: str) -> list[dict]:
    """Posts recentes via endpoint público da web do Instagram (sem login traz ~12)."""
    import httpx
    m = re.search(r"instagram\.com/([^/?#]+)", url)
    if not m or m.group(1) in ("reel", "reels", "p", "explore"):
        return []
    try:
        resp = httpx.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": m.group(1)},
            headers={"x-ig-app-id": "936619743392459", "User-Agent": "Mozilla/5.0"},
            timeout=20,
        )
        resp.raise_for_status()
        edges = resp.json()["data"]["user"]["edge_owner_to_timeline_media"]["edges"]
    except Exception as e:
        print(f"[profile] instagram web_profile_info falhou: {e}")
        return []
    videos = []
    for edge in edges:
        n = edge.get("node") or {}
        if not n.get("is_video"):
            continue
        caption = ((n.get("edge_media_to_caption") or {}).get("edges") or [{}])[0].get("node", {}).get("text", "")
        videos.append({
            "url": f"https://www.instagram.com/reel/{n.get('shortcode')}/",
            "title": caption[:120],
            "duration": n.get("video_duration"),
            "thumbnail": n.get("thumbnail_src") or n.get("display_url"),
            "view_count": n.get("video_view_count"),
            "like_count": (n.get("edge_liked_by") or n.get("edge_media_preview_like") or {}).get("count"),
            "comment_count": (n.get("edge_media_to_comment") or {}).get("count"),
            "timestamp": n.get("taken_at_timestamp"),
        })
    return videos


def _sort_key(sort_by: str):
    def key(v: dict):
        views = v.get("view_count") or 0
        likes = v.get("like_count") or 0
        comments = v.get("comment_count") or 0
        if sort_by == "likes":
            return likes
        if sort_by == "engagement":
            return (likes + comments) / views if views else likes + comments
        if sort_by == "date":
            return v.get("timestamp") or 0
        return views
    return key


def list_profile_videos(profile: str, limit: int = 0, sort_by: str = "views") -> dict:
    """
    Vídeos de um perfil/página (TikTok, Instagram, Facebook, YouTube) ordenados.
    limit=0 traz todos. sort_by: views | likes | engagement | date.
    """
    sort_by = sort_by if sort_by in _PROFILE_SORTS else "views"
    url = normalize_profile_url(profile)
    platform = detect_platform(url)
    cookies = _cookies_args(platform)

    scan = limit if (sort_by == "date" and limit) else _MAX_PROFILE_SCAN
    cmd = ["yt-dlp", "--flat-playlist", "-J", "--no-warnings", "--ignore-errors",
           "--playlist-end", str(scan), *cookies, *_proxy_args(), url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    videos: list[dict] = []
    if result.returncode == 0 and result.stdout.strip():
        info = json.loads(result.stdout)
        videos = [v for v in (_entry_to_video(e) for e in (info.get("entries") or []) if e) if v]
    if not videos and platform == "instagram":
        videos = _instagram_web_profile(url)
    if not videos:
        erro = (result.stderr.strip().split("\n") or [""])[-1]
        hint = ""
        if platform in ("instagram", "facebook"):
            hint = f" O {platform.capitalize()} costuma exigir login para listar perfis; configure {platform.upper()}_COOKIES_FILE no servidor."
        raise ValueError(f"Não encontrei vídeos em {url}.{hint} {erro}".strip())

    metric = {"views": "view_count", "likes": "like_count", "engagement": "like_count", "date": "timestamp"}[sort_by]
    missing = [v for v in videos[:_MAX_ENRICH] if v.get(metric) is None]
    if missing:
        with ThreadPoolExecutor(max_workers=6) as pool:
            enriched = list(pool.map(lambda v: _enrich(v, cookies), missing))
        by_url = {v["url"]: v for v in enriched}
        videos = [by_url.get(v["url"], v) for v in videos]

    # Perfis listam do mais novo para o mais antigo; sem data, mantém essa ordem
    if not (sort_by == "date" and all(v.get("timestamp") is None for v in videos)):
        videos.sort(key=_sort_key(sort_by), reverse=True)

    return {"profile_url": url, "platform": platform, "total_found": len(videos),
            "videos": videos[:limit] if limit else videos}
