"""YouTube Data API v3 (oficial, grátis): lista os vídeos de um canal com views, curtidas, comentários,
data e duração — sem raspar a página do YouTube, então não é bloqueada.

Liga sozinha quando houver YOUTUBE_API_KEY no servidor (chave criada no Google Cloud, cota grátis de
10.000 unidades/dia; listar 50 vídeos gasta ~2). Não baixa vídeos: o download continua pelo caminho comum.
"""
import os
import re
from datetime import datetime

import httpx

API = "https://www.googleapis.com/youtube/v3"


def chave() -> str:
    return (os.environ.get("YOUTUBE_API_KEY") or "").strip()


def _get(rota: str, **params) -> dict:
    r = httpx.get(f"{API}/{rota}", params={**params, "key": chave()}, timeout=20)
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message") or r.text
        except ValueError:
            msg = r.text
        raise RuntimeError(f"YouTube API {rota} ({r.status_code}): {msg[:200]}")
    return r.json()


def _segundos(iso: str | None) -> int | None:
    """PT1H2M3S → 3723"""
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return None
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _canal(url: str) -> dict:
    """Acha o canal a partir do link (@handle, /channel/UC..., /c/ ou /user/)."""
    parte = "snippet,contentDetails,statistics"
    if m := re.search(r"/channel/(UC[\w-]{22})", url):
        itens = _get("channels", part=parte, id=m.group(1)).get("items")
    elif m := re.search(r"/@([^/?#]+)", url):
        itens = _get("channels", part=parte, forHandle="@" + m.group(1)).get("items")
    elif m := re.search(r"/user/([^/?#]+)", url):
        itens = _get("channels", part=parte, forUsername=m.group(1)).get("items")
    else:
        nome = re.sub(r".*/(c/)?", "", url.rstrip("/"))
        busca = _get("search", part="snippet", type="channel", q=nome, maxResults=1).get("items") or []
        itens = _get("channels", part=parte, id=busca[0]["snippet"]["channelId"]).get("items") if busca else None
    if not itens:
        raise ValueError("Canal do YouTube não encontrado.")
    return itens[0]


def listar_canal(url: str, limite: int = 50) -> dict:
    """Mesmo formato do explorador de perfis: {"perfil": {...}, "itens": [...]}, do mais novo ao mais antigo.
    limite=0 lê o canal inteiro (até 2.000 vídeos)."""
    canal = _canal(url)
    uploads = canal["contentDetails"]["relatedPlaylists"]["uploads"]
    teto = 2000 if not limite else min(int(limite), 2000)

    ids, pagina = [], None
    while len(ids) < teto:
        r = _get("playlistItems", part="contentDetails", playlistId=uploads, maxResults=50,
                 **({"pageToken": pagina} if pagina else {}))
        ids += [i["contentDetails"]["videoId"] for i in r.get("items", [])]
        pagina = r.get("nextPageToken")
        if not pagina:
            break
    ids = ids[:teto]

    itens = []
    for i in range(0, len(ids), 50):
        r = _get("videos", part="snippet,statistics,contentDetails", id=",".join(ids[i:i + 50]))
        for v in r.get("items", []):
            sn, st = v.get("snippet", {}), v.get("statistics", {})
            thumbs = sn.get("thumbnails", {})
            capa = (thumbs.get("maxres") or thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
            try:
                ts = int(datetime.fromisoformat(sn["publishedAt"].replace("Z", "+00:00")).timestamp())
            except (KeyError, ValueError):
                ts = None
            link = f"https://www.youtube.com/watch?v={v['id']}"
            itens.append({
                "id": link, "tipo": "reel", "url": link, "permalink": link, "thumbnail": capa,
                "legenda": sn.get("title") or "",
                "views": int(st["viewCount"]) if st.get("viewCount") else None,
                "likes": int(st["likeCount"]) if st.get("likeCount") else None,
                "comentarios": int(st["commentCount"]) if st.get("commentCount") else None,
                "timestamp": ts, "duracao": _segundos(v.get("contentDetails", {}).get("duration")),
            })
    itens.sort(key=lambda x: x.get("timestamp") or 0, reverse=True)

    sn, st = canal.get("snippet", {}), canal.get("statistics", {})
    return {
        "perfil": {
            "usuario": (sn.get("customUrl") or sn.get("title") or "").lstrip("@"),
            "nome": sn.get("title"),
            "foto": ((sn.get("thumbnails") or {}).get("high") or (sn.get("thumbnails") or {}).get("default") or {}).get("url"),
            "seguidores": None if st.get("hiddenSubscriberCount") else (int(st["subscriberCount"]) if st.get("subscriberCount") else None),
            "total_posts": int(st["videoCount"]) if st.get("videoCount") else None,
        },
        "itens": itens,
    }
