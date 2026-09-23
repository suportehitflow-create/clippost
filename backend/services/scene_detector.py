"""
Detecção de cenas via PySceneDetect.
Usado como fallback quando o AI Curator não encontra clipes virais,
e como contexto adicional para melhorar a seleção de cortes.
"""
from __future__ import annotations


def detect_scenes(
    video_path: str,
    min_scene_len: float = 30.0,
    max_clip_len: float = 120.0,
    max_clips: int = 10,
    threshold: float = 27.0,
) -> list[dict]:
    """
    Detecta mudanças de cena no vídeo e retorna clips candidatos.

    Retorna lista de {"start_time", "end_time", "hook_title", "ai_score"}
    compatível com o formato do AI Curator.
    """
    try:
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=threshold))
        scene_manager.detect_scenes(video)
        raw_scenes = scene_manager.get_scene_list()

        candidates = []
        for i, (start_tc, end_tc) in enumerate(raw_scenes):
            start = start_tc.get_seconds()
            end = end_tc.get_seconds()
            duration = end - start
            if duration < min_scene_len:
                continue
            # Limita duração máxima do clip
            clip_end = min(end, start + max_clip_len)
            candidates.append({
                "start_time": round(start, 2),
                "end_time": round(clip_end, 2),
                "hook_title": f"Cena {i + 1}",
                "ai_score": 50,
            })

        candidates = candidates[:max_clips]
        print(f"[scene_detector] {len(candidates)} cenas detectadas (de {len(raw_scenes)} total, threshold={threshold})")
        return candidates

    except ImportError:
        print("[scene_detector] scenedetect não instalado — pulando detecção de cenas")
        return []
    except Exception as e:
        print(f"[scene_detector] erro: {e}")
        return []


def scene_timestamps(video_path: str, threshold: float = 27.0) -> list[float]:
    """
    Retorna apenas os timestamps de corte de cena (em segundos).
    Útil para passar como contexto ao AI Curator.
    """
    try:
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=threshold))
        scene_manager.detect_scenes(video)
        scenes = scene_manager.get_scene_list()
        return [round(s.get_seconds(), 2) for s, _ in scenes]
    except Exception as e:
        print(f"[scene_detector] scene_timestamps erro: {e}")
        return []
