"""
Detecta vídeos que já vêm dentro do template de outra página (fundo sólido com
perfil + título em cima e o vídeo num retângulo) e devolve só a área do vídeo.

A moldura desses templates é idêntica em todos os quadros; o vídeo de dentro muda.
Medimos a variação de cada pixel ao longo do tempo, achamos a faixa de linhas e
colunas que se move e só aceitamos o recorte se o que ficou de fora for liso
(fundo sólido), para não recortar um vídeo comum que tem uma parede parada atrás.
"""
import subprocess

import cv2
import numpy as np

_ANALYSIS_W = 180
_MOTION_STD = 6.0          # desvio (0-255) acima do qual o pixel conta como "em movimento"
_ACTIVE_FRACTION = 0.30    # fração de pixels em movimento para a linha/coluna ser do vídeo
_MIN_FRAME_BAND = 0.10     # moldura precisa ocupar ao menos 10% da altura
_MIN_REGION_AREA = 0.12
_MAX_REGION_AREA = 0.90
_MIN_FLAT_FRACTION = 0.55  # parte da moldura com a cor dominante (fundo sólido)


def _longest_run(active: np.ndarray, max_gap: int) -> tuple[int, int] | None:
    best, start, gap, last = None, None, 0, None
    for i, on in enumerate(active):
        if on:
            if start is None:
                start = i
            last, gap = i, 0
        elif start is not None:
            gap += 1
            if gap > max_gap:
                if best is None or (last - start) > (best[1] - best[0]):
                    best = (start, last)
                start, gap = None, 0
    if start is not None and (best is None or (last - start) > (best[1] - best[0])):
        best = (start, last)
    return best


def _sample_frames(video_path: str, samples: int) -> tuple[list[np.ndarray], int, int]:
    cap = cv2.VideoCapture(video_path)
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if total < samples or not width or not height:
            return [], width, height
        small_h = max(1, round(height * _ANALYSIS_W / width))
        frames = []
        for i in range(samples):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / samples))
            ok, frame = cap.read()
            if not ok:
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frames.append(cv2.resize(gray, (_ANALYSIS_W, small_h), interpolation=cv2.INTER_AREA))
        return frames, width, height
    finally:
        cap.release()


def detect_video_region(video_path: str, samples: int = 24) -> tuple[int, int, int, int] | None:
    """(x, y, w, h) da área do vídeo em pixels do original, ou None se não houver template."""
    frames, width, height = _sample_frames(video_path, samples)
    if len(frames) < samples // 2:
        return None

    stack = np.stack(frames).astype(np.float32)
    moving = stack.std(axis=0) > _MOTION_STD
    sh, sw = moving.shape

    rows = _longest_run(moving.mean(axis=1) > _ACTIVE_FRACTION, max_gap=max(2, sh // 50))
    if not rows:
        return None
    r0, r1 = rows
    cols = _longest_run(moving[r0:r1 + 1].mean(axis=0) > _ACTIVE_FRACTION, max_gap=max(2, sw // 50))
    if not cols:
        return None
    c0, c1 = cols

    area = ((r1 - r0 + 1) * (c1 - c0 + 1)) / float(sh * sw)
    frame_band = 1.0 - (r1 - r0 + 1) / float(sh)
    if not (_MIN_REGION_AREA <= area <= _MAX_REGION_AREA) or frame_band < _MIN_FRAME_BAND:
        return None

    # A moldura precisa ser um fundo sólido (template), não cenário parado do próprio vídeo
    median = np.median(stack, axis=0)
    outside = np.ones_like(moving)
    outside[r0:r1 + 1, c0:c1 + 1] = False
    border_px = median[outside]
    if border_px.size == 0:
        return None
    hist = np.bincount((border_px // 8).astype(np.int64), minlength=32)
    if hist.max() / float(border_px.size) < _MIN_FLAT_FRACTION:
        return None

    scale = width / float(sw)
    inset = 0.02  # tira a borda arredondada/contorno do template antigo
    x = int((c0 + (c1 - c0) * inset) * scale)
    y = int((r0 + (r1 - r0) * inset) * scale)
    w = int((c1 - c0 + 1) * (1 - 2 * inset) * scale)
    h = int((r1 - r0 + 1) * (1 - 2 * inset) * scale)
    x, y = x - x % 2, y - y % 2
    w, h = w - w % 2, h - h % 2
    w, h = min(w, width - x), min(h, height - y)
    if w < 64 or h < 64:
        return None
    return x, y, w, h


def crop_to_region(video_path: str, out_path: str, region: tuple[int, int, int, int]) -> str:
    x, y, w, h = region
    subprocess.run([
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"crop={w}:{h}:{x}:{y}",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
        "-c:a", "copy", out_path,
    ], check=True, capture_output=True, timeout=900)
    return out_path
