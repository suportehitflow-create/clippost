"""
AI Curator — Diretor de Criação e Roteirista de Cortes Virais para Reels, TikTok e Shorts.

Suporte multi-provedor (em ordem de prioridade):
  1. Groq  — llama-3.3-70b, grátis, ultra-rápido (GROQ_API_KEY)
  2. OpenRouter — modelos grátis (:free) (OPENROUTER_API_KEY)
  3. Gemini — gemini-flash-lite-latest (GEMINI_API_KEY)
  4. Anthropic — claude-haiku (ANTHROPIC_API_KEY + ANTHROPIC_WORKSPACE_ID)

Lógica de seleção inspirada no OpenMontage clip-factory:
  - Scoring multidimensional: hook, coherence, value, energy, platform_fit
  - Standalone test: clipe deve fazer sentido para espectador sem contexto
  - Cobertura do vídeo: evitar clustering numa mesma seção
"""
import json
import os
import re
import time

import httpx

# ─── configuração por env vars ───────────────────────────────────────────────
MAX_TOKENS = int(os.environ.get("AI_CURATOR_MAX_TOKENS", "4096"))
TIMEOUT = float(os.environ.get("AI_CURATOR_TIMEOUT", "90"))

# Gemini
GEMINI_MODEL = os.environ.get("AI_CURATOR_MODEL", "gemini-flash-lite-latest")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Groq
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_BASE = "https://api.groq.com/openai/v1"

# OpenRouter
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"


# ─── chamadas por provedor ────────────────────────────────────────────────────

