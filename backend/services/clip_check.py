"""
Verificação do clipe renderizado antes de gravá-lo no banco.

O FFmpeg pode terminar com código 0 e ainda assim deixar um arquivo sem áudio,
sem vídeo ou com duração errada. Sem essa conferência o clipe quebrado ia para
o Storage e aparecia para o usuário como se estivesse pronto.
"""
import json
import subprocess


def validate_clip(path: str, expected_duration: float, tolerance: float = 2.0) -> dict:
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_streams", "-show_format", path],
        capture_output=True, text=True,
    )
    if probe.returncode != 0:
        return {"ok": False, "issues": ["ffprobe não conseguiu ler o arquivo"], "duration": 0.0}

    try:
        data = json.loads(probe.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "issues": ["saída do ffprobe ilegível"], "duration": 0.0}

    streams = data.get("streams", [])
    duration = float(data.get("format", {}).get("duration", 0) or 0)
    video = next((s for s in streams if s.get("codec_type") == "video"), None)

    issues = []
    if not video:
        issues.append("sem stream de vídeo")
    if not any(s.get("codec_type") == "audio" for s in streams):
        issues.append("sem stream de áudio")
    if duration < 3:
        issues.append(f"muito curto: {duration:.1f}s")
    if abs(duration - expected_duration) > tolerance:
        issues.append(f"duração {duration:.1f}s, esperada {expected_duration:.1f}s")
    if video and (video.get("width"), video.get("height")) != (1080, 1920):
        issues.append(f"não é 9:16: {video.get('width')}x{video.get('height')}")

    return {"ok": not issues, "issues": issues, "duration": duration}
