"""
AI Curator — Diretor de Criação e Roteirista de Cortes Virais para Reels, TikTok e Shorts.

Suporte multi-provedor (em ordem de prioridade):
  1. Gemini — gemini-flash-lite-latest (GEMINI_API_KEY)
  2. Groq  — llama-3.3-70b, grátis, ultra-rápido (GROQ_API_KEY)
  3. OpenRouter — modelos grátis (:free) (OPENROUTER_API_KEY)

Lógica de seleção inspirada no OpenMontage clip-factory:
  - Scoring multidimensional: hook, coherence, value, energy, platform_fit
  - Standalone test: clipe deve fazer sentido para espectador sem contexto
  - Cobertura do vídeo: evitar clustering numa mesma seção
"""
import json
from pathlib import Path
import os
import re
import time

import httpx

# ─── configuração por env vars ───────────────────────────────────────────────
MAX_TOKENS = int(os.environ.get("AI_CURATOR_MAX_TOKENS", "8192"))
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
            "temperature": 0.2,
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
            # o roteiro do manual (falas com tempo de cada corte) é longo: o Gemini aguenta bem mais que 8k
            "generationConfig": {"maxOutputTokens": max(MAX_TOKENS, int(os.environ.get("GEMINI_MAX_TOKENS", "24000"))), "temperature": 0.2},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    # modelo sobrecarregado (503) ou fora do ar (404/500): tenta os irmãos antes de desistir do Gemini
    modelos = [GEMINI_MODEL] + [m for m in ("gemini-2.5-flash-lite", "gemini-2.5-flash") if m != GEMINI_MODEL]
    for i, modelo in enumerate(modelos):
        resp = httpx.post(
            f"{GEMINI_BASE}/{modelo}:generateContent",
            headers={"Content-Type": "application/json; charset=utf-8", "x-goog-api-key": api_key},
            content=payload,
            timeout=TIMEOUT,
        )
        if resp.status_code in (404, 500, 503) and i < len(modelos) - 1:
            print(f"[ai_curator] gemini {modelo}: HTTP {resp.status_code} — tentando {modelos[i + 1]}")
            continue
        break
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


def _try_providers(prompt: str) -> str:
    """Tenta provedores em ordem, com retries e backoff."""
    providers = []

    if os.environ.get("GEMINI_API_KEY", ""):
        providers.append(("gemini", _call_gemini))

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        providers.append(("groq", lambda p: _call_openai_compat(GROQ_BASE, groq_key, GROQ_MODEL, p)))

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if openrouter_key:
        providers.append(("openrouter", lambda p: _call_openai_compat(OPENROUTER_BASE, openrouter_key, OPENROUTER_MODEL, p)))

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


