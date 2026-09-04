"""
AI Curator — detecta os melhores momentos para clipes virais usando Claude.
"""
import json
import os
import anthropic

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def get_viral_clips(transcript_data: dict) -> list[dict]:
    """
    Recebe transcript_data (dict com 'segments' e 'words') e retorna
    uma lista de até 3 cortes virais com start_time, end_time, hook_title, ai_score.
    """
    segments = transcript_data.get("segments", [])
    if not segments:
        return []

    prompt = f"""Você é um especialista em conteúdo viral para TikTok, Instagram Reels e YouTube Shorts.

Analise a transcrição abaixo e encontre os 3 melhores momentos para clipes curtos virais.

Critérios para selecionar um bom momento:
- Gancho de curiosidade forte (algo surpreendente, contra-intuitivo ou revelador)
- Resposta direta a uma pergunta relevante
- Momento de emoção, humor ou insight poderoso
- Duração entre 30 e 60 segundos

Transcrição (com timestamps em segundos):
{json.dumps(segments[:100], ensure_ascii=False)}

Retorne ESTRITAMENTE um array JSON válido com exatamente 3 objetos, sem nenhum texto antes ou depois:
[
  {{
    "start_time": <float, segundo inicial>,
    "end_time": <float, segundo final, máx start_time + 60>,
    "hook_title": "<título curto e chamativo, máx 60 chars>",
    "ai_score": <float entre 0.0 e 1.0, estimativa de viralidade>
  }}
]"""

    message = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    try:
        clips = json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            clips = json.loads(match.group())
        else:
            clips = []

    # Garantir duração máxima de 60s e campos obrigatórios
    validated = []
    for c in clips[:3]:
        start = float(c.get("start_time", 0))
        end = float(c.get("end_time", start + 45))
        if end - start > 60:
            end = start + 60
        if end - start < 10:
            end = start + 30
        validated.append({
            "start_time": round(start, 2),
            "end_time": round(end, 2),
            "hook_title": str(c.get("hook_title", "Clipe viral"))[:60],
            "ai_score": round(min(1.0, max(0.0, float(c.get("ai_score", 0.7)))), 2),
        })

    return validated
