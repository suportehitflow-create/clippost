"""
Subtitle Generator — converte segmentos do faster-whisper em arquivos .srt ou .ass
formatados para vídeos verticais (2-3 palavras por linha, estilo viral).
"""
import os
import textwrap
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


def generate_srt(segments: list[dict], output_path: str | None = None) -> str:
    """
    Recebe lista de {'start': float, 'end': float, 'text': str}
    Grava um .srt com no máximo 3 palavras por linha e retorna o caminho.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".srt", prefix="clippost_sub_")
        os.close(fd)

    lines = []
    index = 1
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        # quebra em grupos de até 3 palavras
        words = text.split()
        chunks = [" ".join(words[i:i+3]) for i in range(0, len(words), 3)]
        for chunk in chunks:
            # cada chunk herda proporcionalmente o tempo do segmento
            chunk_idx = chunks.index(chunk)
            duration = seg["end"] - seg["start"]
            chunk_dur = duration / len(chunks)
            t_start = seg["start"] + chunk_idx * chunk_dur
            t_end = t_start + chunk_dur
            lines.append(str(index))
            lines.append(f"{_seconds_to_srt_time(t_start)} --> {_seconds_to_srt_time(t_end)}")
            lines.append(chunk)
            lines.append("")
            index += 1

    Path(output_path).write_text("\n".join(lines), encoding="utf-8")
    return output_path


def _clip_chunks(segments: list[dict], words: list[dict] | None,
                 clip_start: float, clip_end: float | None) -> list[tuple[float, float, str]]:
    """Blocos de até 3 palavras com tempos relativos ao início do clipe.

    O corte usa -ss antes do -i, então o vídeo do clipe começa em 0. Legendas com
    a linha do tempo do vídeo inteiro apareciam fora de sincronia em todo clipe.
    """
    end_limit = clip_end if clip_end is not None else float("inf")
    chunks: list[tuple[float, float, str]] = []

    if words:
        inside = [w for w in words if w["end"] > clip_start and w["start"] < end_limit and w["word"].strip()]
        for i in range(0, len(inside), 3):
            group = inside[i:i + 3]
            t0 = max(group[0]["start"], clip_start) - clip_start
            t1 = min(group[-1]["end"], end_limit) - clip_start
            text = " ".join(w["word"].strip() for w in group)
            chunks.append((t0, t1, text))
        return chunks

    for seg in segments:
        if seg["end"] <= clip_start or seg["start"] >= end_limit:
            continue
        seg_words = seg["text"].strip().split()
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
                 words: list[dict] | None = None) -> str:
    """
    Gera arquivo .ass com estilo viral: fonte grande, borda preta, centralizado.
    Com clip_start/clip_end, só inclui a fala do trecho, com tempos relativos ao clipe.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".ass", prefix="clippost_sub_")
        os.close(fd)

    header = f"""\
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,Arial Black,88,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,0,2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    event_lines = []
    for t_start, t_end, chunk in _clip_chunks(segments, words, clip_start, clip_end):
        escaped = chunk.replace("{", "\\{").replace("}", "\\}")
        event_lines.append(
            f"Dialogue: 0,{_seconds_to_ass_time(t_start)},{_seconds_to_ass_time(t_end)},"
            f"Viral,,0,0,0,,{escaped}"
        )

    Path(output_path).write_text(header + "\n".join(event_lines) + "\n", encoding="utf-8")
    return output_path
