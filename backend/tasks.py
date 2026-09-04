"""
ClipPost — Worker Celery (processo completo)
1. Download (yt-dlp)
2. Upload vídeo raw → Supabase Storage
3. Extração de áudio (FFmpeg)
4. Transcrição com timestamps (faster-whisper)
5. INSERT na tabela projects
6. AI Curator → get_viral_clips()
7. FFmpeg Engine → create_vertical_clip() para cada corte
8. Upload clips → Supabase Storage
9. INSERT na tabela clips
10. Cleanup
"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import yt_dlp
from celery_app import celery
from supabase import create_client, Client
from dotenv import load_dotenv

from services.ai_curator import get_viral_clips
from services.ffmpeg_engine import create_vertical_clip
from services.subtitle_generator import generate_ass

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@celery.task(name="process_youtube_video")
def process_youtube_video(url: str, user_id: str):
    tmp_dir = Path(tempfile.mkdtemp(prefix="clippost_"))
    video_path = str(tmp_dir / "original.mp4")
    audio_path = str(tmp_dir / "audio.mp3")

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': video_path,
        'quiet': True,
        'noplaylist': True,
        'merge_output_format': 'mp4',
    }

    try:
        # 1. Download do vídeo
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get('id', 'video')
            title = info.get('title', 'Sem título')

        # 2. Upload vídeo raw para Supabase Storage
        storage_path = f"{user_id}/{video_id}.mp4"
        with open(video_path, 'rb') as f:
            supabase.storage.from_("videos").upload(
                path=storage_path,
                file=f.read(),
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )
        raw_video_url = supabase.storage.from_("videos").get_public_url(storage_path)

        # 3. Extrair áudio
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-ar", "16000", "-ac", "1", "-b:a", "128k", "-f", "mp3",
            audio_path,
        ], check=True, capture_output=True)

        # 4. Transcrição com faster-whisper (word timestamps)
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        fw_segments, _ = model.transcribe(audio_path, language="pt", word_timestamps=True)

        segments = []
        words = []
        for seg in fw_segments:
            segments.append({"start": seg.start, "end": seg.end, "text": seg.text})
            if seg.words:
                for w in seg.words:
                    words.append({"start": w.start, "end": w.end, "word": w.word})

        transcript_data = {"segments": segments, "words": words}

        # 5. INSERT na tabela projects
        project_data = {
            "user_id": user_id,
            "source_url": url,
            "platform": "youtube",
            "raw_video_url": raw_video_url,
            "transcript": transcript_data,
            "title": title,
            "status": "processing",
        }
        db_response = supabase.table("projects").insert(project_data).execute()
        project_id = db_response.data[0]['id']

        # 6. AI Curator — detectar momentos virais
        clips_meta = get_viral_clips(transcript_data)

        # Brand Kit do usuário (opcional)
        bk_resp = supabase.table("brand_kits").select("*").eq("user_id", user_id).maybe_single().execute()
        brand_kit = bk_resp.data if bk_resp and bk_resp.data else None

        # Arquivo de legendas (.ass) para todo o clipe
        subtitle_file = generate_ass(segments, str(tmp_dir / "subtitles.ass"))

        # 7, 8, 9. Cortar + upload + salvar cada clipe
        for i, clip in enumerate(clips_meta):
            clip_out = str(tmp_dir / f"clip_{i}.mp4")
            try:
                create_vertical_clip(
                    input_video=video_path,
                    output_video=clip_out,
                    start=clip["start_time"],
                    end=clip["end_time"],
                    brand_kit=brand_kit,
                    subtitle_file=subtitle_file,
                    hook_title=clip["hook_title"],
                )
            except Exception as e:
                print(f"[ffmpeg] erro no clipe {i}: {e}")
                continue

            if not os.path.exists(clip_out):
                continue

            clip_key = f"{user_id}/{project_id}/clip_{i}.mp4"
            with open(clip_out, "rb") as f:
                supabase.storage.from_("videos").upload(
                    path=clip_key,
                    file=f.read(),
                    file_options={"content-type": "video/mp4", "upsert": "true"},
                )
            clip_url = supabase.storage.from_("videos").get_public_url(clip_key)

            supabase.table("clips").insert({
                "project_id": project_id,
                "user_id": user_id,
                "title": clip["hook_title"],
                "hook": clip["hook_title"],
                "start_time": clip["start_time"],
                "end_time": clip["end_time"],
                "score": clip["ai_score"],
                "storage_url": clip_url,
                "storage_path": clip_key,
                "status": "ready",
            }).execute()

        # Atualizar status final
        supabase.table("projects").update({"status": "done"}).eq("id", project_id).execute()

        return {"status": "success", "project_id": project_id, "title": title}

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
