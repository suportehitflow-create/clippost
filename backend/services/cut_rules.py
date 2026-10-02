"""
Ajuste dos limites de corte às palavras da transcrição.

Os tempos escolhidos pela IA caem em qualquer ponto da fala; cortar ali corta
palavras ao meio. Aqui o início vai para o começo da primeira palavra do trecho
e o fim para o término da última, com uma folga pequena que absorve o desvio
de 50–100ms dos timestamps do Whisper.
"""

CUT_PADDING = 0.05
MAX_SHIFT = 1.5

# Fim de frase: pontuação no fim da palavra ou uma pausa na fala
_FIM_DE_FRASE = (".", "?", "!", "…")
PAUSA_FRASE = 0.5      # segundos de silêncio entre palavras que contam como fim de frase
VOLTA_MAX = 6.0        # quanto o início pode recuar para pegar o começo da frase
AVANCO_MAX = 6.0       # quanto o fim pode avançar para fechar a frase
AJUSTE_CURTO = 3.0     # na direção contrária (encurtando), no máximo isto


def ajustar_a_frases(start: float, end: float, words: list[dict]) -> tuple[float, float]:
    """Leva o início para o começo de uma frase e o fim para o fim de uma frase, para o corte não
    começar nem terminar no meio da fala. Fronteira = palavra que termina com . ? ! … ou pausa.
    Sem fronteiras perto (ex.: legenda automática sem pontuação nem pausas), mantém como está."""
    if not words or len(words) < 2:
        return start, end
    inicios, fins = [], []  # tempos onde uma frase começa / termina
    for i, w in enumerate(words):
        txt = str(w.get("word") or w.get("text") or "").strip()
        ant = words[i - 1] if i else None
        if ant is None or str(ant.get("word") or "").strip().endswith(_FIM_DE_FRASE) or w["start"] - ant["end"] >= PAUSA_FRASE:
            inicios.append(w["start"])
        prox = words[i + 1] if i + 1 < len(words) else None
        if prox is None or txt.endswith(_FIM_DE_FRASE) or prox["start"] - w["end"] >= PAUSA_FRASE:
            fins.append(w["end"])

    novo_ini = start
    antes = [t for t in inicios if start - VOLTA_MAX <= t <= start + 0.05]
    depois = [t for t in inicios if start < t <= start + AJUSTE_CURTO]
    if antes:
        novo_ini = max(antes)
    elif depois:
        novo_ini = min(depois)

    novo_fim = end
    adiante = [t for t in fins if end - 0.05 <= t <= end + AVANCO_MAX]
    atras = [t for t in fins if end - AJUSTE_CURTO <= t < end]
    if adiante:
        novo_fim = min(adiante)
    elif atras:
        novo_fim = max(atras)

    if novo_fim - novo_ini < max(5.0, (end - start) * 0.6):
        return start, end  # o ajuste destruiria o corte: fica como a IA escolheu
    return novo_ini, novo_fim


def limites_do_corte(start: float, end: float, words: list[dict]) -> tuple[float, float]:
    """Frase inteira + encaixe nas palavras (com a folga do Whisper)."""
    return snap_to_words(*ajustar_a_frases(start, end, words), words)


def snap_to_words(start: float, end: float, words: list[dict],
                  padding: float = CUT_PADDING, max_shift: float = MAX_SHIFT) -> tuple[float, float]:
    if not words:
        return start, end

    new_start = start
    first = next((w for w in words if w["end"] > start), None)
    if first and abs(first["start"] - start) <= max_shift:
        new_start = first["start"]

    new_end = end
    last = next((w for w in reversed(words) if w["start"] < end), None)
    if last and abs(last["end"] - end) <= max_shift:
        new_end = last["end"]

    new_start = max(0.0, new_start - padding)
    new_end = new_end + padding

    # Um ajuste que encolha o trecho demais indica transcrição esparsa; mantém o original.
    if new_end - new_start < 1.0:
        return start, end
    return round(new_start, 3), round(new_end, 3)
