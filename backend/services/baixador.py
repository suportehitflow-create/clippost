"""Baixar vídeos (ferramenta "Baixar vídeos", no estilo do reclip / yoinks): vários links de uma vez,
MP4 na resolução escolhida (com o tamanho estimado de cada uma) ou MP3 só do áudio, de vários sites.
Tudo pelo yt-dlp + ffmpeg que o Clipost já usa; se o jeito escolhido falhar, cai no download comum.
"""
import re
from pathlib import Path

import yt_dlp

# sites aceitos (o servidor não abre links quaisquer: evita usar o Clipost para acessar endereços internos)
SITES = re.compile(
    r"^https://([^/]*\.)?("
    r"youtube\.com|youtu\.be|instagram\.com|cdninstagram\.com|fbcdn\.net|facebook\.com|fb\.watch|"
    r"tiktok\.com|tiktokcdn[^/]*\.com|x\.com|twitter\.com|threads\.(net|com)|reddit\.com|redd\.it|"
    r"vimeo\.com|twitch\.tv|dailymotion\.com|dai\.ly|kwai\.com|kw\.ai|pinterest\.com|pin\.it|"
    r"linkedin\.com|loom\.com|streamable\.com|soundcloud\.com|tumblr\.com|bilibili\.com|rumble\.com|"
    r"kick\.com|snapchat\.com"
    r")/",
    re.I,
)

ALTURAS = (2160, 1440, 1080, 720, 480, 360)


def _opcoes_base() -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "http_headers": {"Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"},
    }


def formatos(url: str) -> dict:
    """Resoluções disponíveis com o tamanho estimado (vídeo + melhor áudio) e o MP3."""
    if not SITES.match(url or ""):
        raise ValueError("Esse site não é aceito. Use YouTube, Instagram, TikTok, X, Facebook, Vimeo, Twitch e outros.")
    with yt_dlp.YoutubeDL(_opcoes_base()) as ydl:
        info = ydl.extract_info(url, download=False) or {}
    fmts = info.get("formats") or []
    dur = info.get("duration") or 0

    def tamanho(f: dict) -> int | None:
        t = f.get("filesize") or f.get("filesize_approx")
        if not t and f.get("tbr") and dur:
            t = int(f["tbr"] * 1000 / 8 * dur)
        return int(t) if t else None

    audios = [f for f in fmts if f.get("vcodec") == "none" and f.get("acodec") not in (None, "none")]
    melhor_audio = max(audios, key=lambda f: f.get("abr") or f.get("tbr") or 0, default=None)
    t_audio = tamanho(melhor_audio) if melhor_audio else 0

    opcoes = []
    for h in ALTURAS:
        candidatos = [f for f in fmts if (f.get("height") or 0) and f.get("vcodec") not in (None, "none") and f["height"] <= h]
        if not candidatos:
            continue
        melhor = max(candidatos, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0))
        if melhor["height"] < h and any(o["altura"] == melhor["height"] for o in opcoes):
            continue
        t = tamanho(melhor)
        if t and melhor.get("acodec") in (None, "none"):
            t += t_audio or 0
        opcoes.append({"tipo": "mp4", "altura": melhor["height"], "rotulo": f"{melhor['height']}p", "tamanho": t})
    vistos, unicas = set(), []
    for o in opcoes:
        if o["altura"] not in vistos:
            vistos.add(o["altura"])
            unicas.append(o)
    if not unicas and any(f.get("vcodec") not in (None, "none") for f in fmts):
        # site que não informa a altura dos vídeos: oferece o melhor disponível
        unicas.append({"tipo": "mp4", "altura": None, "rotulo": "MP4 (melhor)", "tamanho": None})
    if melhor_audio or fmts:
        unicas.append({"tipo": "mp3", "altura": None, "rotulo": "MP3 (só áudio)",
                       "tamanho": int(dur * 192000 / 8) if dur else None})
    return {
        "titulo": info.get("title") or "",
        "canal": info.get("uploader") or info.get("channel") or "",
        "duracao": dur or None,
        "capa": info.get("thumbnail"),
        "opcoes": unicas,
    }


def baixar(url: str, pasta: Path, formato: str = "mp4", altura: int | None = None) -> Path:
    """Baixa um link no formato pedido e devolve o arquivo. MP4 sempre sai com vídeo e áudio juntos."""
    pasta.mkdir(parents=True, exist_ok=True)
    base = {**_opcoes_base(), "outtmpl": str(pasta / "arquivo.%(ext)s")}
    if formato == "mp3":
        opts = {**base, "format": "bestaudio/best",
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]}
    else:
        limite = f"[height<={int(altura)}]" if altura else ""
        opts = {**base, "format": f"bv*{limite}[ext=mp4]+ba[ext=m4a]/bv*{limite}+ba/b{limite}/b",
                "merge_output_format": "mp4"}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=True)
    except Exception:
        if formato == "mp3":
            raise
        # MP4: se o jeito escolhido falhar, vai pelo download comum do Clipost (com as reservas dele)
        from bulk_tasks import _download
        caminho, _ = _download(url, pasta)
        return Path(caminho)
    feitos = sorted((p for p in pasta.glob("arquivo.*") if p.suffix.lower() in (".mp3", ".mp4", ".mkv", ".webm", ".m4a")),
                    key=lambda p: p.stat().st_size, reverse=True)
    if not feitos:
        raise RuntimeError("o download não gerou arquivo")
    return feitos[0]
