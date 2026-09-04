"""
ClipPost Backend — FastAPI
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from tasks import process_youtube_video
from supabase import create_client

load_dotenv()

app = FastAPI(title="ClipPost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
)


class ProcessRequest(BaseModel):
    url: str
    user_id: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/process-url")
async def process_url(req: ProcessRequest):
    """Aciona o worker Celery para processar a URL do YouTube."""
    task = process_youtube_video.delay(req.url, req.user_id)
    return {"task_id": task.id, "status": "processing"}


@app.post("/api/jobs")
async def create_job(req: ProcessRequest):
    """Alias de /api/process-url para compatibilidade."""
    task = process_youtube_video.delay(req.url, req.user_id)
    return {"task_id": task.id, "status": "processing"}


@app.get("/api/projects/{user_id}")
async def list_projects(user_id: str):
    """Lista os vídeos importados pelo usuário."""
    resp = (
        supabase.table("projects")
        .select("id, title, source_url, platform, raw_video_url, status, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"projects": resp.data}


@app.get("/api/clips/{project_id}")
async def list_clips(project_id: str):
    """Lista os clipes gerados para um projeto, ordenados por ai_score."""
    proj = supabase.table("projects").select("*").eq("id", project_id).maybe_single().execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    clips = (
        supabase.table("clips")
        .select("*")
        .eq("project_id", project_id)
        .order("score", desc=True)
        .execute()
    )
    return {
        "project": proj.data,
        "clips": clips.data,
    }


@app.get("/api/jobs/{project_id}")
async def get_job_status(project_id: str):
    """Status de um job pelo project_id."""
    proj = supabase.table("projects").select("*").eq("id", project_id).maybe_single().execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    clips = (
        supabase.table("clips")
        .select("*")
        .eq("project_id", project_id)
        .order("score", desc=True)
        .execute()
    )
    return {
        "project_id": project_id,
        "status": proj.data["status"],
        "title": proj.data.get("title"),
        "raw_video_url": proj.data.get("raw_video_url"),
        "clips": clips.data,
    }
