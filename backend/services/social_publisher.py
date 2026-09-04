"""
Social Publisher — publica Reels no Instagram via Meta Graph API.

Fluxo:
  1. POST /{account_id}/media  → cria container de mídia (status: IN_PROGRESS)
  2. Polling /{container_id}?fields=status_code até FINISHED
  3. POST /{account_id}/media_publish → publica o container
"""
import time
import requests

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class InstagramPublishError(Exception):
    pass


def _check_container_status(container_id: str, access_token: str, timeout: int = 300) -> str:
    """Aguarda o container de vídeo ficar FINISHED (Instagram processa async)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = requests.get(
            f"{GRAPH_BASE}/{container_id}",
            params={"fields": "status_code,status", "access_token": access_token},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status_code", "")
        if status == "FINISHED":
            return container_id
        if status in ("ERROR", "EXPIRED"):
            raise InstagramPublishError(f"Container falhou com status: {status} — {data}")
        time.sleep(5)
    raise InstagramPublishError(f"Container {container_id} não ficou FINISHED em {timeout}s")


def publish_reel(
    account_id: str,
    access_token: str,
    video_url: str,
    caption: str,
) -> dict:
    """
    Publica um Reel no Instagram.

    Args:
        account_id:   Instagram Business/Creator Account ID
        access_token: Page Access Token (ou User Token com instagram_basic, pages_manage_posts)
        video_url:    URL pública do vídeo MP4 (Supabase Storage)
        caption:      Texto da legenda

    Returns:
        {"media_id": "...", "permalink": "..."}
    """
    # 1. Criar container de mídia
    create_resp = requests.post(
        f"{GRAPH_BASE}/{account_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": access_token,
        },
        timeout=30,
    )
    if not create_resp.ok:
        raise InstagramPublishError(
            f"Erro ao criar container: {create_resp.status_code} — {create_resp.text}"
        )
    container_id = create_resp.json()["id"]

    # 2. Aguardar processamento
    _check_container_status(container_id, access_token)

    # 3. Publicar
    publish_resp = requests.post(
        f"{GRAPH_BASE}/{account_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": access_token,
        },
        timeout=30,
    )
    if not publish_resp.ok:
        raise InstagramPublishError(
            f"Erro ao publicar: {publish_resp.status_code} — {publish_resp.text}"
        )
    media_id = publish_resp.json()["id"]

    # 4. Buscar permalink
    permalink_resp = requests.get(
        f"{GRAPH_BASE}/{media_id}",
        params={"fields": "permalink", "access_token": access_token},
        timeout=15,
    )
    permalink = permalink_resp.json().get("permalink", "") if permalink_resp.ok else ""

    return {"media_id": media_id, "permalink": permalink}
