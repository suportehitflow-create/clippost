"""
Subtitle Generator — converte transcrições do Whisper em legendas virais .ass
com suporte completo aos presets de estilo do Template do Clippost:
- hormozi_yellow: Destaque amarelo (#facc15) com texto preto em caixa (pill)
- hormozi_orange: Destaque laranja (#ea580c) com texto branco em caixa (pill)
- clean_white: Caixa branca (#ffffff) com texto escuro
- dark_box: Caixa escura (#18181b) com texto laranja de alto contraste
- neon_cyan: Texto ciano (#22d3ee) fluorescente com contorno preto grosso
- neon_magenta: Texto rosa (#f472b6) com contorno preto grosso
- clean_box: Caixa escura discreta com texto branco
- minimal_apple: Texto branco limpo com sombra suave
- beast_green: Verde neon (#00ff00)
"""
import os
import tempfile
from pathlib import Path


def _seconds_to_ass_time(seconds: float) -> str:
    """Converte segundos para o formato ASS h:mm:ss.cs (centésimos de segundo)."""
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _clip_chunks(segments: list[dict], words: list[dict] | None,
                 clip_start: float, clip_end: float | None) -> list[tuple[float, float, str]]:
    """
    Agrupa palavras com precisão temporal acústica milimétrica relativa ao início do clipe.
    Gera blocos de 2 a 3 palavras com tempos sincronizados exatamente com a fala real.
    """
    end_limit = clip_end if clip_end is not None else float("inf")
    chunks: list[tuple[float, float, str]] = []

    if words:
        # Filtra palavras válidas dentro do intervalo do clipe
        inside = [
            w for w in words
            if float(w.get("end", 0)) > clip_start and float(w.get("start", 0)) < end_limit and str(w.get("word", "")).strip()
        ]

        i = 0
        while i < len(inside):
            # Agrupa 2 ou 3 palavras por bloco (estilo dinâmico Hormozi / Reels)
            group_size = 3
            # Se encontrar pontuação forte (. ? !), encerra o bloco no ponto final
            for offset in range(min(3, len(inside) - i)):
                w_text = str(inside[i + offset].get("word", "")).strip()
                if any(w_text.endswith(p) for p in (".", "?", "!", ":")):
                    group_size = offset + 1
                    break

            group = inside[i:i + group_size]
            w_start = float(group[0]["start"])
            w_end = float(group[-1]["end"])

            # Tempo relativo ao início exato do clipe
            t0 = max(0.0, round(w_start - clip_start, 2))
            t1 = max(t0 + 0.35, round(w_end - clip_start, 2))
            t1 = min(round(end_limit - clip_start, 2), t1)

            # Continuidade visual suave: se a próxima palavra começar logo em seguida (<0.35s),
            # estende a legenda para evitar piscar na tela
            if i + group_size < len(inside):
                next_start = float(inside[i + group_size]["start"]) - clip_start
                if 0 < (next_start - t1) <= 0.35:
                    t1 = round(next_start, 2)

            text = " ".join(str(w.get("word", "")).strip() for w in group)
            if text and t1 > t0:
                chunks.append((t0, t1, text))
            i += group_size

        return chunks

    # Fallback caso não haja timestamps palavra-por-palavra (apenas segmentos)
    for seg in segments:
        s_start = float(seg.get("start", 0))
        s_end = float(seg.get("end", 0))
        if s_end <= clip_start or s_start >= end_limit:
            continue
        seg_words = str(seg.get("text", "")).strip().split()
        if not seg_words:
            continue
        parts = [" ".join(seg_words[j:j + 3]) for j in range(0, len(seg_words), 3)]
        part_dur = (s_end - s_start) / max(1, len(parts))
        for j, part in enumerate(parts):
            s = s_start + j * part_dur
            e = s + part_dur
            if e <= clip_start or s >= end_limit:
                continue
            t0 = max(0.0, round(s - clip_start, 2))
            t1 = min(round(end_limit - clip_start, 2), round(e - clip_start, 2))
            if t1 > t0:
                chunks.append((t0, t1, part))
    return chunks


