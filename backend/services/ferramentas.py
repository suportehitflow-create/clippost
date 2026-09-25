"""
Ferramentas rápidas do painel:
- youtube_para_texto: legenda (manual ou automática) de um vídeo do YouTube em texto limpo / Markdown
- raio_x_perfil: nota de desempenho de um perfil (YouTube, Instagram, TikTok, Facebook) a partir
  dos vídeos mais recentes: média de views, engajamento, frequência e vídeos que estouraram
"""
import os
import re
import statistics
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def youtube_para_texto(url: str) -> dict:
    import yt_dlp
    from tasks import parse_vtt_subtitles

    if not re.search(r"(youtube\.com|youtu\.be)", url or ""):
        raise ValueError("Cole um link de vídeo do YouTube.")
    cookies = os.environ.get("YOUTUBE_COOKIES_FILE") or ("/tmp/yt_cookies.txt" if os.path.exists("/tmp/yt_cookies.txt") else None)
    with tempfile.TemporaryDirectory(prefix="clippost_yt_txt_") as tmp:
        opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitlesformat": "vtt",
            "subtitleslangs": ["pt", "pt-BR", "pt-orig", "en", "en-orig"],
            "outtmpl": str(Path(tmp) / "v.%(ext)s"),
            "quiet": True,
            "noplaylist": True,
            "socket_timeout": 20,
            **({"cookiefile": cookies} if cookies else {}),
            **({"proxy": os.environ["YTDLP_PROXY"]} if os.environ.get("YTDLP_PROXY") else {}),
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True) or {}
        arquivos = sorted(Path(tmp).glob("*.vtt"), key=lambda p: (0 if ".pt" in p.name else 1, p.name))
        if not arquivos:
            raise ValueError("Esse vídeo não tem legenda (nem automática) disponível.")
        segs = parse_vtt_subtitles(arquivos[0]).get("segments") or []

    # legendas automáticas repetem a linha anterior: junta sem duplicar
    partes: list[str] = []
    for s in segs:
        t = re.sub(r"\s+", " ", str(s.get("text") or "")).strip()
        if not t:
            continue
        if partes and (t == partes[-1] or partes[-1].endswith(t)):
            continue
        if partes and t.startswith(partes[-1]):
            partes[-1] = t
            continue
        partes.append(t)
    texto = " ".join(partes).strip()
    titulo = info.get("title") or "Vídeo do YouTube"
    canal = info.get("uploader") or info.get("channel") or ""
    markdown = (
        f"# {titulo}\n\n"
        f"- Canal: {canal}\n- Link: {info.get('webpage_url') or url}\n"
        f"- Duração: {int((info.get('duration') or 0) // 60)} min\n\n---\n\n{texto}\n"
    )
    return {
        "titulo": titulo,
        "canal": canal,
        "duracao": info.get("duration"),
        "texto": texto,
        "markdown": markdown,
        "palavras": len(texto.split()),
        "tokens_aprox": int(len(texto) / 4),
    }


def _nota(engajamento: float, por_semana: float, consistencia: float) -> tuple[str, int]:
    """0-100: engajamento pesa 50, frequência 25, consistência das views 25."""
    p_eng = min(50, engajamento / 0.08 * 50)          # 8% de engajamento = nota cheia
    p_freq = min(25, por_semana / 7 * 25)             # 1 vídeo por dia = nota cheia
    p_cons = max(0, min(25, consistencia * 25))
    pontos = round(p_eng + p_freq + p_cons)
    letra = "A" if pontos >= 80 else "B" if pontos >= 65 else "C" if pontos >= 50 else "D" if pontos >= 35 else "E"
    return letra, pontos


def raio_x_perfil(perfil: str, quantidade: int = 20) -> dict:
    from services.downloader import list_profile_videos

    dados = list_profile_videos(perfil, limit=quantidade, sort_by="date")
    videos = dados["videos"]
    if not videos:
        raise ValueError("Não encontrei vídeos nesse perfil.")

    views = [v.get("view_count") or 0 for v in videos]
    com_views = [v for v in videos if v.get("view_count")]
    engs = [((v.get("like_count") or 0) + (v.get("comment_count") or 0)) / v["view_count"] for v in com_views]
    engajamento = statistics.mean(engs) if engs else 0.0
    mediana = statistics.median(views) if views else 0
    media = statistics.mean(views) if views else 0
    # consistência: quanto a mediana chega perto da média (1 = todos os vídeos vão parecido)
    consistencia = (mediana / media) if media else 0

    datas = sorted(v["timestamp"] for v in videos if v.get("timestamp"))
    por_semana = 0.0
    if len(datas) >= 2:
        dias = max(1.0, (datas[-1] - datas[0]) / 86400)
        por_semana = round((len(datas) - 1) / dias * 7, 1)
    ultimo = datetime.fromtimestamp(datas[-1], tz=timezone.utc).isoformat() if datas else None

    letra, pontos = _nota(engajamento, por_semana, consistencia)
    estouraram = sorted([v for v in videos if mediana and (v.get("view_count") or 0) >= 2 * mediana],
                        key=lambda v: v.get("view_count") or 0, reverse=True)[:3]
    melhor = max(videos, key=lambda v: v.get("view_count") or 0)

    dicas = []
    if engajamento < 0.03:
        dicas.append("Engajamento baixo: capriche no gancho dos 3 primeiros segundos e peça comentário no fim.")
    if por_semana < 3:
        dicas.append("Posta pouco: perfis que crescem com cortes costumam postar pelo menos 1 vez por dia.")
    if consistencia < 0.5:
        dicas.append("Views muito irregulares: repita o formato e o tema dos vídeos que estouraram.")
    if not dicas:
        dicas.append("Perfil saudável: mantenha a frequência e teste variações dos vídeos que estouraram.")

    def curto(v):
        return {"titulo": (v.get("title") or "")[:120], "url": v.get("url"), "views": v.get("view_count"),
                "likes": v.get("like_count"), "comentarios": v.get("comment_count"), "thumbnail": v.get("thumbnail")}

    return {
        "perfil": dados.get("profile_url"),
        "plataforma": dados.get("platform"),
        "analisados": len(videos),
        "nota": letra,
        "pontos": pontos,
        "views_media": round(media),
        "views_mediana": round(mediana),
        "engajamento": round(engajamento * 100, 2),
        "posts_por_semana": por_semana,
        "ultimo_post": ultimo,
        "melhor_video": curto(melhor),
        "estouraram": [curto(v) for v in estouraram],
        "dicas": dicas,
    }
