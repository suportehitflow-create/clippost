"""
Upload-Post — publicação em TikTok, Instagram e YouTube via API white label.

Cada usuário do clipost vira um perfil na Upload-Post, com o próprio user_id
como username. A Upload-Post cuida do OAuth e da renovação dos tokens; o clipost
só guarda qual rede está conectada e manda publicar.
"""
import os
import time

import httpx

API_BASE = "https://api.upload-post.com/api"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://clippost-three.vercel.app")
PLATFORMS = ["tiktok", "instagram", "youtube"]


class UploadPostError(Exception):
    pass


def _headers() -> dict:
    key = os.environ.get("UPLOAD_POST_API_KEY")
    if not key:
        raise UploadPostError("UPLOAD_POST_API_KEY não configurada no backend.")
    return {"Authorization": f"Apikey {key}"}


def _error_message(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        return body.get("message") or body.get("error") or resp.text
    except ValueError:
        return resp.text


def ensure_profile(user_id: str) -> None:
    resp = httpx.post(f"{API_BASE}/uploadposts/users", headers=_headers(),
                      json={"username": user_id}, timeout=30)
    if resp.status_code in (200, 201, 409):
        return
    if resp.status_code == 403:
        raise UploadPostError("Limite de perfis do plano Upload-Post atingido.")
    raise UploadPostError(f"Erro ao criar perfil ({resp.status_code}): {_error_message(resp)}")


def connect_url(user_id: str) -> str:
    ensure_profile(user_id)
    resp = httpx.post(
        f"{API_BASE}/uploadposts/users/generate-jwt",
        headers=_headers(),
        json={
            "username": user_id,
            "redirect_url": f"{FRONTEND_URL}/schedule?connected=1",
            "redirect_button_text": "Voltar para o clipost",
            "connect_title": "Conecte suas redes ao clipost",
            "connect_description": "Autorize as contas onde seus clipes serão publicados.",
            "platforms": PLATFORMS,
            "show_calendar": False,
            "language": "pt",
        },
        timeout=30,
    )
    if not resp.is_success:
        raise UploadPostError(f"Erro ao gerar link de conexão ({resp.status_code}): {_error_message(resp)}")
    url = resp.json().get("access_url")
    if not url:
        raise UploadPostError("Upload-Post não devolveu access_url.")
    return url


def connected_accounts(user_id: str) -> list[dict]:
    """Redes conectadas e prontas para publicar."""
    resp = httpx.get(f"{API_BASE}/uploadposts/users/{user_id}", headers=_headers(), timeout=30)
    if resp.status_code == 404:
        return []
    if not resp.is_success:
        raise UploadPostError(f"Erro ao ler perfil ({resp.status_code}): {_error_message(resp)}")
    body = resp.json()
    profile = body.get("profile") or next(iter(body.get("profiles") or []), {}) or {}
    accounts = []
    for platform, info in (profile.get("social_accounts") or {}).items():
        if platform not in PLATFORMS or not isinstance(info, dict):
            continue
        accounts.append({
            "platform": platform,
            "account_id": str(info.get("username") or ""),
            "handle": info.get("handle") or info.get("display_name") or platform,
            "reauth_required": bool(info.get("reauth_required")),
        })
    return accounts


def publish_video(user_id: str, platform: str, video_url: str, caption: str,
                  title: str, post_id: str, timeout: int = 300) -> dict:
    """Publica agora e espera o resultado. Retorna {"url": ...} ou levanta UploadPostError."""
    resp = httpx.post(
        f"{API_BASE}/upload",
        headers={**_headers(), "Idempotency-Key": post_id},
        data={
            "user": user_id,
            "platform[]": platform,
            "video": video_url,
            "title": (title or caption or "clipost")[:100],
            "description": caption,
            f"{platform}_title": caption[:2200] if platform != "youtube" else (title or caption)[:100],
            "external_id": post_id,
            "async_upload": "true",
        },
        timeout=60,
    )
    if not resp.is_success:
        raise UploadPostError(f"Upload recusado ({resp.status_code}): {_error_message(resp)}")
    body = resp.json()
    if "results" in body:
        return _platform_result(body["results"], platform)

    request_id = body.get("request_id")
    if not request_id:
        raise UploadPostError(f"Resposta sem request_id: {body}")

    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(10)
        st = httpx.get(f"{API_BASE}/uploadposts/status", headers=_headers(),
                       params={"request_id": request_id}, timeout=30)
        if not st.is_success:
            continue
        data = st.json()
        if data.get("status") in ("completed", "failed"):
            return _platform_result(data.get("results") or {}, platform)
    raise UploadPostError(f"Upload {request_id} não terminou em {timeout}s.")


def _platform_result(results, platform: str) -> dict:
    if isinstance(results, list):
        results = {r.get("platform"): r for r in results if isinstance(r, dict)}
    r = (results or {}).get(platform) or {}
    if r.get("success"):
        return {"url": r.get("url") or r.get("post_url") or ""}
    raise UploadPostError(r.get("error") or f"Falha ao publicar no {platform}.")