def _call_openai_compat(base_url: str, api_key: str, model: str, prompt: str) -> str:
    """Chama qualquer API OpenAI-compatível (Groq, OpenRouter, Mistral…)."""
    payload = json.dumps(
        {
            "model": model,
            "max_tokens": MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    resp = httpx.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        content=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    choices = body.get("choices") or []
    if not choices:
        return ""
    if choices[0].get("finish_reason") == "length":
        raise RuntimeError(f"resposta truncada; aumente AI_CURATOR_MAX_TOKENS (atual={MAX_TOKENS})")
    return (choices[0]["message"].get("content") or "").strip()


def _call_gemini(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY não configurada")
    payload = json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": MAX_TOKENS},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    resp = httpx.post(
        f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent",
        headers={"Content-Type": "application/json; charset=utf-8", "x-goog-api-key": api_key},
        content=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    candidates = body.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
    if not text and candidates[0].get("finishReason") == "MAX_TOKENS":
        raise RuntimeError(f"resposta truncada; aumente AI_CURATOR_MAX_TOKENS (atual={MAX_TOKENS})")
    return text


def _call_anthropic(prompt: str) -> str:
    import anthropic
    workspace_id = os.environ.get("ANTHROPIC_WORKSPACE_ID", "")
    client = anthropic.Anthropic(
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        default_headers={"anthropic-workspace-id": workspace_id} if workspace_id else {},
        timeout=120.0,
    )
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def _try_providers(prompt: str) -> str:
    """Tenta provedores em ordem, com retries e backoff."""
    providers = []

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        providers.append(("groq", lambda p: _call_openai_compat(GROQ_BASE, groq_key, GROQ_MODEL, p)))

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if openrouter_key:
        providers.append(("openrouter", lambda p: _call_openai_compat(OPENROUTER_BASE, openrouter_key, OPENROUTER_MODEL, p)))

    if os.environ.get("GEMINI_API_KEY", ""):
        providers.append(("gemini", _call_gemini))

    if os.environ.get("ANTHROPIC_API_KEY", ""):
        providers.append(("anthropic", _call_anthropic))

    if not providers:
        print("[ai_curator] nenhuma chave de IA configurada")
        return ""

    for name, fn in providers:
        for tentativa in range(2):
            try:
                raw = fn(prompt)
                if raw:
                    print(f"[ai_curator] sucesso via {name}")
                    return raw
            except Exception as e:
                err_str = str(e)[:180]
                print(f"[ai_curator] {name} tentativa {tentativa + 1}/2 falhou: {type(e).__name__}: {err_str}")
                if "413" in err_str or "payload" in err_str.lower() or "too large" in err_str.lower():
                    # Payload too large: não faz retry, pula direto para próximo provedor
                    print(f"[ai_curator] {name} payload muito grande (413) — pulando para próximo provedor")
                    break
                elif "429" in err_str:
                    # Rate limit: espera mais antes de tentar o próximo
                    time.sleep(20 if tentativa == 0 else 0)
                elif tentativa == 0:
                    time.sleep(5)
        print(f"[ai_curator] {name} esgotado, tentando próximo provedor...")

    return ""


# ─── preparação da transcrição ────────────────────────────────────────────────

# Alias para compatibilidade e testes legados
_call_free_model = _try_providers


def prepare_full_transcript_timeline(segments: list[dict], max_chars: int = 20000) -> str:
    if not segments:
        return "[]"

    lines = []
    for s in segments:
        start_sec = round(float(s.get("start", 0)), 1)
        end_sec = round(float(s.get("end", 0)), 1)
        text = str(s.get("text", "")).strip()
        if not text:
            continue
        lines.append(f"[{start_sec}s - {end_sec}s] {text}")

    if not lines:
        return "[]"

    full_text = "\n".join(lines)
    if len(full_text) <= max_chars:
        return full_text

    # Amostragem uniforme — calcula quantas linhas cabem em max_chars
    avg_chars = max(1, len(full_text) // len(lines))
    target_lines = max(10, max_chars // avg_chars)
    step = max(1, len(lines) // target_lines)
    sampled = "\n".join(lines[::step])
    # Truncagem de segurança: nunca exceder max_chars (corta na última \n completa)
    if len(sampled) > max_chars:
        cut = sampled.rfind("\n", 0, max_chars)
        sampled = sampled[:cut] if cut > 0 else sampled[:max_chars]
    return sampled


# ─── curadoria principal ──────────────────────────────────────────────────────

def get_viral_clips(transcript_data: dict, clip_duration: str = "auto", chapters: list[dict] | None = None) -> list[dict]:
    """
    Retorna lista de cortes virais usando scoring multidimensional.
    Prompt inspirado no OpenMontage clip-factory/script-director.
    """
    segments = transcript_data.get("segments", [])
    if not segments:
        return []

    if chapters is None:
        chapters = transcript_data.get("chapters") or []

    if clip_duration == "30":
        duration_desc = "Cortes curtos de 25 a 45 segundos (dinâmicos, direto ao ponto)."
        min_duration, max_duration = 20, 45
    elif clip_duration == "60":
        duration_desc = "Cortes médios de 50 a 90 segundos (ideias desenvolvidas com clareza)."
        min_duration, max_duration = 40, 90
    else:
        duration_desc = (
            "Modo Automático Narrativo: escolha a duração ideal para cada história "
            "(mínimo 30s, máximo 300s / 5 min). Preserve início, desenvolvimento e conclusão completos."
        )
        min_duration, max_duration = 30, 300

    chapters_ctx = ""
    if chapters:
        chapters_ctx = f"\nCAPÍTULOS DO VÍDEO:\n{json.dumps(chapters[:15], ensure_ascii=False)}\n"

    timeline = prepare_full_transcript_timeline(segments)
    video_end = float(segments[-1].get("end", 600)) if segments else 600.0

    prompt = f"""Você é um editor de vídeo especializado em fragmentar vídeos longos em partes coerentes e compreensíveis.

TAREFA: Segmente o vídeo em TODOS os blocos de conteúdo com sentido próprio. Gere tantos clipes quanto existirem blocos naturais no vídeo — pode ser 3, pode ser 10 ou mais.

COMO SEGMENTAR:
1. Comece do início. Quando o locutor termina um assunto/história, esse é o fim do primeiro clipe.
2. Quando começa um novo assunto, começa um novo clipe. E assim por diante até o fim do vídeo.
3. Cada clipe deve ter começo, meio e fim dentro de seu próprio contexto — deve ser compreensível sozinho.
4. Se no meio de uma história o locutor se desviar para outro assunto e depois voltar, você pode ignorar esse desvio nos timestamps (o clipe cobre a história principal, o desvio pode ficar de fora).
5. Não pule nenhuma parte — cubra o vídeo inteiro do início ao fim, sem deixar buracos.

REGRAS:
- Cada clipe deve fazer sentido para quem assiste sem ter visto o restante do vídeo.
- Nunca comece um clipe no meio de uma frase ou raciocínio.
- Para cada clipe, escreva um hook_title em MAIÚSCULAS que seja um gancho viral para redes sociais. Use emoção, suspense, curiosidade ou impacto — como se fosse o título de um Reels ou Short que precisa parar o dedo de quem está rolando o feed. Exemplos bons: "ELE CHOROU AO VIVO QUANDO OUVIU ISSO", "NINGUÉM ESPERAVA ESSA RESPOSTA", "ISSO MUDA TUDO", "A VERDADE QUE NINGUÉM TE CONTA". NUNCA use títulos descritivos ou jornalísticos tipo "FULANO EXPLICA SEU PONTO DE VISTA".
- O ai_score representa quão autossuficiente e coeso é o clipe (0.70 = aceitável, 0.99 = excelente).

DURAÇÃO: {duration_desc}
(Mínimo: {min_duration}s | Máximo: {max_duration}s | Duração do vídeo: {int(video_end)}s)
{chapters_ctx}
TRANSCRIÇÃO COM TIMESTAMPS:
{timeline}

RESPOSTA: Retorne APENAS um array JSON válido sem markdown, sem texto extra. Cubra o vídeo inteiro:
[
  {{
    "start_time": <segundo exato de início>,
    "end_time": <segundo exato do fim>,
    "hook_title": "<GANCHO VIRAL EM MAIÚSCULAS, máx 60 chars — provoca curiosidade ou emoção>",
    "ai_score": <float 0.70-0.99>,
    "scores": {{"hook": <0-10>, "coherence": <0-10>, "value": <0-10>, "energy": <0-10>, "platform_fit": <0-10>}}
  }}
]"""

    raw = _try_providers(prompt)

    if not raw:
        print("[ai_curator] nenhum provedor disponível")
        return []

    # Parse robusto do JSON com fallback para markdown e colchetes externos
    clips = []
    try:
        cleaned_raw = raw.strip()
        if '```' in cleaned_raw:
            m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned_raw)
            if m:
                cleaned_raw = m.group(1).strip()
        
        try:
            parsed = json.loads(cleaned_raw)
            if isinstance(parsed, list):
                clips = parsed
            elif isinstance(parsed, dict):
                for k in ("clips", "cortes", "data", "results"):
                    if isinstance(parsed.get(k), list):
                        clips = parsed[k]
                        break
                if not clips:
                    for v in parsed.values():
                        if isinstance(v, list):
                            clips = v
                            break
        except Exception:
            # Busca do array mais externo [ ... ]
            first_b = cleaned_raw.find("[")
            last_b = cleaned_raw.rfind("]")
            if first_b != -1 and last_b > first_b:
                cand = cleaned_raw[first_b : last_b + 1]
                try:
                    parsed = json.loads(cand)
                    if isinstance(parsed, list):
                        clips = parsed
                except Exception as e:
                    print(f"[ai_curator] falha ao parsear array externo: {e}")
            # JSON truncado: fecha o array com ]} para recuperar clips completos
            if not clips and first_b != -1:
                truncated = cleaned_raw[first_b:]
                for suffix in ("]", "}]", "}]}"):
                    try:
                        parsed = json.loads(truncated + suffix)
                        if isinstance(parsed, list) and parsed:
                            clips = parsed[:-1] if len(parsed) > 1 else parsed
                            print(f"[ai_curator] JSON truncado recuperado: {len(clips)} clips completos")
                            break
                    except Exception:
                        pass
    except Exception as e:
        print(f"[ai_curator] erro geral de parse: {e}")

    if not clips:
        print(f"[ai_curator] resposta bruta da IA sem JSON válido (primeiros 300 chars):\n{raw[:300]}")

    # Validação e saneamento
    validated = []
    for c in clips[:15]:
        try:
            start = max(0.0, float(c.get("start_time", 0)))
            end = float(c.get("end_time", start + 60))
            if end <= start:
                end = start + 60

            dur = end - start
            if dur > max_duration:
                end = start + max_duration
            elif dur < min_duration:
                end = min(video_end, start + min_duration)
            end = min(end, video_end)

            hook_title = str(c.get("hook_title", "CORTE VIRAL")).strip().replace('"', '').replace("'", "")
            if len(hook_title) > 60:
                hook_title = hook_title[:57] + "..."

            ai_score = round(min(0.99, max(0.60, float(c.get("ai_score", 0.85)))), 2)

            validated.append({
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "hook_title": hook_title,
                "ai_score": ai_score,
            })
        except Exception as parse_err:
            print(f"[ai_curator] erro ao validar clipe: {parse_err}")

    return validated
