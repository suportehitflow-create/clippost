"""
Instagram pela API OFICIAL da Meta (Business Discovery) — a mesma opção do Agendador.

Lê os vídeos de qualquer perfil PROFISSIONAL (Business ou Creator) sem cookies e sem 429,
usando uma conta Instagram Business sua ligada a uma Página do Facebook. Devolve o link direto
de cada vídeo (media_url), que o servidor baixa sem login.

Credencial (a primeira que existir):
  1. FB_DISCOVERY_TOKEN + FB_DISCOVERY_IG_ID no ambiente (como no .env do Agendador)
  2. config salva pelo site: bucket privado config-privado/instagram_oficial.json
  3. conta de Instagram do próprio usuário conectada pela Meta (social_accounts.access_token)
"""
import json
import os
from datetime import datetime

import httpx

GRAPH = "https://graph.facebook.com/v21.0"
_BUCKET = "config-privado"
_ARQUIVO = "instagram_oficial.json"


def _supabase():
    from supabase import create_client
    return create_client(
        os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "https://alntulecjshpbrhesaoo.supabase.co",
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or "",
    )


def credenciais(user_id: str | None = None) -> dict | None:
    """{"token", "ig_id", "origem"} ou None."""
    if os.environ.get("FB_DISCOVERY_TOKEN") and os.environ.get("FB_DISCOVERY_IG_ID"):
        return {"token": os.environ["FB_DISCOVERY_TOKEN"], "ig_id": os.environ["FB_DISCOVERY_IG_ID"], "origem": "ambiente"}
    try:
        cfg = json.loads(_supabase().storage.from_(_BUCKET).download(_ARQUIVO))
        if cfg.get("token") and cfg.get("ig_id"):
            return {"token": cfg["token"], "ig_id": cfg["ig_id"], "origem": "site", "usuario": cfg.get("usuario")}
    except Exception:
        pass
    if user_id:
        try:
            rows = (
                _supabase().table("social_accounts").select("account_id, access_token, username")
                .eq("user_id", user_id).eq("platform", "instagram").execute().data or []
            )
            for r in rows:
                if r.get("access_token") and r.get("account_id"):
                    return {"token": r["access_token"], "ig_id": r["account_id"], "origem": "conta", "usuario": r.get("username")}
        except Exception:
            pass
    return None


def _erro_graph(resp: httpx.Response) -> str:
    try:
        return (resp.json().get("error") or {}).get("message") or resp.text[:200]
    except ValueError:
        return resp.text[:200]


def validar(token: str, ig_id: str) -> str:
    """Confere se a credencial funciona; devolve o @ da conta Business usada."""
    r = httpx.get(f"{GRAPH}/{ig_id}", params={"fields": "username", "access_token": token}, timeout=20)
    if not r.is_success:
        raise ValueError(f"A Meta recusou: {_erro_graph(r)}")
    return r.json().get("username") or ig_id


def salvar(token: str, ig_id: str, usuario: str) -> None:
    sb = _supabase()
    try:
        nomes = {b.name for b in sb.storage.list_buckets()}
        if _BUCKET not in nomes:
            sb.storage.create_bucket(_BUCKET, options={"public": False})
    except Exception:
        pass
    dados = json.dumps({"token": token, "ig_id": ig_id, "usuario": usuario, "salvo_em": datetime.utcnow().isoformat()}).encode()
    sb.storage.from_(_BUCKET).upload(_ARQUIVO, dados, {"content-type": "application/json", "upsert": "true"})


def remover() -> None:
    try:
        _supabase().storage.from_(_BUCKET).remove([_ARQUIVO])
    except Exception:
        pass


_TIPO = {"VIDEO": "reel", "IMAGE": "post", "CAROUSEL_ALBUM": "carrossel"}


