"""
ClipPost Backend — FastAPI
Endpoints:
  POST /api/jobs          — cria job de processamento
  GET  /api/jobs/{id}     — status do job + clips
  WS   /ws/{job_id}       — progresso em tempo real
"""
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from tasks import process_video
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
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


class JobRequest(BaseModel):
    project_id: str
    user_id: str
    source_type: str  # "url" | "file"
    source_url: str | None = None


@app.post("/api/jobs")
async def create_job(req: JobRequest):
    # Update project status to processing
    supabase.table("projects").update({"status": "processing"}).eq("id", req.project_id).execute()
    # Dispatch Celery task
    task = process_video.delay(req.project_id, req.user_id, req.source_type, req.source_url)
    return {"task_id": task.id, "project_id": req.project_id, "status": "processing"}


@app.get("/api/jobs/{project_id}")
async def get_job_status(project_id: str):
    proj = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    clips = supabase.table("clips").select("*").eq("project_id", project_id).order("score", desc=True).execute()
    return {
        "project_id": project_id,
        "status": proj.data["status"],
        "error": proj.data.get("error_message"),
        "clips": clips.data,
    }


# WebSocket for real-time progress updates
connections: dict[str, list[WebSocket]] = {}

@app.websocket("/ws/{project_id}")
async def websocket_progress(websocket: WebSocket, project_id: str):
    await websocket.accept()
    connections.setdefault(project_id, []).append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections[project_id].remove(websocket)


async def broadcast(project_id: str, message: dict):
    for ws in connections.get(project_id, []):
        try:
            await ws.send_json(message)
        except Exception:
            pass