# Cores e estilos ASS (formato BGR: &HAABBGGRR)
PRESET_STYLES = {
    # 1. Hormozi Amarelo: Destaque amarelo ouro (#facc15 -> BGR 15CCFA) com texto preto
    "hormozi_yellow": {
        "font": "DejaVu Sans",
        "fontsize": 54,
        "primary": "&H00000000",   # Texto preto
        "outline_col": "&H0015CCFA", # Caixa Amarelo ouro
        "back_col": "&H0015CCFA",
        "border_style": 3,         # Caixa de fundo sólida (pill badge)
        "outline": 7,              # Padding da caixa
        "shadow": 0,
        "bold": -1,
    },
    # 2. Hormozi Laranja: Destaque laranja (#ea580c -> BGR 0C58EA) com texto branco
    "hormozi_orange": {
        "font": "DejaVu Sans",
        "fontsize": 54,
        "primary": "&H00FFFFFF",   # Texto branco
        "outline_col": "&H000C58EA", # Caixa Laranja
        "back_col": "&H000C58EA",
        "border_style": 3,
        "outline": 7,
        "shadow": 0,
        "bold": -1,
    },
    # 3. Clean White: Caixa branca pura (#ffffff) com texto escuro
    "clean_white": {
        "font": "DejaVu Sans",
        "fontsize": 52,
        "primary": "&H000B0909",   # Texto escuro #09090b
        "outline_col": "&H00FFFFFF", # Caixa Branco
        "back_col": "&H00FFFFFF",
        "border_style": 3,
        "outline": 7,
        "shadow": 0,
        "bold": -1,
    },
    # 4. Dark Box: Caixa escura (#18181b -> BGR 1B1818) com texto laranja vibrante (#f97316 -> BGR 1673F9)
    "dark_box": {
        "font": "DejaVu Sans",
        "fontsize": 54,
        "primary": "&H001673F9",   # Texto Laranja
        "outline_col": "&H001B1818", # Caixa Dark Zinc
        "back_col": "&H001B1818",
        "border_style": 3,
        "outline": 8,
        "shadow": 0,
        "bold": -1,
    },
    # 5. Neon Cyan: Texto ciano (#22d3ee -> BGR EED322) com contorno preto e brilho
    "neon_cyan": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H00EED322",   # Texto Ciano
        "outline_col": "&H00000000", # Contorno preto grosso
        "back_col": "&H80000000",
        "border_style": 1,         # Contorno + sombra
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    # 6. Neon Magenta: Texto rosa (#f472b6 -> BGR B672F4) com contorno preto
    "neon_magenta": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H00B672F4",   # Texto Rosa
        "outline_col": "&H00000000",
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    # 7. Neon Glow (alias da página de edição do clipe)
    "neon_glow": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H00D4B606",   # Ciano #06B6D4 -> BGR D4B606
        "outline_col": "&H00000000",
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    # 8. Clean Box (alias da página de edição do clipe)
    "clean_box": {
        "font": "DejaVu Sans",
        "fontsize": 52,
        "primary": "&H00FFFFFF",   # Texto branco
        "outline_col": "&H001B1818", # Caixa Dark Zinc
        "back_col": "&H001B1818",
        "border_style": 3,
        "outline": 7,
        "shadow": 0,
        "bold": -1,
    },
    # 9. Minimal Apple (sem caixa, texto branco com contorno preto suave)
    "minimal_apple": {
        "font": "DejaVu Sans",
        "fontsize": 52,
        "primary": "&H00F5F4F4",   # Branco suave
        "outline_col": "&H00000000", # Contorno preto suave
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 3,
        "shadow": 1,
        "bold": -1,
    },
    # Aliases adicionais
    "beast_green": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H0000FF00",   # Verde neon
        "outline_col": "&H00000000",
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    "modern_cyan": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H00EED322",
        "outline_col": "&H00000000",
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    "minimal_white": {
        "font": "DejaVu Sans",
        "fontsize": 52,
        "primary": "&H000B0909",
        "outline_col": "&H00FFFFFF",
        "back_col": "&H00FFFFFF",
        "border_style": 3,
        "outline": 7,
        "shadow": 0,
        "bold": -1,
    },
    "sunset_pink": {
        "font": "DejaVu Sans",
        "fontsize": 58,
        "primary": "&H00B672F4",
        "outline_col": "&H00000000",
        "back_col": "&H80000000",
        "border_style": 1,
        "outline": 5,
        "shadow": 2,
        "bold": -1,
    },
    # ─── Estilos dinâmicos (animados palavra a palavra) ──────────────────────
    # Karaokê: bloco de 3 palavras em branco, a palavra falada acende em amarelo
    "karaoke_amarelo": {
        "font": "DejaVu Sans", "fontsize": 58,
        "primary": "&H00FFFFFF", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 5, "shadow": 2, "bold": -1,
        "animation": "karaoke", "highlight": "&H0015CCFA",
    },
    # Karaokê roxo (cor da marca)
    "karaoke_roxo": {
        "font": "DejaVu Sans", "fontsize": 58,
        "primary": "&H00FFFFFF", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 5, "shadow": 2, "bold": -1,
        "animation": "karaoke", "highlight": "&H00F755A8",
    },
    # Uma palavra por vez, grande, entrando com pop (estilo MrBeast)
    "palavra_unica": {
        "font": "DejaVu Sans", "fontsize": 84,
        "primary": "&H0015CCFA", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 7, "shadow": 3, "bold": -1,
        "animation": "word",
    },
    # As palavras aparecem conforme são faladas
    "revelacao": {
        "font": "DejaVu Sans", "fontsize": 58,
        "primary": "&H00FFFFFF", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 5, "shadow": 2, "bold": -1,
        "animation": "reveal",
    },
    # Bloco branco com contorno entrando com pop
    "pop_branco": {
        "font": "DejaVu Sans", "fontsize": 60,
        "primary": "&H00FFFFFF", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 6, "shadow": 2, "bold": -1,
        "animation": "pop",
    },
    # Caixa amarela Hormozi com pop
    "caixa_pop": {
        "font": "DejaVu Sans", "fontsize": 54,
        "primary": "&H00000000", "outline_col": "&H0015CCFA", "back_col": "&H0015CCFA",
        "border_style": 3, "outline": 7, "shadow": 0, "bold": -1,
        "animation": "pop",
    },
    # Minimalista com entrada suave
    "fade_suave": {
        "font": "DejaVu Sans", "fontsize": 50,
        "primary": "&H00F5F4F4", "outline_col": "&H00000000", "back_col": "&H80000000",
        "border_style": 1, "outline": 3, "shadow": 1, "bold": -1,
        "animation": "fade",
    },
}

