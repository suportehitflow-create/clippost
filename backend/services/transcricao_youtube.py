"""Transcrição que o próprio YouTube já tem (legenda manual ou automática), sem baixar o vídeo.

Usa a biblioteca youtube-transcript-api: é rápida e grátis. Serve de reserva quando a transcrição
pelo áudio (Whisper) não sai, e para a ferramenta "YouTube para texto".
Também é barrada quando o YouTube bloqueia o IP — aí devolve None e o resto segue como antes.
"""
import re

IDIOMAS = ["pt", "pt-BR", "pt-PT", "en"]


def id_do_video(url: str) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/live/|/embed/)([A-Za-z0-9_-]{11})", url or "")
    return m.group(1) if m else None


def transcricao(url: str, idiomas: list[str] | None = None) -> dict | None:
    """{"segments": [...], "words": [...], "idioma": "pt", "automatica": bool} ou None se não houver.
    Prefere a legenda feita pelo dono do canal; sem ela, usa a automática."""
    vid = id_do_video(url)
    if not vid:
        return None
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return None
    langs = idiomas or IDIOMAS
    try:
        disponiveis = YouTubeTranscriptApi().list(vid)
        try:
            escolhida = disponiveis.find_manually_created_transcript(langs)
        except Exception:
            escolhida = disponiveis.find_transcript(langs)
        trechos = list(escolhida.fetch())
    except Exception as e:
        print(f"[transcricao-yt] sem legenda do YouTube para {vid}: {type(e).__name__}")
        return None

    segments, words = [], []
    for t in trechos:
        texto = re.sub(r"\s+", " ", str(getattr(t, "text", "") or "")).strip()
        if not texto or texto.startswith("[") and texto.endswith("]"):  # [Música], [Aplausos]
            continue
        ini = float(getattr(t, "start", 0) or 0)
        fim = ini + float(getattr(t, "duration", 0) or 0)
        segments.append({"start": round(ini, 2), "end": round(fim, 2), "text": texto})
        # o YouTube não dá o tempo de cada palavra: divide o trecho por igual (como nas legendas .vtt)
        palavras = texto.split()
        passo = (fim - ini) / max(1, len(palavras))
        for i, w in enumerate(palavras):
            words.append({"start": round(ini + i * passo, 2), "end": round(ini + (i + 1) * passo, 2), "word": w})
    if not segments:
        return None
    print(f"[transcricao-yt] {vid}: {len(segments)} trechos ({escolhida.language_code}, "
          f"{'automática' if escolhida.is_generated else 'manual'})")
    return {"segments": segments, "words": words, "idioma": escolhida.language_code,
            "automatica": bool(escolhida.is_generated)}