def prepare_full_transcript_timeline(segments: list[dict], max_chars: int = 450000) -> str:
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

    # Para vídeos muito longos que passem de 150k caracteres, amostra mantendo blocos contínuos
    avg_chars = max(1, len(full_text) // len(lines))
    target_lines = max(10, max_chars // avg_chars)
    step = max(1, len(lines) // target_lines)
    sampled = "\n".join(lines[::step])
    if len(sampled) > max_chars:
        cut = sampled.rfind("\n", 0, max_chars)
        sampled = sampled[:cut] if cut > 0 else sampled[:max_chars]
    return sampled


# ─── curadoria principal ──────────────────────────────────────────────────────

INTRO_REGEX = re.compile(
    r"\b("
    r"(oi|ol[aá]|fala|e\s+a[íi]|salve)\s+(galera|pessoal|gente|turma|amigos|fam[íi]lia|rapaziada)"
    r"|seja[m]?\s+muito\s+bem[- ]vindo[s]?"
    r"|seja[m]?\s+bem[- ]vindo[s]?"
    r"|bem[- ]vindo[s]?\s+a\s+mais\s+um"
    r"|hoje\s+(eu\s+)?(estou|vou|vamos|n[óo]s)\s+(aqui|mostrar|falar|gravar|apresentar)"
    r"|neste\s+v[íi]deo|nesse\s+v[íi]deo"
    r"|antes\s+de\s+(come[çc]ar|iniciar)"
    r"|j[áa]\s+deixa\s+o\s+like|deixa\s+o\s+like\s+no\s+come[çc]o"
    r"|roda\s+a\s+vinheta"
    r")\b",
    re.IGNORECASE
)

OUTRO_REGEX = re.compile(
    r"\b("
    r"deixa\s+o\s+like|deixe\s+o\s+seu\s+like|deixa\s+seu\s+like|curte\s+o\s+v[íi]deo|curta\s+o\s+v[íi]deo"
    r"|se\s+inscreve|se\s+inscreva|inscreva-se"
    r"|ativa\s+o\s+sininho|ative\s+o\s+sininho|notifica[çc][õo]es"
    r"|deixa\s+(a[íi]\s+)?nos\s+coment[áa]rios|comenta\s+aqui\s+embaixo"
    r"|compartilha\s+com|compartilhe\s+com"
    r"|at[ée]\s+o\s+pr[óo]ximo|at[ée]\s+a\s+pr[óo]xima|at[ée]\s+mais|at[ée]\s+semana\s+que\s+vem"
    r"|valeu\s+falou|valeu\s+fui|tchau\s+tchau|um\s+grande\s+abra[çc]o|um\s+forte\s+abra[çc]o|fui\s+tchau"
    r"|link\s+na\s+descri[çc][ãa]o|link\s+na\s+bio"
    r")\b",
    re.IGNORECASE
)


def trim_clip_intro_outro(start: float, end: float, segments: list[dict], min_len: float = 20.0) -> tuple[float, float]:
    """
    Remove saudações iniciais (intro) e pedidos de like/despedidas (outro) das bordas do clipe.
    """
    if not segments:
        return start, end

    clip_segs = [s for s in segments if float(s.get("end", 0)) > start and float(s.get("start", 0)) < end]
    if not clip_segs:
        return start, end

    new_start = start
    new_end = end

    # Checa os 2 primeiros segmentos (janela inicial de até 15s)
    for s in clip_segs[:2]:
        s_end = float(s.get("end", 0))
        text = str(s.get("text", ""))
        if (s_end - new_start) <= 15.0 and INTRO_REGEX.search(text):
            if (new_end - s_end) >= min_len:
                new_start = s_end

    # Checa os 2 últimos segmentos (janela final de até 15s)
    for s in reversed(clip_segs[-2:]):
        s_start = float(s.get("start", 0))
        text = str(s.get("text", ""))
        if (new_end - s_start) <= 15.0 and OUTRO_REGEX.search(text):
            if (s_start - new_start) >= min_len:
                new_end = s_start

    return round(new_start, 2), round(new_end, 2)


def get_viral_clips(transcript_data: dict, clip_duration: str = "auto", chapters: list[dict] | None = None) -> list[dict]:
    """
    Retorna lista de cortes virais usando scoring multidimensional.
    Exclui introdução ("oi galera", saudações) e encerramento (pedidos de like, despedidas).
    Garante teto de 90 segundos no modo automático (1 minuto e meio).
    """
    segments = transcript_data.get("segments", [])
    if not segments:
        return []

    if chapters is None:
        chapters = transcript_data.get("chapters") or []

    # Configuração de limites conforme escolha do usuário
    if clip_duration == "30":
        duration_desc = "Cortes curtos de 20 a 45 segundos (dinâmicos, rápidos e direto ao ponto)."
        min_duration, max_duration = 20, 45
    elif clip_duration == "60":
        duration_desc = "Cortes padrão de 35 a 60 segundos (tempo ideal para Shorts, TikTok e Reels)."
        min_duration, max_duration = 35, 60
    elif clip_duration == "90":
        duration_desc = "Cortes médios de 50 a 90 segundos (1 minuto e meio máximo)."
        min_duration, max_duration = 50, 90
    elif clip_duration == "120":
        duration_desc = "Cortes longos de 60 a 120 segundos (máximo 2 minutos)."
        min_duration, max_duration = 60, 120
    else:
        # Modo Automático Viral com rica variedade narrativa solicitada pelo usuário:
        # O objetivo é respeitar a história coesa: punchlines curtas (25-45s), histórias médias (50-80s)
        # e debates/argumentos profundos (85-120s, até 2 minutos). NUNCA concentre todos os cortes em ~43s!
        duration_desc = (
            "Modo Automático com VARIEDADE NARRATIVA DINÂMICA: "
            "Tenha uma distribuição equilibrada e diversificada entre os cortes: "
            "1. Cortes rápidos (25s a 45s): punchlines afiadas, ganchos e momentos de choque; "
            "2. Cortes médios (50s a 80s): histórias curtas, ensinamentos e explicações práticas; "
            "3. Cortes longos e profundos (85s a 125s - até 2 minutos): histórias completas, debates intensos e raciocínios com início, meio e conclusão forte. "
            "CRUCIAL: NÃO gere todos os cortes com a mesma duração (~40s). Varie intencionalmente respeitando a narrativa natural!"
        )
        min_duration, max_duration = 25, 125

    chapters_ctx = ""
    if chapters:
        chapters_ctx = f"\nCAPÍTULOS DO VÍDEO:\n{json.dumps(chapters[:20], ensure_ascii=False)}\n"

    timeline = prepare_full_transcript_timeline(segments)
    video_end = float(segments[-1].get("end", 600)) if segments else 600.0

    # Meta de cortes proporcional ao tamanho real do vídeo (podcasts longos precisam de muitos cortes!)
    if video_end <= 300:        # até 5 min
        min_clips_target, max_clips_target = 3, 5
    elif video_end <= 900:      # 5 a 15 min
        min_clips_target, max_clips_target = 5, 8
    elif video_end <= 1800:     # 15 a 30 min
        min_clips_target, max_clips_target = 8, 12
    elif video_end <= 3600:     # 30 a 60 min (ex: podcast de 36 min)
        min_clips_target, max_clips_target = 10, 16
    else:                       # mais de 1 hora
        min_clips_target, max_clips_target = 12, 20

    manual = _manual()
    if manual:
        prompt = _montar_prompt(manual, timeline, duration_desc, min_duration, max_duration, video_end, chapters_ctx,
                                (min_clips_target, max_clips_target))
    else:
        prompt = f"""Você é um editor de vídeo sênior especializado em cortes virais (Shorts, Reels, TikTok) a partir de podcasts, entrevistas e vídeos longos.

    TAREFA OBRIGATÓRIA:
    Identificar e extrair os melhores blocos de conteúdo de ALTO IMPACTO, curiosidade, choque, revelação, storytelling magnético, humor ou ensinamentos profundos.
    Este vídeo possui {int(video_end // 60)} minutos de duração. Por ser um vídeo de {int(video_end // 60)} minutos, você DEVE gerar OBRIGATORIAMENTE entre {min_clips_target} e {max_clips_target} cortes virais de altíssimo nível, distribuídos proporcionalmente ao longo de TODO o vídeo (início, meio e fim)! NUNCA gere menos que {min_clips_target} cortes.

    ⚠️ REGRAS RIGOROSAS DE EXCLUSÃO (FILTRO OBRIGATÓRIO):
    1. EXCLUA TOTALMENTE A INTRODUÇÃO / ABERTURA:
       - NUNCA comece um clipe com saudações ("oi galera", "fala pessoal", "e aí galera", "sejam bem-vindos", "olá a todos").
       - NUNCA inclua vinhetas, enrolações de início de vídeo, apresentações demoradas de convidados ou patrocinadores na abertura.
       - O clipe DEVE começar direto na fala interessante, no gancho provocativo ou no assunto central daquele momento.

    2. EXCLUA TOTALMENTE A FINALIZAÇÃO / ENCERRAMENTO:
       - NUNCA inclua pedidos de like ("deixa o like", "se inscreva no canal", "ativa as notificações", "deixe nos comentários", "compartilha").
       - NUNCA inclua despedidas de fim de vídeo ("até a próxima", "valeu fui", "um forte abraço", "fui tchau", "tchau tchau") ou chamadas para outros vídeos.
       - O clipe DEVE terminar imediatamente após a conclusão da história, reflexão ou punchline, ANTES de qualquer encerramento de canal.

    3. FOCO EXCLUSIVO NAS PARTES MAIS INTERESSANTES:
       - Não tente cobrir o vídeo inteiro. Ignore partes mornas, repetições, bate-papo sem propósito ou enrolação.
       - Cada clipe selecionado deve ser autossuficiente (começo, meio e conclusão lógica compreensíveis sem precisar ver o resto do vídeo).
       - NUNCA inicie ou termine cortando uma frase ao meio ou no meio de uma palavra.

    4. TÍTULO VIRAL (hook_title):
       - Em MAIÚSCULAS, até 60 caracteres. Deve gerar curiosidade irresistível, urgência ou impacto emocional para parar a rolagem no feed.
       - Exemplos: "EU GASTEI 3 MIL REAIS NISSO E ME ARREPENDI", "O SEGREDO DOS BILIONÁRIOS QUE NINGUÉM CONTA", "A VERDADE QUE VAI TE CHOCAR".
       - NUNCA use títulos descritivos ou neutros tipo "FULANO EXPLICA SEU PONTO DE VISTA".
       - O ai_score representa quão autossuficiente e coeso é o clipe (0.70 = aceitável, 0.99 = excelente).

    DURAÇÃO: {duration_desc}
    (Mínimo: {min_duration}s | Máximo flexível: {max_duration}s [até 2 minutos para histórias ricas] | Duração do vídeo: {int(video_end)}s)
    {chapters_ctx}
    TRANSCRIÇÃO COM TIMESTAMPS:
    {timeline}

    RESPOSTA: Retorne APENAS um array JSON válido sem markdown, sem texto extra, contendo apenas os melhores cortes:
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
    clips = _extrair_clips(raw) if raw else []

    # Transcrição grande demais para o provedor que respondeu (ex.: Gemini fora e o Groq recusa pelo
    # tamanho): divide em blocos que cabem e pede os melhores cortes de cada um
    if not clips and len(timeline) > _BLOCO_CHARS:
        print("[ai_curator] sem cortes com a transcrição inteira — tentando em blocos menores")
        clips = _curadoria_em_blocos(segments, duration_desc, min_duration, max_duration, video_end, max_clips_target)
    elif len(clips) < min_clips_target and len(timeline) > _BLOCO_CHARS:
        print(f"[ai_curator] só {len(clips)} corte(s) para {int(video_end // 60)} min — completando trecho por trecho")
        extras = _curadoria_em_blocos(segments, duration_desc, min_duration, max_duration, video_end, max_clips_target)
        clips = _juntar_sem_repetir(clips, extras)

    return _validar(clips, segments, min_duration, max_duration, video_end)


_BLOCO_CHARS = 16000  # ~5 mil tokens: cabe no limite por minuto do Groq gratuito
_MAX_CORTES = int(os.environ.get("AI_CURATOR_MAX_CORTES", "25"))  # renderizar dezenas de cortes demora
_MANUAL = Path(__file__).resolve().parent.parent / "prompts" / "curador_cortes.txt"


def _manual() -> str:
    """Manual do editor (prompt fixo do usuário) — relido a cada vídeo, então editar o arquivo já vale."""
    try:
        return _MANUAL.read_text(encoding="utf-8")
    except OSError:
        return ""


def _montar_prompt(manual: str, transcricao: str, duration_desc: str, min_duration: int, max_duration: int,
                   video_end: float, chapters_ctx: str, quantos: tuple[int, int] | None = None) -> str:
    duracao = ("TÍTULOS: até 60 caracteres, com 1 ou 2 emojis que combinem com o assunto (ex.: 😱 🔥 💰 🤯 😂).\n"
               f"DURAÇÃO DE CADA CORTE: {duration_desc} (mínimo {min_duration}s, máximo {max_duration}s). "
               f"O vídeo tem {int(video_end)}s ({int(video_end // 60)} min).")
    if quantos:
        duracao += (f"\nQUANTIDADE OBRIGATÓRIA: entregue ENTRE {quantos[0]} E {quantos[1]} cortes, espalhados do início "
                    f"ao fim da transcrição. NUNCA entregue menos que {quantos[0]} cortes.")
    # replace (não format): o manual tem chaves do exemplo de JSON
    return (manual.replace("{duracao}", duracao).replace("{capitulos}", chapters_ctx or "")
            .replace("{transcricao}", transcricao))


def _mmss(v) -> float | None:
    """'12:34' ou '1:02:03' ou número → segundos."""
    if isinstance(v, (int, float)):
        return float(v)
    m = re.match(r"^\s*(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)\s*$", str(v or ""))
    if not m:
        return None
    h, mi, s = m.groups()
    return int(h or 0) * 3600 + int(mi) * 60 + float(s)


def _normalizar(c: dict) -> dict:
    """Campos do manual (titulo, inicio, fim, nota, tempo "MM:SS - MM:SS"…) → formato interno."""
    if not isinstance(c, dict):
        return c
    ini, fim = c.get("start_time", c.get("inicio")), c.get("end_time", c.get("fim"))
    if (ini is None or fim is None) and c.get("tempo"):
        partes = str(c["tempo"]).strip("[]` ").split("-")
        if len(partes) == 2:
            ini, fim = ini if ini is not None else _mmss(partes[0]), fim if fim is not None else _mmss(partes[1])
    nota = c.get("ai_score")
    if nota is None and c.get("nota") is not None:
        try:
            nota = float(str(c["nota"]).split("/")[0].replace(",", ".")) / 10
        except ValueError:
            nota = None
    return {
        **c,
        "start_time": _mmss(ini) if isinstance(ini, str) else ini,
        "end_time": _mmss(fim) if isinstance(fim, str) else fim,
        "hook_title": c.get("hook_title") or c.get("titulo") or "CORTE VIRAL",
        "ai_score": nota if nota is not None else 0.85,
    }


def _juntar_sem_repetir(base: list, extras: list) -> list:
    """Adiciona os extras que não repetem (mais da metade sobreposta) um corte já escolhido."""
    def faixa(c):
        try:
            return float(c.get("start_time")), float(c.get("end_time"))
        except (TypeError, ValueError):
            return None
    juntos = list(base)
    for e in extras:
        fe = faixa(e)
        if not fe or fe[1] <= fe[0]:
            continue
        repete = False
        for c in juntos:
            fc = faixa(c)
            if not fc:
                continue
            sobra = min(fe[1], fc[1]) - max(fe[0], fc[0])
            if sobra > 0.5 * min(fe[1] - fe[0], max(1.0, fc[1] - fc[0])):
                repete = True
                break
        if not repete:
            juntos.append(e)
    return juntos


def _curadoria_em_blocos(segments: list[dict], duration_desc: str, min_duration: int, max_duration: int,
                         video_end: float, max_total: int) -> list[dict]:
    linhas = [f"[{round(float(s.get('start', 0)), 1)}s - {round(float(s.get('end', 0)), 1)}s] {str(s.get('text', '')).strip()}"
              for s in segments if str(s.get("text", "")).strip()]
    blocos, atual = [], []
    for l in linhas:
        if atual and sum(len(x) + 1 for x in atual) + len(l) > _BLOCO_CHARS:
            blocos.append(atual)
            atual = []
        atual.append(l)
    if atual:
        blocos.append(atual)
    por_bloco = max(2, min(6, -(-max_total // max(1, len(blocos))) + 1))
    todos = []
    for i, b in enumerate(blocos[:24]):
        manual = _manual()
        if manual:
            trecho = (f"ATENÇÃO: este é só um TRECHO (parte {i + 1} de {len(blocos)}) de um vídeo longo; "
                      "extraia os cortes deste trecho.\n" + "\n".join(b))
            prompt = _montar_prompt(manual, trecho, duration_desc, min_duration, max_duration, video_end, "",
                                    (max(1, por_bloco - 2), por_bloco))
        else:
            prompt = (
                "Você é um editor de cortes virais (Reels, TikTok, Shorts). Abaixo está UM TRECHO da transcrição de um vídeo "
                f"longo (parte {i + 1} de {len(blocos)}). Escolha até {por_bloco} cortes autossuficientes, com gancho forte, "
                "sem saudações nem pedidos de like, começando e terminando em frases completas.\n"
                f"DURAÇÃO: {duration_desc} (mínimo {min_duration}s, máximo {max_duration}s)\n"
                "hook_title: EM MAIÚSCULAS, até 60 caracteres, que gere curiosidade.\n\n"
                "TRECHO:\n" + "\n".join(b) + "\n\n"
                'Responda SÓ com um array JSON: [{"start_time": <s>, "end_time": <s>, "hook_title": "...", "ai_score": <0.70-0.99>}]'
            )
        raw = _try_providers(prompt)
        achados = _extrair_clips(raw) if raw else []
        print(f"[ai_curator] bloco {i + 1}/{len(blocos)}: {len(achados)} corte(s)")
        todos.extend(achados)
    todos.sort(key=lambda c: float(c.get("ai_score") or 0), reverse=True)
    return todos[:max(max_total, 3)]


def _extrair_clips(raw: str) -> list:
    """Parse robusto do JSON (markdown, colchetes externos, JSON truncado)."""
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
    return [_normalizar(c) for c in clips if isinstance(c, dict)]


def _validar(clips: list, segments: list[dict], min_duration: int, max_duration: int, video_end: float) -> list[dict]:
    """Saneamento: filtro de intro/outro nas bordas e limites de duração."""
    validated = []
    clips = sorted(clips, key=lambda c: float(c.get("ai_score") or 0), reverse=True)[:_MAX_CORTES]
    for c in clips:
        try:
            start = max(0.0, float(c.get("start_time", 0)))
            end = float(c.get("end_time", start + 60))
            if end <= start:
                end = start + 60

            # 1. Filtro inteligente de intro/outro nas bordas do clipe
            start, end = trim_clip_intro_outro(start, end, segments, min_len=min_duration)

            # 2. Respeito rigoroso aos limites de duração (máx 90s no modo automático)
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
                # roteiro do manual (contexto, falas com tempo, por que vai viralizar)
                "contexto": c.get("contexto"),
                "falas": c.get("falas"),
                "por_que": c.get("por_que_vai_viralizar"),
            })
        except Exception as parse_err:
            print(f"[ai_curator] erro ao validar clipe: {parse_err}")

    return validated


def generate_hook_title(transcript_text: str, original_title: str = "") -> str:
    """Título-gancho em MAIÚSCULAS para um vídeo curto inteiro (edição em massa)."""
    fallback = re.sub(r"[#@]\S+", "", original_title or "").strip().upper()[:60]
    text = (transcript_text or "").strip()[:4000]
    if not text and not fallback:
        return ""
    prompt = f"""Escreva UM título-gancho viral em português para este vídeo curto de Reels/TikTok.
Regras: MAIÚSCULAS, no máximo 60 caracteres, sem hashtags, sem aspas, terminando com 1 emoji que combine com o assunto.
Provoque curiosidade ou emoção, como quem quer parar o dedo de quem rola o feed.
Responda apenas com o título.

Legenda original: {original_title[:300]}
Transcrição: {text or "(sem fala)"}"""
    lines = (_try_providers(prompt) or "").strip().splitlines()
    title = re.sub(r"[\"'*#`]", "", lines[0]).strip().upper() if lines else ""
    return title[:60] if title else fallback
