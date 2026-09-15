"""
AI Curator — detecta os melhores momentos para clipes virais.

Usa um endpoint compativel com a API da OpenAI (OpenRouter, Gemini, Groq),
escolhido por variavel de ambiente, para rodar sem custo. Se o modelo gratuito
falhar e houver ANTHROPIC_API_KEY, cai para a Anthropic em vez de devolver
uma lista vazia — sem cortes o produto nao entrega nada.
"""
import json
import os
import re

import httpx

BASE_URL = os.environ.get("AI_CURATOR_BASE_URL", "https://openrouter.ai/api/v1")
MODEL = os.environ.get("AI_CURATOR_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
API_KEY = os.environ.get("AI_CURATOR_API_KEY") or os.environ.get("OPENROUTER_API_KEY", "")


def _call_free_model(prompt: str) -> str:
    resp = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120.0,
    )
    resp.raise_for_status()
    choices = resp.json().get("choices") or []
    return (choices[0]["message"].get("content") or "").strip() if choices else ""


def _call_anthropic(prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def get_viral_clips(transcript_data: dict, clip_duration: str = "auto") -> list[dict]:
    """
    Recebe transcript_data (dict com 'segments' e 'words') e retorna
    uma lista de até 3 cortes virais com start_time, end_time, hook_title, ai_score.
    """
    segments = transcript_data.get("segments", [])
    if not segments:
        return []

    duration_rule = {
        "30": "entre 25 e 35 segundos (clipes curtos)",
        "60": "entre 50 e 65 segundos (clipes longos)",
        "auto": "entre 30 e 60 segundos (IA decide conforme o conteúdo)",
    }.get(clip_duration, "entre 30 e 60 segundos")

    max_duration = 35 if clip_duration == "30" else 65 if clip_duration == "60" else 60

    prompt = f"""Você é um especialista em conteúdo viral para TikTok, Instagram Reels e YouTube Shorts.

Analise a transcrição abaixo e encontre os 3 melhores momentos para clipes curtos virais.

IGNORE completamente:
- Introduções ("Oi galera", "Olá pessoal", "Bem-vindos", "No vídeo de hoje")
- Encerramento ("Se gostou curte", "Até o próximo", "Obrigado")
- Transições sem conteúdo ("Como eu falei antes", "Continuando...")

PRIORIZE:
- Revelação surpreendente ou contra-intuitiva
- Pergunta seguida de resposta direta e poderosa
- Polêmica, conflito ou declaração audaciosa
- Insight ou técnica acionável
- Momento de emoção intensa ou humor

Duração dos clipes: {duration_rule}

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

    raw = ""
    if API_KEY:
        try:
            raw = _call_free_model(prompt)
        except Exception as e:
            print(f"[ai_curator] modelo gratuito falhou ({type(e).__name__}: {e})")

    if not raw and os.environ.get("ANTHROPIC_API_KEY"):
        print("[ai_curator] usando Anthropic como reserva")
        raw = _call_anthropic(prompt)

    if not raw:
        print("[ai_curator] nenhum provedor disponivel — configure AI_CURATOR_API_KEY")
        return []

    try:
        clips = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            clips = json.loads(match.group())
        else:
            clips = []

    # Garantir duração e campos obrigatórios
    default_dur = 30 if clip_duration == "30" else 55 if clip_duration == "60" else 45
    validated = []
    for c in clips[:3]:
        start = float(c.get("start_time", 0))
        end = float(c.get("end_time", start + default_dur))
        if end - start > max_duration:
            end = start + max_duration
        if end - start < 10:
            end = start + default_dur
        validated.append({
            "start_time": round(start, 2),
            "end_time": round(end, 2),
            "hook_title": str(c.get("hook_title", "Clipe viral"))[:60],
            "ai_score": round(min(1.0, max(0.0, float(c.get("ai_score", 0.7)))), 2),
        })

    return validated
