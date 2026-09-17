# Smart Framing & Active Speaker Tracking for ClipPost
import os
import subprocess
import json
from pathlib import Path


def get_video_dimensions(video_path: str) -> tuple[int, int]:
    """Obtém largura e altura do vídeo via ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json",
            video_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        stream = data.get("streams", [{}])[0]
        return int(stream.get("width", 1920)), int(stream.get("height", 1080))
    except Exception as e:
        print(f"[smart_framing] ffprobe falhou: {e}, assumindo 1920x1080")
        return 1920, 1080


def detect_smart_focus(
    video_path: str,
    start: float,
    duration: float,
    target_aspect: float,
    manual_pan_pct: float | None = None
) -> tuple[float, tuple[int, int, int, int]]:
    """
    Detecta o ponto focal do sujeito/falante no vídeo bruto.
    - O centro (50%) é a âncora prioritária principal.
    - Quando o falante se posiciona ou se desloca para a esquerda ou direita,
      o enquadramento acompanha para manter o sujeito perfeitamente centralizado
      no quadrado/retângulo do template sem cortar partes essenciais.
    - manual_pan_pct permite sobrepor o cálculo caso o usuário especifique.
    Retorna: (focal_x_pct, (crop_x, crop_y, crop_w, crop_h))
    """
    in_w, in_h = get_video_dimensions(video_path)

    # Se o usuário definiu pan manual, usa diretamente
    if manual_pan_pct is not None and 0 <= manual_pan_pct <= 100:
        focal_x_pct = float(manual_pan_pct)
    else:
        focal_x_pct = _analyze_focal_point(video_path, start, duration, in_w, in_h)

    # Calcula as dimensões do corte mantendo o target_aspect
    box_aspect = max(0.2, float(target_aspect))
    in_aspect = in_w / max(1, in_h)

    if in_aspect >= box_aspect:
        # Vídeo bruto é mais largo que o quadrado do template (ex: 16:9 para 1:1 ou 4:5)
        crop_h = in_h
        crop_w = int(round(in_h * box_aspect))
        # Garante números pares para codecs de vídeo
        crop_w = min(in_w, crop_w - (crop_w % 2))
        crop_h = min(in_h, crop_h - (crop_h % 2))

        # Posicionamento horizontal guiado pela IA com âncora central
        center_x = int(round(in_w * (focal_x_pct / 100.0)))
        crop_x = center_x - (crop_w // 2)
        # Clampa para não vazar as bordas do vídeo original
        crop_x = max(0, min(in_w - crop_w, crop_x))
        crop_x = crop_x - (crop_x % 2)
        crop_y = 0
    else:
        # Vídeo bruto é mais alto que o quadrado do template
        crop_w = in_w
        crop_h = int(round(in_w / box_aspect))
        crop_w = min(in_w, crop_w - (crop_w % 2))
        crop_h = min(in_h, crop_h - (crop_h % 2))

        crop_x = 0
        crop_y = max(0, min(in_h - crop_h, (in_h - crop_h) // 2))
        crop_y = crop_y - (crop_y % 2)

    return focal_x_pct, (crop_x, crop_y, crop_w, crop_h)


def _analyze_focal_point(video_path: str, start: float, duration: float, in_w: int, in_h: int) -> float:
    """
    Analisa frames amostrados no trecho do clipe para encontrar o ponto focal.
    Prioriza o centro como âncora base, acompanhando sujeitos que estejam fora do centro.
    """
    default_center = 50.0

    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return default_center

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

        # Amostra de 4 a 8 frames uniformes pelo trecho do clipe
        sample_count = min(8, max(4, int(duration / 2)))
        step = max(0.5, duration / (sample_count + 1))
        sample_times = [start + (i + 1) * step for i in range(sample_count)]

        # Carrega classificador Haar embutido no OpenCV
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)

        detected_centers: list[tuple[float, float]] = []  # (focal_pct, peso)

        for t in sample_times:
            frame_no = int(t * fps)
            if frame_no >= total_frames:
                continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Reduz resolução para análise ultrarrápida
            small_w = 640
            scale = small_w / max(1, in_w)
            small_h = int(in_h * scale)
            small_gray = cv2.resize(gray, (small_w, small_h))

            faces = face_cascade.detectMultiScale(
                small_gray,
                scaleFactor=1.15,
                minNeighbors=4,
                minSize=(30, 30)
            )

            for (fx, fy, fw, fh) in faces:
                # Centro normalizado do rosto [0.0, 1.0]
                face_norm_x = (fx + fw / 2.0) / float(small_w)
                face_pct = face_norm_x * 100.0

                # Peso do rosto baseado na área relativa (falante principal em destaque)
                area_ratio = (fw * fh) / float(small_w * small_h)

                # Âncora no Centro: o centro é o principal por padrão.
                # Faces próximas do centro recebem peso balanceado;
                # Faces afastadas precisam de boa definição para deslocar o enquadramento.
                dist_from_center = abs(face_norm_x - 0.5)  # 0.0 no meio, até 0.5 na borda
                center_bias = 1.0 / (1.0 + 1.2 * dist_from_center)

                weight = area_ratio * center_bias
                detected_centers.append((face_pct, weight))

        cap.release()

        if detected_centers:
            # Média ponderada dos pontos focais detectados
            total_weight = sum(w for _, w in detected_centers)
            if total_weight > 0:
                weighted_x = sum(pct * w for pct, w in detected_centers) / total_weight
                # Suavização para evitar cortes colados na borda (margem de segurança 20% a 80%)
                smoothed_x = max(20.0, min(80.0, weighted_x))
                print(f"[smart_framing] IA detectou foco em {smoothed_x:.1f}% (amostras: {len(detected_centers)})")
                return round(smoothed_x, 1)

    except Exception as e:
        print(f"[smart_framing] analise falhou: {e}, mantendo centro 50%")

    return default_center
