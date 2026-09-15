"""
Ajuste dos limites de corte às palavras da transcrição.

Os tempos escolhidos pela IA caem em qualquer ponto da fala; cortar ali corta
palavras ao meio. Aqui o início vai para o começo da primeira palavra do trecho
e o fim para o término da última, com uma folga pequena que absorve o desvio
de 50–100ms dos timestamps do Whisper.
"""

CUT_PADDING = 0.05
MAX_SHIFT = 1.5


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
