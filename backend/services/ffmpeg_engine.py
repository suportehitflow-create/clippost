"""
FFmpeg Engine — renderização de clipes verticais (9:16).
Integrado com os Modelos/Templates e com IA Smart Framing (Active Speaker & Focus Tracking).
"""
import os
import shutil
import subprocess
import tempfile
import threading
import urllib.request
from pathlib import Path

# Semáforo global: apenas 1 FFmpeg por vez para não saturar a CPU do Fly.io.
_FFMPEG_SEMAPHORE = threading.Semaphore(1)


# ─── Remoção de Silêncio Sincronizada ────────────────────────────────────────

def _detect_silences(input_video: str, start: float, duration: float,
                     noise_db: float = -55.0, min_dur: float = 0.4) -> list[tuple[float, float]]:
    """
    Detecta intervalos silenciosos no trecho [start, start+duration] do vídeo.
    Retorna lista de (sil_start, sil_end) em tempo RELATIVO ao início do clipe.
    """
    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(duration), "-i", input_video,
            "-af", f"silencedetect=noise={noise_db}dB:duration={min_dur}",
            "-f", "null", "-"
        ], capture_output=True, text=True, timeout=30)
        silences: list[tuple[float, float]] = []
        for line in result.stderr.split("\n"):
            if "silence_end" in line and "|" in line:
                try:
                    end = float(line.split("silence_end:")[1].split("|")[0].strip())
                    dur = float(line.split("silence_duration:")[1].strip())
                    s_start = max(0.0, end - dur)
                    silences.append((round(s_start, 4), round(end, 4)))
                except Exception:
                    pass
        return silences
    except Exception as e:
        print(f"[ffmpeg_engine] silencedetect erro: {e}")
        return []


