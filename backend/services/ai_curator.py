"""
AI Curator — Diretor de Criação e Roteirista de Cortes Virais para Reels, TikTok e Shorts.

Analisa a narrativa completa do vídeo longo, identifica histórias completas (início, meio e fim)
e gera clipes com alta retenção e ganchos magnéticos.
"""
import json
import os
import re
import time

import httpx

BASE_URL = os.environ.get("AI_CURATOR_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
MODEL = os.environ.get("AI_CURATOR_MODEL", "gemini-1.5-flash")
MAX_TOKENS = int(os.environ.get("AI_CURATOR_MAX_TOKENS", "4096"))
API_KEY = (
    os.environ.get("AI_CURATOR_API_KEY")
    or os.environ.get("GEMINI_API_KEY")
    or os.environ.get("OPENROUTER_API_KEY", "")
)


def _call_free_model(prompt: str) -> str:
    resp = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60.0,  # 1min por tentativa — max total 2min, não 9min
    )
    resp.raise_for_status()
    body = resp.json()
    if not isinstance(body, dict):
        raise RuntimeError(f"resposta inesperada da API: {str(body)[:200]}")
    choices = body.get("choices") or []
    if not choices:
        return ""
    if choices[0].get("finish_reason") == "length":
        raise RuntimeError(
            f"resposta truncada em max_tokens={MAX_TOKENS}; aumente AI_CURATOR_MAX_TOKENS"
        )
    return (choices[0]["message"].get("content") or "").strip()


