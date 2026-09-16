"""
Funções de download e metadados — inspiradas no algoritmo do ReClip.

O ReClip provou que yt-dlp funciona para 1000+ plataformas com uma única
lógica: pegar o melhor bitrate por resolução, sem tentar formatos específicos
por plataforma. Adotamos o mesmo algoritmo aqui.
"""
import json
import re
import subprocess


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