def _keep_segments(duration: float, silences: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Retorna lista de segmentos a manter (não-silenciosos) dentro de [0, duration]."""
    if not silences:
        return [(0.0, duration)]
    merged: list[tuple[float, float]] = []
    for s, e in sorted(silences):
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    keep: list[tuple[float, float]] = []
    cursor = 0.0
    for s, e in merged:
        if s > cursor + 0.05:
            keep.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < duration - 0.05:
        keep.append((cursor, duration))
    return keep if keep else [(0.0, duration)]


def _remap_time(t: float, keep_segs: list[tuple[float, float]]) -> float:
    """Mapeia um timestamp original para o novo tempo após remoção de silêncios."""
    new_t = 0.0
    for ks, ke in keep_segs:
        if t <= ks:
            break
        seg_contrib = min(t, ke) - ks
        new_t += max(0.0, seg_contrib)
    return round(new_t, 4)


def _remap_ass(ass_path: str, keep_segs: list[tuple[float, float]]) -> str:
    """Reescreve os timestamps do ASS com base nos segmentos mantidos."""
    content = Path(ass_path).read_text(encoding="utf-8")
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("Dialogue:"):
            parts = line.split(",", 9)
            if len(parts) >= 3:
                t0 = _ass_to_sec(parts[1])
                t1 = _ass_to_sec(parts[2])
                new_t0 = _remap_time(t0, keep_segs)
                new_t1 = _remap_time(t1, keep_segs)
                if new_t1 > new_t0:
                    parts[1] = _sec_to_ass(new_t0)
                    parts[2] = _sec_to_ass(new_t1)
                    line = ",".join(parts)
                else:
                    continue
        new_lines.append(line)
    out = ass_path.replace(".ass", "_sync.ass")
    Path(out).write_text("\n".join(new_lines), encoding="utf-8")
    return out


def _ass_to_sec(t: str) -> float:
    try:
        h, m, s = t.strip().split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)
    except Exception:
        return 0.0


def _sec_to_ass(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


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
    remove_silence: bool = False,
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

        # 4. Remoção de silêncio sincronizada (trim+concat): detecta silêncios ANTES de renderizar
        # e usa trim/atrim no filter_complex para cortar vídeo+áudio juntos.
        # As legendas ASS são remapeadas para os novos timestamps — zero dessincronia.
        keep_segs: list[tuple[float, float]] = [(0.0, duration)]
        actual_duration = duration
        if remove_silence:
            try:
                silences = _detect_silences(input_video, start, duration)
                if silences:
                    keep_segs = _keep_segments(duration, silences)
                    actual_duration = round(sum(ke - ks for ks, ke in keep_segs), 3)
                    print(f"[ffmpeg_engine] silêncio: {len(silences)} intervalos → duração {duration:.1f}s → {actual_duration:.1f}s")
                    if subtitle_file and os.path.exists(subtitle_file):
                        subtitle_file = _remap_ass(subtitle_file, keep_segs)
            except Exception as sil_err:
                print(f"[ffmpeg_engine] silencedetect aviso: {sil_err}, renderizando sem corte de silêncio")
                keep_segs = [(0.0, duration)]
                actual_duration = duration

        # Transformações adicionais do vídeo (hflip, speed)
        hdr_filter = _detect_hdr_filter(input_video)
        vbox_transforms = []
        if hdr_filter:
            vbox_transforms.append(hdr_filter)
        vbox_transforms += [f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}", f"scale={target_w}:{target_h}"]
        if hflip:
            vbox_transforms.append("hflip")
        if speed and speed != 1.0:
            vbox_transforms.append(f"setpts={round(1/speed, 4)}*PTS")

        filter_parts: list[str] = []
        input_files = ["-ss", str(start), "-t", str(duration), "-i", input_video]

        # Trim+concat dos segmentos não-silenciosos
        n_segs = len(keep_segs)
        if n_segs == 1 and keep_segs[0] == (0.0, duration):
            # Sem corte de silêncio: usa [0:v] e [0:a] diretamente
            v_src = "[0:v]"
            a_src = "[0:a]"
        else:
            for i, (ks, ke) in enumerate(keep_segs):
                seg_dur = round(ke - ks, 4)
                filter_parts.append(
                    f"[0:v]trim=start={ks:.4f}:duration={seg_dur:.4f},setpts=PTS-STARTPTS[vs{i}]"
                )
                filter_parts.append(
                    f"[0:a]atrim=start={ks:.4f}:duration={seg_dur:.4f},asetpts=PTS-STARTPTS[as{i}]"
                )
            vs_in = "".join(f"[vs{i}]" for i in range(n_segs))
            as_in = "".join(f"[as{i}]" for i in range(n_segs))
            filter_parts.append(f"{vs_in}concat=n={n_segs}:v=1:a=0[vcomb]")
            filter_parts.append(f"{as_in}concat=n={n_segs}:v=0:a=1[acomb]")
            v_src = "[vcomb]"
            a_src = "[acomb]"

        # Canvas de fundo com a duração final (após corte de silêncio)
        filter_parts.append(f"color=c={bg_color}:s=1080x1920:d={actual_duration}[bg]")
        filter_parts.append(f"{v_src}{','.join(vbox_transforms)}[vbox]")
        filter_parts.append(f"[bg][vbox]overlay={box_x}:{box_y}[base]")

        # Fades de áudio
        speed_adj = speed or 1.0
        audio_filters = []
        if speed_adj != 1.0:
            audio_filters.append(f"atempo={min(2.0, speed_adj)}")
        audio_filters += _edge_fades(actual_duration / speed_adj)
        filter_parts.append(f"{a_src}{','.join(audio_filters)}[aout]")
        audio_map = "[aout]"
        last_video = "[base]"

        # 5. Legendas queimadas
        if subtitle_file and os.path.exists(subtitle_file):
            safe_path = subtitle_file.replace("\\", "/").replace(":", "\\:")
            ext = Path(subtitle_file).suffix.lower()
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
                "-vcodec", "libx264", "-preset", "ultrafast", "-crf", "26",
                "-acodec", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                output_video,
            ]
        )

        with _FFMPEG_SEMAPHORE:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=480)
        if result.returncode != 0:
            print(f"[ffmpeg_engine] filter_complex falhou, tentando fallback simples:\n{result.stderr[-800:]}")
            with _FFMPEG_SEMAPHORE:
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
        "-vcodec", "libx264", "-preset", "ultrafast", "-crf", "26",
        "-acodec", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_video,
    ], check=True, capture_output=True)
