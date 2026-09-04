"""
ClipPost Backend — FastAPI
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import Request
from tasks import process_youtube_video
from supabase import create_client
from services.stripe_service import (
    create_checkout_session, handle_webhook,
    get_plan_status, get_billing_portal_url,
)

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


class BrandKitRequest(BaseModel):
    user_id: str
    avatar_url: str | None = None
    username: str | None = None
    layout_config: dict | None = None


class SchedulePostRequest(BaseModel):
    user_id: str
    clip_id: str
    social_account_id: str
    caption: str
    scheduled_time: str  # ISO 8601


class SocialAccountRequest(BaseModel):
    user_id: str
    platform: str = "instagram"
    access_token: str
    account_id: str
    username: str | None = None


class CheckoutRequest(BaseModel):
    user_id: str
    email: str


@app.get("/api/brand-kit/{user_id}")
async def get_brand_kit(user_id: str):
    resp = supabase.table("brand_kits").select("*").eq("user_id", user_id).maybe_single().execute()
    return {"brand_kit": resp.data}


@app.post("/api/brand-kit")
async def upsert_brand_kit(req: BrandKitRequest):
    existing = supabase.table("brand_kits").select("id").eq("user_id", req.user_id).maybe_single().execute()
    data = {
        "user_id": req.user_id,
        **({"avatar_url": req.avatar_url} if req.avatar_url is not None else {}),
        **({"username": req.username} if req.username is not None else {}),
        **({"layout_config": req.layout_config} if req.layout_config is not None else {}),
    }
    if existing.data:
        supabase.table("brand_kits").update(data).eq("user_id", req.user_id).execute()
    else:
        supabase.table("brand_kits").insert(data).execute()
    result = supabase.table("brand_kits").select("*").eq("user_id", req.user_id).maybe_single().execute()
    return {"brand_kit": result.data}


@app.get("/api/social-accounts/{user_id}")
async def list_social_accounts(user_id: str):
    resp = supabase.table("social_accounts").select("id,platform,username,account_id,created_at").eq("user_id", user_id).execute()
    return {"accounts": resp.data}


@app.post("/api/social-accounts")
async def upsert_social_account(req: SocialAccountRequest):
    existing = supabase.table("social_accounts").select("id").eq("user_id", req.user_id).eq("platform", req.platform).eq("account_id", req.account_id).maybe_single().execute()
    data = {"user_id": req.user_id, "platform": req.platform, "access_token": req.access_token, "account_id": req.account_id, "username": req.username}
    if existing.data:
        supabase.table("social_accounts").update(data).eq("id", existing.data["id"]).execute()
        record_id = existing.data["id"]
    else:
        record_id = supabase.table("social_accounts").insert(data).execute().data[0]["id"]
    result = supabase.table("social_accounts").select("*").eq("id", record_id).maybe_single().execute()
    return {"account": result.data}


@app.get("/api/scheduled-posts/{user_id}")
async def list_scheduled_posts(user_id: str):
    resp = (
        supabase.table("scheduled_posts")
        .select("*, clips(title, storage_url), social_accounts(platform, username)")
        .eq("user_id", user_id)
        .order("scheduled_time", desc=False)
        .execute()
    )
    return {"posts": resp.data}


@app.post("/api/scheduled-posts")
async def create_scheduled_post(req: SchedulePostRequest):
    data = {
        "user_id": req.user_id,
        "clip_id": req.clip_id,
        "social_account_id": req.social_account_id,
        "caption": req.caption,
        "scheduled_time": req.scheduled_time,
        "status": "pending",
    }
    resp = supabase.table("scheduled_posts").insert(data).execute()
    return {"post": resp.data[0] if resp.data else None}


@app.delete("/api/scheduled-posts/{post_id}")
async def delete_scheduled_post(post_id: str):
    supabase.table("scheduled_posts").delete().eq("id", post_id).eq("status", "pending").execute()
    return {"deleted": True}


@app.get("/api/billing/status/{user_id}")
async def billing_status(user_id: str):
    return get_plan_status(user_id)


@app.post("/api/billing/checkout")
async def billing_checkout(req: CheckoutRequest):
    url = create_checkout_session(req.user_id, req.email)
    return {"url": url}


@app.get("/api/billing/portal/{user_id}")
async def billing_portal(user_id: str):
    url = get_billing_portal_url(user_id)
    if not url:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura encontrada")
    return {"url": url}


@app.post("/api/billing/webhook")
async def billing_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        handle_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"received": True}


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