def listar_midias(usuario: str, limite: int = 0, user_id: str | None = None) -> dict:
    """Perfil + TODAS as mídias (reels, posts, carrosséis), do mais novo para o mais antigo."""
    cred = credenciais(user_id)
    if not cred:
        raise RuntimeError("API oficial do Instagram não configurada")
    usuario = usuario.lstrip("@").strip("/")
    perfil: dict = {}
    itens: list[dict] = []
    depois = ""
    for _ in range(200):  # até ~10 mil mídias
        campos = (
            f"business_discovery.username({usuario}){{username,name,profile_picture_url,followers_count,media_count,"
            f"media.limit(50){'.after(' + depois + ')' if depois else ''}"
            "{id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}"
        )
        r = httpx.get(f"{GRAPH}/{cred['ig_id']}", params={"fields": campos, "access_token": cred["token"]}, timeout=30)
        if not r.is_success:
            msg = _erro_graph(r)
            if "not a business" in msg.lower() or "cannot be found" in msg.lower() or "(#110)" in msg:
                raise ValueError(f"@{usuario} não é um perfil profissional (Business/Creator).")
            raise ValueError(f"API oficial do Instagram: {msg}")
        bd = r.json().get("business_discovery") or {}
        if not perfil:
            perfil = {"usuario": bd.get("username") or usuario, "nome": bd.get("name"), "foto": bd.get("profile_picture_url"),
                      "seguidores": bd.get("followers_count"), "total_posts": bd.get("media_count")}
        midia = bd.get("media") or {}
        for m in midia.get("data") or []:
            ts = None
            try:
                ts = datetime.fromisoformat(str(m.get("timestamp")).replace("+0000", "+00:00")).timestamp()
            except ValueError:
                pass
            tipo = _TIPO.get(m.get("media_type"), "post")
            itens.append({
                "id": m.get("id"),
                "tipo": tipo,
                "url": m.get("media_url"),
                "thumbnail": m.get("thumbnail_url") or (m.get("media_url") if tipo != "reel" else None),
                "permalink": m.get("permalink"),
                "legenda": (m.get("caption") or "").strip(),
                "views": None,
                "likes": m.get("like_count"),
                "comentarios": m.get("comments_count"),
                "timestamp": ts,
                "duracao": None,
            })
            if limite and len(itens) >= limite:
                return {"perfil": perfil, "itens": itens}
        depois = ((midia.get("paging") or {}).get("cursors") or {}).get("after") or ""
        if not depois or not midia.get("data"):
            break
    return {"perfil": perfil, "itens": itens}


def listar_videos(usuario: str, limite: int = 0, user_id: str | None = None) -> list[dict]:
    """Vídeos (Reels) de um perfil profissional, do mais novo para o mais antigo, no formato do downloader."""
    cred = credenciais(user_id)
    if not cred:
        raise RuntimeError("API oficial do Instagram não configurada")
    usuario = usuario.lstrip("@").strip("/")
    videos: list[dict] = []
    depois = ""
    for _ in range(40):
        pagina = 50
        campos = (
            f"business_discovery.username({usuario}){{username,media_count,"
            f"media.limit({pagina}){'.after(' + depois + ')' if depois else ''}"
            "{id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}"
        )
        r = httpx.get(f"{GRAPH}/{cred['ig_id']}", params={"fields": campos, "access_token": cred["token"]}, timeout=30)
        if not r.is_success:
            msg = _erro_graph(r)
            if "not a business" in msg.lower() or "cannot be found" in msg.lower() or "(#110)" in msg:
                raise ValueError(f"@{usuario} não é um perfil profissional (Business/Creator) — use a extensão do Clipost para esse perfil.")
            raise ValueError(f"API oficial do Instagram: {msg}")
        bd = r.json().get("business_discovery") or {}
        midia = bd.get("media") or {}
        for m in midia.get("data") or []:
            if m.get("media_type") != "VIDEO" or not m.get("media_url"):
                continue
            ts = None
            try:
                ts = datetime.fromisoformat(str(m.get("timestamp")).replace("+0000", "+00:00")).timestamp()
            except ValueError:
                pass
            videos.append({
                "url": m["media_url"],
                "permalink": m.get("permalink"),
                "title": (m.get("caption") or "").replace("\n", " ").strip()[:200] or "Reel",
                "duration": None,
                "thumbnail": m.get("thumbnail_url"),
                "view_count": None,  # a Business Discovery não informa views de terceiros
                "like_count": m.get("like_count"),
                "comment_count": m.get("comments_count"),
                "timestamp": ts,
            })
            if limite and len(videos) >= limite:
                return videos
        depois = ((midia.get("paging") or {}).get("cursors") or {}).get("after") or ""
        if not depois or not midia.get("data"):
            break
    return videos