def _call_anthropic(prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic(
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        timeout=120.0,  # 2 minutos max — fallback de último recurso
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def prepare_full_transcript_timeline(segments: list[dict], max_chars: int = 45000) -> str:
    """
    Compacta a transcrição do vídeo INTEIRO com timestamps claros para o modelo analisar
    a narrativa completa de ponta a ponta, sem descartar o meio ou o final do vídeo.
    """
    if not segments:
        return "[]"

    lines = []
    total_len = 0
    for s in segments:
        start_sec = round(float(s.get("start", 0)), 1)
        end_sec = round(float(s.get("end", 0)), 1)
        text = str(s.get("text", "")).strip()
        if not text:
            continue
        line = f"[{start_sec}s - {end_sec}s] {text}"
        total_len += len(line) + 1
        lines.append(line)

    full_text = "\n".join(lines)
    if len(full_text) <= max_chars:
        return full_text

    # Se o vídeo for gigantesco (horas), seleciona amostras uniformes cobrindo 100% da linha do tempo
    step = max(1, len(lines) // 400)
    sampled = lines[::step]
    return "\n".join(sampled)


def get_viral_clips(transcript_data: dict, clip_duration: str = "auto", chapters: list[dict] | None = None) -> list[dict]:
    """
    Recebe transcript_data (dict com 'segments' e 'words') e retorna
    uma lista de cortes virais estruturados com narrativa completa (início, meio e fim).
    """
    segments = transcript_data.get("segments", [])
    if not segments:
        return []

    if chapters is None:
        chapters = transcript_data.get("chapters") or []

    # Configuração de duração conforme a intenção do usuário
    if clip_duration == "30":
        duration_desc = "Cortes curtos de 25 a 45 segundos (dinâmicos, direto ao ponto)."
        min_duration = 20
        max_duration = 45
    elif clip_duration == "60":
        duration_desc = "Cortes médios de 50 a 90 segundos (ideias desenvolvidas com clareza)."
        min_duration = 40
        max_duration = 90
    else:  # auto
        duration_desc = (
            "Modo Automático Narrativo: A IA decide a duração IDEAL da história completa "
            "(de 30 segundos até 300 segundos / 5 minutos). "
            "Se for uma história longa cativante, mantenha o início, meio e conclusão completa sem cortar a história pela metade!"
        )
        min_duration = 25
        max_duration = 300  # até 5 minutos no automático!

    chapters_context = ""
    if chapters and len(chapters) > 0:
        chapters_context = f"\nCapítulos do Vídeo:\n{json.dumps(chapters[:15], ensure_ascii=False)}\n"

    timeline_text = prepare_full_transcript_timeline(segments)

    prompt = f"""Você é o Diretor de Criação e Especialista em Conteúdo Viral para Instagram Reels, TikTok e YouTube Shorts.

Sua missão é ler a transcrição abaixo e extrair os 3 MELHORES CORTES NARRATIVOS do vídeo.

O QUE É UM CORTE VIRAL DE SUCESSO:
1. GANCHO PODEROSO (Primeiros 3 segundos):
   - Deve começar com uma quebra de padrão, pergunta contundente, afirmação polêmica ou choque de curiosidade.
   - NUNCA comece com introduções vazias ("Oi pessoal", "Então galera", "No vídeo de hoje").
2. NARRATIVA COMPLETA (Desenvolvimento sem enrolação):
   - O corte DEVE contar uma história ou raciocínio completo com início, meio e fim.
   - Não corte no meio de uma frase ou no clímax do assunto!
3. DESFECHO / CONCLUSÃO / LIÇÃO (Final satisfatório):
   - O corte deve terminar quando a ideia atinge sua conclusão, lição moral ou desfecho emocionante.

DURAÇÃO SOLICITADA:
{duration_desc}
(Mínimo aceitável: {min_duration}s, Máximo aceitável: {max_duration}s)

{chapters_context}
TRANSCRIÇÃO COMPLETA DO VÍDEO COM TIMESTAMPS:
{timeline_text}

INSTRUÇÃO DE RESPOSTA:
Retorne ESTRITAMENTE um array JSON válido contendo exatamente 3 objetos, sem markdown, sem explicações adicionais:
[
  {{
    "start_time": <float com o segundo exato onde começa o gancho>,
    "end_time": <float com o segundo exato onde termina a conclusão>,
    "hook_title": "<Título magnético em caixa alta para a headline do Reels, máx 60 caracteres>",
    "ai_score": <float entre 0.70 e 0.99 estimando a taxa de retenção/viralidade>
  }}
]"""

    raw = ""
    if API_KEY:
        for tentativa in range(2):  # max 2×60s = 2min, não 3×180s = 9min
            try:
                raw = _call_free_model(prompt)
                break
            except Exception as e:
                print(f"[ai_curator] tentativa {tentativa + 1}/2 falhou ({type(e).__name__}: {e})")
                if tentativa < 1:
                    time.sleep(3)

    if not raw and os.environ.get("ANTHROPIC_API_KEY"):
        print("[ai_curator] usando Anthropic como reserva")
        raw = _call_anthropic(prompt)

    if not raw:
        print("[ai_curator] nenhum provedor disponível")
        return []

    try:
        clips = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\[\s*\{.*?\}\s*\]', raw, re.DOTALL)
        if match:
            try:
                clips = json.loads(match.group())
            except Exception:
                clips = []
        else:
            clips = []

    # Validação e saneamento dos cortes
    validated = []
    video_max_time = float(segments[-1].get("end", 600)) if segments else 600.0

    for c in clips[:3]:
        try:
            start = max(0.0, float(c.get("start_time", 0)))
            end = float(c.get("end_time", start + 60))
            if end <= start:
                end = start + 60

            # Limites flexíveis respeitando o modo automático
            dur = end - start
            if dur > max_duration:
                end = start + max_duration
            elif dur < min_duration:
                end = min(video_max_time, start + min_duration)

            end = min(end, video_max_time)

            hook_title = str(c.get("hook_title", "CORTE VIRAL EXCLUSIVO")).strip()
            # Limpa aspas
            hook_title = hook_title.replace('"', '').replace("'", "")
            if len(hook_title) > 60:
                hook_title = hook_title[:57] + "..."

            ai_score = float(c.get("ai_score", 0.85))
            ai_score = round(min(0.99, max(0.60, ai_score)), 2)

            validated.append({
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "hook_title": hook_title,
                "ai_score": ai_score,
            })
        except Exception as parse_err:
            print(f"[ai_curator] erro ao validar clipe: {parse_err}")

    return validated
