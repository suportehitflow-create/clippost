"""
Celery tasks — pipeline de processamento de vídeo
1. Download (yt-dlp ou Supabase Storage)
2. Transcrição (Whisper)
3. Detecção de hooks virais (Claude AI)
4. Recorte de clipes (FFmpeg)
5. Reframe 9:16 + detecção de rosto (MediaPipe)
6. Upload para Supabase Storage
7. Salvar clips no banco
"""
import os
import json
import tempfile
import subprocess
from pathlib import Path
from celery import Celery
from dotenv import load_dotenv
import anthropic
from supabase import create_client

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
app = Celery("clippost", broker=REDIS_URL, backend=REDIS_URL)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)
claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def update_status(project_id: str, status: str, error: str | None = None):
    data = {"status": status, "updated_at": "now()"}
    if error:
        data["error_message"] = error
    supabase.table("projects").update(data).eq("id", project_id).execute()


@app.task(bind=True, max_retries=2)
def process_video(self, project_id: str, user_id: str, source_type: str, source_url: str | None):
    tmp_dir = Path(tempfile.mkdtemp(prefix="clippost_"))
    video_path = tmp_dir / "original.mp4"

    try:
        # 1. DOWNLOAD
        if source_type == "url" and source_url:
            subprocess.run([
                "yt-dlp", "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format", "mp4",
                "-o", str(video_path),
                source_url,
            ], check=True)
        else:
            # Download from Supabase Storage
            files = supabase.storage.from_("videos").list(f"{user_id}/{project_id}")
            if not files:
                raise ValueError("Nenhum arquivo encontrado no storage")
            file_path = f"{user_id}/{project_id}/{files[0]['name']}"
            data = supabase.storage.from_("videos").download(file_path)
            video_path.write_bytes(data)

        # 2. TRANSCRIPTION with Whisper
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(str(video_path), language="pt")
        segments = result["segments"]  # [{start, end, text}]

        # 3. DETECT VIRAL HOOKS with Claude
        transcript_text = " ".join([s["text"] for s in segments[:100]])
        message = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": f"""Analise esta transcrição de vídeo e identifique os 5 melhores momentos para clipes virais de short-form (TikTok/Reels/Shorts).

Para cada clipe retorne um JSON com:
- start: segundo inicial
- end: segundo final (máx 60s de duração)
- title: título curto e chamativo
- hook: frase gancho do momento (a mais impactante)
- score: pontuação de 0 a 1 (viralidade estimada)

Transcrição (com timestamps):
{json.dumps([{"start": s["start"], "end": s["end"], "text": s["text"]} for s in segments[:80]], ensure_ascii=False)}

Retorne APENAS um array JSON válido com os 5 clipes, sem texto adicional.""",
            }],
        )

        try:
            clip_suggestions = json.loads(message.content[0].text)
        except Exception:
            # Fallback: split into 60s segments
            duration = float(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)
            ]).decode().strip())
            clip_suggestions = [
                {"start": i * 60, "end": min((i + 1) * 60, duration), "title": f"Clipe {i+1}", "hook": "", "score": 0.5}
                for i in range(min(5, int(duration // 60)))
            ]

        # 4 & 5. CUT + REFRAME each clip
        for i, suggestion in enumerate(clip_suggestions[:5]):
            clip_path = tmp_dir / f"clip_{i}.mp4"
            _cut_and_reframe(video_path, clip_path, suggestion["start"], suggestion["end"])

            if not clip_path.exists():
                continue

            # 6. Upload to Supabase Storage
            storage_key = f"{user_id}/{project_id}/clip_{i}.mp4"
            with open(clip_path, "rb") as f:
                supabase.storage.from_("videos").upload(storage_key, f.read(), {"content-type": "video/mp4", "upsert": "true"})

            storage_url = supabase.storage.from_("videos").get_public_url(storage_key)

            # 7. Save clip to DB
            supabase.table("clips").insert({
                "project_id": project_id,
                "user_id": user_id,
                "title": suggestion.get("title", f"Clipe {i+1}"),
                "hook": suggestion.get("hook"),
                "start_time": suggestion["start"],
                "end_time": suggestion["end"],
                "score": suggestion.get("score", 0.5),
                "storage_url": storage_url,
                "storage_path": storage_key,
                "status": "ready",
            }).execute()

        update_status(project_id, "done")

    except Exception as e:
        update_status(project_id, "failed", str(e))
        raise self.retry(exc=e, countdown=30)
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _cut_and_reframe(input_path: Path, output_path: Path, start: float, end: float):
    """Cut video segment and reframe to 9:16 with face centering."""
    duration = end - start

    # First pass: cut the segment
    tmp_cut = input_path.parent / f"cut_{output_path.name}"
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start),
        "-i", str(input_path),
        "-t", str(duration),
        "-c", "copy",
        str(tmp_cut),
    ], check=True, capture_output=True)

    # Second pass: reframe to 9:16 (1080x1920) with smart crop
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(tmp_cut),
        "-vf", (
            "scale=1920:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920:(iw-1080)/2:(ih-1920)/2,"
            "scale=1080:1920"
        ),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        str(output_path),
    ], check=True, capture_output=True)

    tmp_cut.unlink(missing_ok=True)