# Nomes das famílias instaladas no Dockerfile (fontconfig/libass)
FONT_MAP = {
    "anton_impact": "Anton",
    "instagram_sans": "Roboto",
    "sf_pro_rounded": "Roboto",
    "sf_pro_bold": "Roboto",
    "montserrat": "Montserrat",
}


def _resolve_font(font_family: str | None, default: str) -> str:
    """Aceita o id do editor ('montserrat') ou a pilha CSS ('Montserrat, sans-serif')."""
    if not font_family:
        return default
    if font_family in FONT_MAP:
        return FONT_MAP[font_family]
    fam = font_family.lower()
    if "anton" in fam or "impact" in fam:
        return "Anton"
    if "montserrat" in fam:
        return "Montserrat"
    return "Roboto"


def _clip_groups(segments: list[dict], words: list[dict] | None, clip_start: float,
                 clip_end: float | None, max_words: int) -> list[tuple[float, float, list[tuple[float, float, str]]]]:
    """Blocos de até max_words palavras com o tempo de cada palavra (para animar palavra a palavra)."""
    end_limit = clip_end if clip_end is not None else float("inf")
    timed: list[tuple[float, float, str]] = []
    if words:
        for w in words:
            text = str(w.get("word", "")).strip()
            ws, we = float(w.get("start", 0)), float(w.get("end", 0))
            if text and we > clip_start and ws < end_limit:
                timed.append((ws, we, text))
    else:
        for seg in segments:
            s, e = float(seg.get("start", 0)), float(seg.get("end", 0))
            seg_words = str(seg.get("text", "")).split()
            if not seg_words or e <= clip_start or s >= end_limit:
                continue
            step = (e - s) / len(seg_words)
            timed += [(s + k * step, s + (k + 1) * step, t) for k, t in enumerate(seg_words)]

    groups = []
    i = 0
    while i < len(timed):
        size = max_words
        for off in range(min(max_words, len(timed) - i)):
            if timed[i + off][2].endswith((".", "?", "!", ":")):
                size = off + 1
                break
        chunk = timed[i:i + size]
        rel = [
            (max(0.0, round(ws - clip_start, 2)), min(round(end_limit - clip_start, 2), round(we - clip_start, 2)), t)
            for ws, we, t in chunk
        ]
        t0, t1 = rel[0][0], max(rel[-1][1], rel[0][0] + 0.3)
        if i + size < len(timed):
            nxt = round(timed[i + size][0] - clip_start, 2)
            if 0 < nxt - t1 <= 0.35:
                t1 = nxt
        if t1 > t0:
            groups.append((t0, t1, rel))
        i += size
    return groups


def _escape(text: str) -> str:
    return text.upper().replace("{", "(").replace("}", ")")


_POP = r"{\fscx70\fscy70\t(0,90,\fscx108\fscy108)\t(90,170,\fscx100\fscy100)}"


