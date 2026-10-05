"""Conteúdo de origem dos carrosséis: transforma um link (YouTube/podcast, Instagram, artigo, site)
ou um texto colado em {titulo, texto, segments, video, imagens}.

- vídeo: legenda do próprio YouTube quando houver (rápido); senão baixa e transcreve o áudio
- artigo/site: título, texto dos parágrafos e a imagem de capa (og:image)
- texto colado: usa como está
O vídeo baixado fica na pasta temporária do trabalho: é dele que saem os frames das imagens.
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

import httpx

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0 Safari/537.36")

VIDEO = re.compile(r"^https?://([^/]*\.)?(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitch\.tv|"
                   r"facebook\.com|fb\.watch|x\.com|twitter\.com|kick\.com)/", re.I)
INSTAGRAM = re.compile(r"^https?://([^/]*\.)?instagram\.com/", re.I)


def tipo_da_fonte(fonte: str) -> str:
    f = (fonte or "").strip()
    if not re.match(r"^https?://", f, re.I):
        return "texto"
    if INSTAGRAM.match(f):
        return "instagram"
    if VIDEO.match(f):
        return "video"
    return "pagina"


# ─── vídeo ────────────────────────────────────────────────────────────────────

def _titulo_video(url: str) -> str:
    try:
        r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
        if r.status_code == 200:
            return r.json().get("title") or ""
    except Exception:
        pass
    return ""


def _transcrever(video: Path, pasta: Path) -> dict:
    from tasks import transcribe_media
    return transcribe_media(str(video), str(pasta / "audio.mp3"))


def obter_video(url: str, pasta: Path, com_video: bool = True, aviso=print) -> dict:
    from services import baixador, transcricao_youtube

    titulo = _titulo_video(url) if "youtu" in url else ""
    tr = transcricao_youtube.transcricao(url) if "youtu" in url else None
    video = None
    if com_video or not tr:
        aviso("baixando o vídeo")
        try:
            # 720p basta para os frames e baixa rápido
            video = baixador.baixar(url, pasta / "video", "mp4", 720)
        except Exception as e:
            print(f"[carrossel] download falhou: {type(e).__name__}: {str(e)[:160]}")
            if not tr:
                raise RuntimeError("Não consegui baixar o vídeo nem a legenda desse link.")
    if not tr:
        aviso("transcrevendo o áudio")
        tr = _transcrever(video, pasta)
    segs = tr.get("segments") or []
    texto = " ".join(str(s.get("text") or "").strip() for s in segs)
    if not texto.strip():
        raise RuntimeError("O vídeo não tem fala para virar carrossel.")
    return {"tipo": "video", "titulo": titulo, "texto": texto, "segments": segs, "video": video, "imagens": []}


# ─── Instagram ────────────────────────────────────────────────────────────────

def obter_instagram(url: str, pasta: Path, aviso=print) -> dict:
    """Reel/vídeo: baixa e transcreve. Post de foto(s): legenda + as próprias fotos."""
    legenda, imagens = "", []
    try:
        p = subprocess.run([sys.executable, "-m", "gallery_dl", "-j", url], capture_output=True, text=True,
                           timeout=90, encoding="utf-8", errors="replace")
        dados = json.loads(p.stdout or "[]")
        for item in dados:
            if isinstance(item, list) and len(item) >= 3 and isinstance(item[2], dict):
                legenda = legenda or str(item[2].get("description") or "")
                if str(item[1]).startswith("http") and str(item[2].get("extension")) in ("jpg", "jpeg", "png", "webp"):
                    imagens.append(item[1])
    except Exception as e:
        print(f"[carrossel] gallery-dl: {type(e).__name__}: {str(e)[:120]}")

    video = None
    try:
        aviso("baixando o vídeo")
        from services import baixador
        video = baixador.baixar(url, pasta / "video", "mp4", 720)
    except Exception:
        video = None

    segs = []
    if video:
        aviso("transcrevendo o áudio")
        try:
            segs = _transcrever(video, pasta).get("segments") or []
        except Exception as e:
            print(f"[carrossel] transcrição: {type(e).__name__}")
    fala = " ".join(str(s.get("text") or "").strip() for s in segs)
    texto = "\n\n".join(t for t in (legenda.strip(), fala.strip()) if t)
    if not texto:
        raise RuntimeError("Não consegui ler esse post do Instagram (pode ser privado).")
    return {"tipo": "instagram", "titulo": legenda.split("\n")[0][:120], "texto": texto, "segments": segs,
            "video": video, "imagens": imagens[:10]}


# ─── artigo / site ────────────────────────────────────────────────────────────

def _meta(html_txt: str, prop: str) -> str:
    m = re.search(rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]*content=["\']([^"\']+)', html_txt, re.I) \
        or re.search(rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']{re.escape(prop)}["\']', html_txt, re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def _limpar(trecho: str) -> str:
    t = re.sub(r"<[^>]+>", " ", trecho)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def extrair_pagina(html_txt: str) -> dict:
    corpo = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header|aside|form)[^>]*>.*?</\1>", " ", html_txt)
    artigo = re.search(r"(?is)<article[^>]*>(.*?)</article>", corpo)
    base = artigo.group(1) if artigo else corpo
    partes = [_limpar(p) for p in re.findall(r"(?is)<(?:p|h2|h3|li|blockquote)[^>]*>(.*?)</(?:p|h2|h3|li|blockquote)>", base)]
    partes = [p for p in partes if len(p) > 40]
    titulo = _meta(html_txt, "og:title") or _limpar((re.search(r"(?is)<title[^>]*>(.*?)</title>", html_txt) or [None, ""])[1])
    return {"titulo": titulo[:200], "texto": "\n\n".join(partes), "imagem": _meta(html_txt, "og:image")}


def url_segura(url: str) -> bool:
    """Só http/https nas portas 80/443 e só endereços públicos: bloqueia localhost, rede interna do servidor,
    metadata de nuvem (169.254.x) e qualquer nome que resolva para eles."""
    import ipaddress
    import socket
    from urllib.parse import urlparse
    try:
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname or u.port not in (None, 80, 443):
            return False
        for info in socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80)):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
                return False
        return True
    except Exception:
        return False


def baixar_seguro(url: str, limite: int = 10_000_000, tipo_prefixo: str | None = None, timeout: float = 25) -> tuple[bytes, str]:
    """GET com validação a cada redirect (até 4), teto de tamanho e tipo opcional. Devolve (bytes, content-type)."""
    from urllib.parse import urljoin
    atual = url
    with httpx.Client(timeout=timeout, follow_redirects=False,
                      headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"}) as c:
        for _ in range(5):
            if not url_segura(atual):
                raise RuntimeError("Esse endereço não é permitido.")
            with c.stream("GET", atual) as r:
                if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                    atual = urljoin(atual, r.headers["location"])
                    continue
                r.raise_for_status()
                tipo = r.headers.get("content-type", "")
                if tipo_prefixo and not tipo.lower().startswith(tipo_prefixo):
                    raise RuntimeError("Tipo de arquivo inesperado.")
                dados = bytearray()
                for parte in r.iter_bytes():
                    dados += parte
                    if len(dados) > limite:
                        raise RuntimeError("Arquivo grande demais.")
                return bytes(dados), tipo
    raise RuntimeError("Redirecionamentos demais.")


def obter_pagina(url: str) -> dict:
    dados, _ = baixar_seguro(url, limite=5_000_000)
    p = extrair_pagina(dados.decode("utf-8", errors="replace"))
    if len(p["texto"]) < 300:
        raise RuntimeError("Não achei texto suficiente nessa página.")
    return {"tipo": "pagina", "titulo": p["titulo"], "texto": p["texto"][:120000], "segments": [], "video": None,
            "imagens": [p["imagem"]] if p["imagem"] else []}


def obter(fonte: str, pasta: Path, com_video: bool = True, aviso=print) -> dict:
    tipo = tipo_da_fonte(fonte)
    pasta.mkdir(parents=True, exist_ok=True)
    if tipo in ("pagina", "video", "instagram") and not url_segura(fonte):
        raise RuntimeError("Esse endereço não é permitido.")
    if tipo == "texto":
        texto = fonte.strip()[:60000]
        if len(texto) < 200:
            raise RuntimeError("Texto curto demais: cole o conteúdo inteiro ou um link.")
        return {"tipo": "texto", "titulo": texto.split("\n")[0][:120], "texto": texto, "segments": [], "video": None, "imagens": []}
    if tipo == "instagram":
        return obter_instagram(fonte, pasta, aviso)
    if tipo == "video":
        return obter_video(fonte, pasta, com_video, aviso)
    return obter_pagina(fonte)
