"""
FFmpeg Engine — renderização de clipes verticais (9:16).
Integrado com os Modelos/Templates e com IA Smart Framing (Active Speaker & Focus Tracking).
"""
import os
import shutil
import subprocess
import tempfile
import textwrap
import urllib.request
from pathlib import Path


def _download_avatar(url: str, dest_dir: str) -> str | None:
    if not url:
        return None
    try:
        import socket
        socket.setdefaulttimeout(8)
        ext = url.split("?")[0].rsplit(".", 1)[-1] or "png"
        dest = os.path.join(dest_dir, f"avatar.{ext}")
        urllib.request.urlretrieve(url, dest)
        return dest
    except Exception as e:
        print(f"[ffmpeg_engine] avatar download falhou: {e}")
        return None


def _detect_hdr_filter(video_path: str) -> str:
    """Detecta se o video de entrada esta em HDR (HLG smpte2084 ou arib-std-b67) e aplica tone-mapping para Rec.709 SDR."""
    try:
        cmd = [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=color_transfer,color_space,color_primaries",
            "-of", "json", video_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        import json
        data = json.loads(res.stdout)
        streams = data.get("streams") or [{}]
        color_transfer = streams[0].get("color_transfer", "")
        if color_transfer in ("smpte2084", "arib-std-b67"):
            print(f"[ffmpeg_engine] HDR detectado ({color_transfer}) -> aplicando tone-mapping para Rec.709 SDR")
            return "zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0.5,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
    except Exception as e:
        print(f"[ffmpeg_engine] aviso ffprobe hdr check: {e}")
    return ""


def create_vertical_clip(
    input_video: str,
    output_video: str,
    start: float,
    end: float,
    brand_kit: dict | None = None,
    subtitle_file: str | None = None,
    hook_title: str | None = None,
    hflip: bool = False,
    remove_silence: bool = True,
    speed: float = 1.0,
) -> str:
    """
    Renderiza clipe vertical 9:16 (1080x1920) 100% integrado com o template:
    - O vídeo bruto é recortado na proporção e dimensões exatas definidas no template.
    - IA Smart Framing: centraliza no foco/falante (com âncora prioritária no centro).
    - Canvas com cor de fundo do template (dark, white, zinc).
    - Avatar, nome da marca e gancho/título posicionados conforme configurado no template.
    - Legendas queimadas (.ass ou .srt).
    """
    duration = round(end - start, 3)
    tmp_dir = tempfile.mkdtemp(prefix="clippost_engine_")

    try:
        layout = (brand_kit or {}).get("layout_config", {})
        username = (brand_kit or {}).get("username", "")
        avatar_url = (brand_kit or {}).get("avatar_url", "")

        # 1. Dimensões do quadrado/retângulo de vídeo do template
        video_w_pct = float(layout.get("videoWidth", 96))
        video_h_pct = float(layout.get("videoHeight", 48))
        video_pos = layout.get("videoPos", {"x": 50, "y": 55})
        video_pos_x = float(video_pos.get("x", 50))
        video_pos_y = float(video_pos.get("y", 55))

        target_w = int(round(1080 * (video_w_pct / 100.0)))
        target_h = int(round(1920 * (video_h_pct / 100.0)))
        # Garante dimensões pares para codecs x264
        target_w = max(200, min(1080, target_w - (target_w % 2)))
        target_h = max(200, min(1920, target_h - (target_h % 2)))

        box_x = int(round(1080 * (video_pos_x / 100.0) - (target_w / 2.0)))
        box_y = int(round(1920 * (video_pos_y / 100.0) - (target_h / 2.0)))
        box_x = max(0, min(1080 - target_w, box_x))
        box_y = max(0, min(1920 - target_h, box_y))
        box_x -= (box_x % 2)
        box_y -= (box_y % 2)

        # 2. IA Smart Framing: Identifica o foco do vídeo bruto
        # O centro (50%) é a âncora prioritária principal; se o falante estiver deslocado, a IA acompanha.
        manual_pan = layout.get("cropPanX") or layout.get("manualPanX")
        try:
            from services.smart_framing import detect_smart_focus
            target_aspect = target_w / float(target_h)
            focal_x_pct, (crop_x, crop_y, crop_w, crop_h) = detect_smart_focus(
                input_video, start, duration, target_aspect=target_aspect, manual_pan_pct=manual_pan
            )
            print(f"[ffmpeg_engine] IA Smart Framing: focal={focal_x_pct}%, crop=({crop_w}x{crop_h} at {crop_x},{crop_y}) -> target=({target_w}x{target_h})")
        except Exception as sf_err:
            print(f"[ffmpeg_engine] smart_framing aviso ({sf_err}), usando centralizado padrão")
            crop_w = int(round(1080 * (target_w / float(target_h))))
            crop_h = 1080
            crop_x = max(0, (1920 - crop_w) // 2)
            crop_y = 0

        # 3. Cor de fundo do Template
        template_bg = layout.get("templateBg", "dark")
        if template_bg == "white":
            bg_color = "white"
        elif template_bg in ("zinc", "gray"):
            bg_color = "0x18181b"
        else:
            bg_color = "black"

        # Transformações adicionais do vídeo (hflip, speed)
        vbox_filters = [f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}", f"scale={target_w}:{target_h}"]
        hdr_filter = _detect_hdr_filter(input_video)
        if hdr_filter:
            vbox_filters.insert(0, hdr_filter)
        if hflip:
            vbox_filters.append("hflip")
        if speed and speed != 1.0:
            vbox_filters.append(f"setpts={round(1/speed, 4)}*PTS")

        filter_parts = [
            f"color=c={bg_color}:s=1080x1920:d={duration}[bg]",
            f"[0:v]{','.join(vbox_filters)}[vbox]",
            f"[bg][vbox]overlay={box_x}:{box_y}[base]"
        ]

        # 4. Áudio transforms
        audio_filters = []
        if remove_silence:
            audio_filters.append("silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-60dB")
        if speed and speed != 1.0:
            audio_filters.append(f"atempo={min(2.0, speed)}")
        audio_filters += _edge_fades(duration / (speed or 1.0))
        filter_parts.append(f"[0:a]{','.join(audio_filters)}[aout]")
        audio_map = "[aout]"
        last_video = "[base]"

        input_files = [
            "-ss", str(start), "-t", str(duration), "-i", input_video,
        ]
        input_count = 1

        # 5. Header: Perfil da Marca (Avatar + Nome + @handle)
        header_pos = layout.get("headerPos", {"x": 50, "y": 16})
        hy_pct = float(header_pos.get("y", 16))
        hx_pct = float(header_pos.get("x", 50))
        header_center_y = int(round(1920 * (hy_pct / 100.0)))

        avatar_local = None
        if avatar_url:
            avatar_local = _download_avatar(avatar_url, tmp_dir)

        brand_name = layout.get("brandName") or "Nome da Página"
        display_user = brand_name
        brand_handle = username or layout.get("brandHandle") or "@nomedapagina"

        if avatar_local and os.path.exists(avatar_local):
            aw, ah = 96, 96
            ax = int(round(1080 * (hx_pct / 100.0) - 220)) if hx_pct > 35 else int(round(1080 * 0.08))
            ay = header_center_y - 48
            input_files += ["-i", avatar_local]
            filter_parts.append(f"[{input_count}:v]scale={aw}:{ah}[avatar]")
            filter_parts.append(f"{last_video}[avatar]overlay={ax}:{ay}[withavatar]")
            last_video = "[withavatar]"
            input_count += 1
            user_text_x = ax + aw + 24
            user_text_y = header_center_y - 28
            handle_text_y = header_center_y + 12
        else:
            user_text_x = int(round(1080 * (hx_pct / 100.0)))
            user_text_y = header_center_y - 20
            handle_text_y = header_center_y + 16

        # Drawtext: Nome da marca e arroba
        text_filters = []
        user_color = "black" if template_bg == "white" else "white"
        handle_color = "0x71717a" if template_bg == "white" else "0xa1a1aa"

        safe_user = display_user.replace("'", r"\'").replace(":", r"\:")
        safe_handle = brand_handle.replace("'", r"\'").replace(":", r"\:")

        text_filters.append(
            f"drawtext=text='{safe_user}':fontcolor={user_color}:fontsize=34:"
            f"fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
            f"x={user_text_x}:y={user_text_y}"
        )
        text_filters.append(
            f"drawtext=text='{safe_handle}':fontcolor={handle_color}:fontsize=26:"
            f"fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:"
            f"x={user_text_x}:y={handle_text_y}"
        )

        # 6. Gancho / Título do vídeo
        title_pos = layout.get("titlePos", {"x": 50, "y": 25})
        title_y_pct = float(title_pos.get("y", 25))
        target_title_y = int(round(1920 * (title_y_pct / 100.0)))

        displayed_title = hook_title or layout.get("titleText")
        if displayed_title:
            title_color_hex = layout.get("titleColor", "#ffffff")
            title_color = "white" if title_color_hex == "#ffffff" else "black" if title_color_hex == "#000000" else f"0x{title_color_hex.replace('#', '')}"

            font_size = int(layout.get("fontSize", 15) * 3.2)
            font_size = max(38, min(68, font_size))

            is_caps = layout.get("titleCapsLock", True)
            clean_title = displayed_title.upper() if is_caps else displayed_title

            lines = textwrap.wrap(clean_title, width=24)[:3]
            line_h = int(font_size * 1.25)
            top_y = target_title_y - int((len(lines) * line_h) / 2)

            border_w = 4 if template_bg != "white" else 0
            border_color = "black" if template_bg != "white" else "white"

            for n, line in enumerate(lines):
                safe_line = (line.replace("\\", "\\\\").replace("'", "’")
                             .replace(":", "\\:").replace("%", "\\%"))
                text_filters.append(
                    f"drawtext=text='{safe_line}':fontcolor={title_color}:fontsize={font_size}:"
                    f"fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
                    f"borderw={border_w}:bordercolor={border_color}:x=(w-text_w)/2:y={top_y + n * line_h}"
                )

        if text_filters:
            combined = ",".join(text_filters)
            filter_parts.append(f"{last_video}{combined}[textout]")
            last_video = "[textout]"

        # 7. Subtitles / Legendas Queimadas
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
            + [
                "-filter_complex", filter_complex,
                "-map", last_video,
                "-map", audio_map,
                "-vcodec", "libx264", "-preset", "fast", "-crf", "23",
                "-acodec", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                output_video,
            ]
        )

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=420)
        if result.returncode != 0:
            print(f"[ffmpeg_engine] filter_complex falhou, tentando fallback simples:\n{result.stderr[-800:]}")
            _simple_render(input_video, output_video, start, duration)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_video


FADE_SECONDS = 0.03


def _edge_fades(out_duration: float) -> list[str]:
    """Fade de 30ms nas duas pontas: corte seco no áudio gera um estalo audível."""
    return [
        f"afade=t=in:st=0:d={FADE_SECONDS}",
        f"afade=t=out:st={max(0.0, out_duration - FADE_SECONDS):.3f}:d={FADE_SECONDS}",
    ]


def _simple_render(input_video: str, output_video: str, start: float, duration: float):
    """Fallback: crop 9:16 simples sem overlays."""
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-t", str(duration), "-i", input_video,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-af", ",".join(_edge_fades(duration)),
        "-vcodec", "libx264", "-preset", "fast", "-crf", "23",
        "-acodec", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_video,
    ], check=True, capture_output=True)
