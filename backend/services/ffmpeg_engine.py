"""
FFmpeg Engine — corte 9:16 + Brand Kit overlay + legendas virais.
"""
import os
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path


def _download_avatar(url: str, dest_dir: str) -> str | None:
    """Baixa avatar para arquivo local (FFmpeg precisa de arquivo local)."""
    if not url:
        return None
    try:
        ext = url.split("?")[0].rsplit(".", 1)[-1] or "png"
        dest = os.path.join(dest_dir, f"avatar.{ext}")
        urllib.request.urlretrieve(url, dest)
        return dest
    except Exception as e:
        print(f"[ffmpeg_engine] avatar download falhou: {e}")
        return None


def create_vertical_clip(
    input_video: str,
    output_video: str,
    start: float,
    end: float,
    brand_kit: dict | None = None,
    subtitle_file: str | None = None,
    hook_title: str | None = None,
) -> str:
    """
    Renderiza um clipe vertical 9:16 com:
    - Crop centralizado 9:16
    - Avatar overlay (se brand_kit fornecido)
    - Username e hook_title via drawtext
    - Legendas queimadas (.srt ou .ass)

    brand_kit estrutura esperada:
    {
        "avatar_url": "https://...",
        "username": "@usuario",
        "layout_config": {
            "avatar":   {"x": 40,  "y": 60,  "w": 120, "h": 120},
            "hook":     {"x": 540, "y": 1600},
            "username": {"x": 180, "y": 95}
        }
    }
    """
    duration = round(end - start, 3)
    tmp_dir = tempfile.mkdtemp(prefix="clippost_engine_")

    try:
        layout = (brand_kit or {}).get("layout_config", {})
        avatar_cfg = layout.get("avatar", {"x": 40, "y": 60, "w": 120, "h": 120})
        hook_cfg = layout.get("hook", {"x": 540, "y": 1600})
        user_cfg = layout.get("username", {"x": 180, "y": 95})

        username = (brand_kit or {}).get("username", "")
        avatar_url = (brand_kit or {}).get("avatar_url", "")

        # --- Construção do filter_complex ---
        # [0:v] crop 9:16 → scale 1080x1920
        filter_parts = [
            "[0:v]crop=ih*9/16:ih,scale=1080:1920[base]"
        ]
        last_video = "[base]"
        input_files = [
            "-ss", str(start), "-t", str(duration), "-i", input_video,
        ]
        input_count = 1

        # Avatar overlay
        avatar_local = None
        if avatar_url:
            avatar_local = _download_avatar(avatar_url, tmp_dir)

        if avatar_local and os.path.exists(avatar_local):
            aw = avatar_cfg.get("w", 120)
            ah = avatar_cfg.get("h", 120)
            ax = avatar_cfg.get("x", 40)
            ay = avatar_cfg.get("y", 60)
            input_files += ["-i", avatar_local]
            filter_parts.append(
                f"[{input_count}:v]scale={aw}:{ah}[avatar]"
            )
            filter_parts.append(
                f"{last_video}[avatar]overlay={ax}:{ay}[withavatar]"
            )
            last_video = "[withavatar]"
            input_count += 1

        # Drawtext: username
        text_filters = []
        if username:
            safe_user = username.replace("'", "\\'").replace(":", "\\:")
            ux = user_cfg.get("x", 180)
            uy = user_cfg.get("y", 95)
            text_filters.append(
                f"drawtext=text='{safe_user}':fontcolor=white:fontsize=48:"
                f"fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
                f"borderw=3:bordercolor=black:x={ux}-text_w/2:y={uy}"
            )

        # Drawtext: hook title
        if hook_title:
            safe_hook = hook_title.replace("'", "\\'").replace(":", "\\:")
            hx = hook_cfg.get("x", 540)
            hy = hook_cfg.get("y", 1600)
            # quebra em 2 linhas se longo
            text_filters.append(
                f"drawtext=text='{safe_hook}':fontcolor=yellow:fontsize=56:"
                f"fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
                f"borderw=4:bordercolor=black:x=(w-text_w)/2:y={hy}:line_spacing=10"
            )

        if text_filters:
            combined = ",".join(text_filters)
            filter_parts.append(f"{last_video}{combined}[textout]")
            last_video = "[textout]"

        # Subtitles
        if subtitle_file and os.path.exists(subtitle_file):
            ext = Path(subtitle_file).suffix.lower()
            safe_path = subtitle_file.replace("\\", "/").replace(":", "\\:")
            if ext == ".ass":
                filter_parts.append(f"{last_video}ass='{safe_path}'[subout]")
            else:
                filter_parts.append(f"{last_video}subtitles='{safe_path}'[subout]")
            last_video = "[subout]"

        filter_complex = ";".join(filter_parts)

        cmd = (
            ["ffmpeg", "-y"]
            + input_files
            + ["-ss", str(start), "-t", str(duration), "-i", input_video]  # audio input
            + [
                "-filter_complex", filter_complex,
                "-map", last_video,
                "-map", f"{input_count}:a",
                "-vcodec", "libx264", "-preset", "fast", "-crf", "23",
                "-acodec", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                output_video,
            ]
        )

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # fallback: renderização simples sem brand kit
            print(f"[ffmpeg_engine] filter_complex falhou, tentando fallback:\n{result.stderr[-800:]}")
            _simple_render(input_video, output_video, start, duration)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_video


def _simple_render(input_video: str, output_video: str, start: float, duration: float):
    """Fallback: crop 9:16 simples sem overlays."""
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-t", str(duration), "-i", input_video,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-vcodec", "libx264", "-preset", "fast", "-crf", "23",
        "-acodec", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_video,
    ], check=True, capture_output=True)
