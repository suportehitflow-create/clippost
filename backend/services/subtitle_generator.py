"""
Subtitle Generator — converte transcrições do Whisper em legendas virais .ass
com suporte aos presets de cores dinâmicas do Clippost (Hormozi, MrBeast, Minimalista, etc.).
"""
import os
import tempfile
from pathlib import Path


def _seconds_to_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _seconds_to_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _clip_chunks(segments: list[dict], words: list[dict] | None,
                 clip_start: float, clip_end: float | None) -> list[tuple[float, float, str]]:
    """Blocos de até 3 palavras com tempos relativos ao início do clipe."""
    end_limit = clip_end if clip_end is not None else float("inf")
    chunks: list[tuple[float, float, str]] = []

    if words:
        inside = [w for w in words if w["end"] > clip_start and w["start"] < end_limit and w.get("word", "").strip()]
        for i in range(0, len(inside), 3):
            group = inside[i:i + 3]
            t0 = max(group[0]["start"], clip_start) - clip_start
            t1 = min(group[-1]["end"], end_limit) - clip_start
            text = " ".join(w["word"].strip() for w in group)
            chunks.append((t0, t1, text))
        return chunks

    for seg in segments:
        if seg.get("end", 0) <= clip_start or seg.get("start", 0) >= end_limit:
            continue
        seg_words = seg.get("text", "").strip().split()
        if not seg_words:
            continue
        parts = [" ".join(seg_words[i:i + 3]) for i in range(0, len(seg_words), 3)]
        part_dur = (seg["end"] - seg["start"]) / len(parts)
        for i, part in enumerate(parts):
            s = seg["start"] + i * part_dur
            e = s + part_dur
            if e <= clip_start or s >= end_limit:
                continue
            chunks.append((max(s, clip_start) - clip_start, min(e, end_limit) - clip_start, part))
    return chunks


def generate_ass(segments: list[dict], output_path: str | None = None,
                 clip_start: float = 0.0, clip_end: float | None = None,
                 words: list[dict] | None = None, margin_v: int = 180,
                 subtitle_preset: str = "hormozi_yellow") -> str:
    """
    Gera arquivo .ass com estilo viral e cores configuradas pelo usuário:
    - hormozi_yellow: Amarelo vibrante (&H0000FFFF) com contorno preto grosso
    - beast_green: Verde neon (&H0000FF00) com contorno preto
    - modern_cyan: Ciano elétrico (&H00FFFF00)
    - minimal_white: Branco puro (&H00FFFFFF)
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".ass", prefix="clippost_sub_")
        os.close(fd)

    # ASS usa formato BGR em hexadecimal: &H00BBGGRR
    preset_colors = {
        "hormozi_yellow": "&H0000FFFF",  # Amarelo puro
        "beast_green": "&H0000FF00",     # Verde neon
        "modern_cyan": "&H00FFFF00",     # Ciano vibrante
        "minimal_white": "&H00FFFFFF",   # Branco
        "sunset_pink": "&H008000FF",     # Rosa choque
    }
    primary_color = preset_colors.get(subtitle_preset, "&H0000FFFF")

    header = f"""\
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,Impact,86,{primary_color},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,0,2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    event_lines = []
    for t_start, t_end, chunk in _clip_chunks(segments, words, clip_start, clip_end):
        clean_text = chunk.upper()
        escaped = clean_text.replace("{", "\\{").replace("}", "\\}")
        event_lines.append(
            f"Dialogue: 0,{_seconds_to_ass_time(t_start)},{_seconds_to_ass_time(t_end)},"
            f"Viral,,0,0,0,,{escaped}"
        )

    Path(output_path).write_text(header + "\n".join(event_lines) + "\n", encoding="utf-8")
    return output_path
