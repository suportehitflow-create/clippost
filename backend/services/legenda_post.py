"""
Legenda de post (Instagram / TikTok / YouTube) com hashtags, gerada a partir do título e da
transcrição do corte. Usa os provedores baratos do ai_curator (Gemini → Groq → OpenRouter).
"""
import json
import re

from services.ai_curator import _try_providers

LIMITES = {"instagram": 2200, "tiktok": 2200, "youtube_shorts": 100, "facebook": 2200}

TONS = {
    "viral": "chamativo e curioso, que faz a pessoa querer assistir até o fim",
    "engracado": "leve e engraçado, linguagem de internet",
    "informativo": "claro e direto, entregando valor",
    "polemico": "provocativo, que gera comentários (sem ofender ninguém)",
}


def _prompt(titulo: str, transcricao: str, plataforma: str, tom: str) -> str:
    limite = LIMITES.get(plataforma, 2200)
    rede = {"youtube_shorts": "YouTube Shorts (título curto)", "tiktok": "TikTok", "facebook": "Facebook"}.get(plataforma, "Instagram Reels")
    return f"""Você escreve legendas para vídeos curtos em português do Brasil.

Rede: {rede}
Tom: {TONS.get(tom, TONS['viral'])}
Título do corte: {titulo or '(sem título)'}
O que é falado no vídeo (transcrição, pode estar cortada):
\"\"\"{transcricao[:3000] or '(sem transcrição)'}\"\"\"

Escreva 3 opções DIFERENTES de legenda. Cada uma:
- primeira linha é um gancho forte (aparece antes do "...mais")
- no máximo {min(limite, 600)} caracteres no texto (sem contar hashtags)
- quebras de linha curtas, pode usar 1 a 3 emojis
- termina com uma chamada para comentar, salvar ou seguir
- {'SEM hashtags no texto, só no campo hashtags' if plataforma != 'youtube_shorts' else 'no máximo 90 caracteres no total (é o título do Short)'}
E para cada opção, de 8 a 15 hashtags relevantes (mistura de amplas e de nicho, em português quando fizer sentido).

Responda SÓ com JSON válido, sem markdown:
{{"opcoes": [{{"legenda": "...", "hashtags": ["#exemplo", "..."]}}]}}"""


def gerar_legendas(titulo: str, transcricao: str, plataforma: str = "instagram", tom: str = "viral") -> list[dict]:
    bruto = _try_providers(_prompt(titulo, transcricao, plataforma, tom))
    if not bruto:
        raise RuntimeError("nenhum provedor de IA respondeu")
    bruto = re.sub(r"^```(?:json)?|```$", "", bruto.strip(), flags=re.MULTILINE).strip()
    inicio, fim = bruto.find("{"), bruto.rfind("}")
    dados = json.loads(bruto[inicio:fim + 1] if inicio >= 0 else bruto)
    opcoes = []
    for o in (dados.get("opcoes") or [])[:3]:
        legenda = str(o.get("legenda") or "").strip()
        tags = [t if str(t).startswith("#") else f"#{t}" for t in (o.get("hashtags") or []) if str(t).strip()]
        tags = [re.sub(r"\s+", "", str(t)) for t in tags][:20]
        if legenda:
            opcoes.append({"legenda": legenda, "hashtags": tags})
    if not opcoes:
        raise RuntimeError("a IA não devolveu legendas")
    return opcoes


def texto_do_trecho(transcript: dict | None, inicio: float, fim: float) -> str:
    """Texto falado entre inicio e fim (segundos) a partir de projects.transcript."""
    if not transcript:
        return ""
    segs = transcript.get("segments") if isinstance(transcript, dict) else None
    if not segs:
        return str(transcript.get("text") or "")[:3000] if isinstance(transcript, dict) else ""
    partes = [str(s.get("text") or "").strip() for s in segs
              if float(s.get("end", 0)) > inicio and float(s.get("start", 0)) < fim]
    return " ".join(p for p in partes if p)[:3000]