def _animated_events(groups, animation: str, primary: str, highlight: str | None) -> list[tuple[float, float, str]]:
    events: list[tuple[float, float, str]] = []
    for t0, t1, ws in groups:
        texts = [_escape(t) for _, _, t in ws]
        if animation == "karaoke":
            hl = highlight or "&H0015CCFA"
            for k in range(len(ws)):
                start = t0 if k == 0 else ws[k][0]
                end = ws[k + 1][0] if k + 1 < len(ws) else t1
                if end <= start:
                    continue
                parts = [
                    (rf"{{\c{hl}\fscx108\fscy108}}{t}{{\c{primary}\fscx100\fscy100}}" if j == k else t)
                    for j, t in enumerate(texts)
                ]
                events.append((start, end, " ".join(parts)))
        elif animation == "reveal":
            # \ko some com texto e contorno até a palavra ser falada (SecondaryColour transparente)
            # No karaokê do ASS a duração antes de cada sílaba é quanto ela dura; uma sílaba vazia
            # inicial cobre o intervalo até a primeira palavra ser falada
            lead = max(0, int(round((ws[0][0] - t0) * 100)))
            pieces = [rf"{{\ko{lead}}}"] if lead else []
            for k, txt in enumerate(texts):
                nxt = ws[k + 1][0] if k + 1 < len(ws) else t1
                dur = max(1, int(round((nxt - ws[k][0]) * 100)))
                pieces.append(rf"{{\ko{dur}}}{txt} ")
            events.append((t0, t1, "".join(pieces).strip()))
        elif animation in ("pop", "word"):
            events.append((t0, t1, _POP + " ".join(texts)))
        elif animation == "fade":
            events.append((t0, t1, r"{\fad(140,90)}" + " ".join(texts)))
        else:
            events.append((t0, t1, " ".join(texts)))
    return events


def generate_ass(segments: list[dict], output_path: str | None = None,
                 clip_start: float = 0.0, clip_end: float | None = None,
                 words: list[dict] | None = None, margin_v: int = 120,
                 subtitle_preset: str = "hormozi_yellow",
                 font_family: str | None = None,
                 font_size: int | None = None) -> str:
    """
    Gera arquivo .ass 100% sincronizado com o estilo visual configurado no Template do Clippost.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".ass", prefix="clippost_sub_")
        os.close(fd)

    # Localiza o preset de estilo escolhido no template (com fallback seguro para hormozi_yellow)
    style_cfg = PRESET_STYLES.get(subtitle_preset, PRESET_STYLES["hormozi_yellow"])

    font_name = _resolve_font(font_family, style_cfg["font"])
    animation = style_cfg.get("animation")

    # Tamanho da fonte
    f_size = style_cfg["fontsize"]
    if font_size and isinstance(font_size, (int, float)) and font_size > 0:
        if font_size <= 24:
            f_size = int(round(font_size * 3.8))
        else:
            f_size = int(font_size)

    primary_color = style_cfg["primary"]
    outline_color = style_cfg["outline_col"]
    back_color = style_cfg["back_col"]
    border_style = style_cfg["border_style"]
    outline_val = style_cfg["outline"]
    shadow_val = style_cfg["shadow"]
    bold_val = style_cfg["bold"]
    # Revelação: a cor "ainda não falada" é transparente
    secondary_color = "&HFF000000" if animation == "reveal" else "&H000000FF"

    # Header oficial ASS no canvas 1080x1920 (Full HD vertical padrão)
    # Margens laterais generosas (80px) evitam corte de texto em celulares e telas estreitas
    scale_factor = 1080.0 / 720.0
    f_size_scaled = int(round(f_size * scale_factor))
    outline_scaled = max(4, int(round(outline_val * scale_factor)))
    shadow_scaled = int(round(shadow_val * scale_factor))
    margin_lr = 80

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,{font_name},{f_size_scaled},{primary_color},{secondary_color},{outline_color},{back_color},{bold_val},0,0,0,100,100,0,0,{border_style},{outline_scaled},{shadow_scaled},2,{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    event_lines = []
    if animation:
        groups = _clip_groups(segments, words, clip_start, clip_end, max_words=1 if animation == "word" else 3)
        timed_texts = _animated_events(groups, animation, primary_color, style_cfg.get("highlight"))
    else:
        timed_texts = [
            (t0, t1, chunk.upper().strip().replace("{", "(").replace("}", ")"))
            for t0, t1, chunk in _clip_chunks(segments, words, clip_start, clip_end)
        ]
    for t_start, t_end, text in timed_texts:
        event_lines.append(
            f"Dialogue: 0,{_seconds_to_ass_time(t_start)},{_seconds_to_ass_time(t_end)},"
            f"Viral,,0,0,0,,{text}"
        )

    Path(output_path).write_text(header + "\n".join(event_lines) + "\n", encoding="utf-8")
    return output_path
