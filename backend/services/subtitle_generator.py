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


def generate_ass(segments: list[dict], output_path: str | None = None) -> str:
    """
    Gera arquivo .ass com estilo viral: fonte grande, amarelo, borda preta, centralizado.
    Ideal para queimar no FFmpeg com subtitles=file.ass.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".ass", prefix="clippost_sub_")
        os.close(fd)

    header = """\
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,Arial Black,88,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,0,2,80,80,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    event_lines = []
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        words = text.split()
        chunks = [" ".join(words[i:i+3]) for i in range(0, len(words), 3)]
        duration = seg["end"] - seg["start"]
        for i, chunk in enumerate(chunks):
            chunk_dur = duration / len(chunks)
            t_start = seg["start"] + i * chunk_dur
            t_end = t_start + chunk_dur
            escaped = chunk.replace("{", "\\{").replace("}", "\\}")
            event_lines.append(
                f"Dialogue: 0,{_seconds_to_ass_time(t_start)},{_seconds_to_ass_time(t_end)},"
                f"Viral,,0,0,0,,{escaped}"
            )

    Path(output_path).write_text(header + "\n".join(event_lines) + "\n", encoding="utf-8")
    return output_path
