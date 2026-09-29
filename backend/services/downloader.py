"""
Funções de download e metadados — inspiradas no algoritmo do ReClip.

O ReClip provou que yt-dlp funciona para 1000+ plataformas com uma única
lógica: pegar o melhor bitrate por resolução, sem tentar formatos específicos
por plataforma. Adotamos o mesmo algoritmo aqui.
"""
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone


# Padrões de plataforma para ajuste de pipeline
_PLATAFORMAS = {
    "youtube":   [r"youtube\.com", r"youtu\.be"],
    "tiktok":    [r"tiktok\.com"],
    "instagram": [r"instagram\.com"],
    "twitter":   [r"twitter\.com", r"x\.com"],
    "twitch":    [r"twitch\.tv"],
    "reddit":    [r"reddit\.com", r"redd\.it"],
    "vimeo":     [r"vimeo\.com"],
    "facebook":  [r"facebook\.com", r"fb\.com", r"fb\.watch"],
}


def detect_platform(url: str) -> str:
    """Detecta a plataforma a partir da URL."""
    for plataforma, padroes in _PLATAFORMAS.items():
        for p in padroes:
            if re.search(p, url, re.IGNORECASE):
                return plataforma
    return "unknown"


def get_pipeline_config(platform: str) -> dict:
    """Configuração de pipeline por plataforma."""
    configs = {
        "youtube": {
            "try_auto_captions": True,
            "transcription": "auto",
            "supports_playlists": True,
        },
        "tiktok": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": True,
        },
        "instagram": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": True,
        },
        "twitter": {
            "try_auto_captions": False,
            "transcription": "whisper",
            "supports_playlists": False,
        },
    }
    return configs.get(platform, {
        "try_auto_captions": False,
        "transcription": "whisper",
        "supports_playlists": False,
    })


def fetch_video_info(url: str) -> dict:
    """
    Obtém metadados do vídeo de qualquer plataforma suportada pelo yt-dlp.

    Algoritmo do ReClip: seleciona o melhor bitrate por resolução em vez de
    forçar um par de formato específico — funciona em 1000+ plataformas sem
    nenhuma lógica por site.

    Retorna: title, thumbnail, duration, uploader, platform, formats
    """
    cmd = ["yt-dlp", "--no-playlist", "-j", "--no-warnings", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        ultimo_erro = (result.stderr.strip().split("\n") or ["Erro desconhecido"])[-1]
        raise ValueError(ultimo_erro)

    info = json.loads(result.stdout)

    # Algoritmo do ReClip: melhor bitrate por resolução
    best_by_height: dict = {}
    for f in info.get("formats", []):
        height = f.get("height")
        if height and f.get("vcodec", "none") != "none":
            tbr = f.get("tbr") or 0
            existing = best_by_height.get(height)
            if existing is None or tbr > (existing.get("tbr") or 0):
                best_by_height[height] = f

    formats = sorted(
        [
            {"id": f["format_id"], "label": f"{h}p", "height": h}
            for h, f in best_by_height.items()
        ],
        key=lambda x: x["height"],
        reverse=True,
    )

    plataforma = detect_platform(url) or info.get("extractor_key", "unknown").lower()
    subtitles = info.get("subtitles") or {}
    auto_subtitles = info.get("automatic_captions") or {}
    has_native_subs = bool(
        any(k in subtitles for k in ("pt", "pt-BR", "pt-pt", "en")) or
        any(k in auto_subtitles for k in ("pt", "pt-BR", "pt-pt", "en"))
    )
    subs_langs = list(set(list(subtitles.keys()) + list(auto_subtitles.keys())))[:5]
    raw_chapters = info.get("chapters") or []
    chapters = [
        {
            "title": c.get("title", ""),
            "start_time": round(float(c.get("start_time", 0.0)), 2),
            "end_time": round(float(c.get("end_time", 0.0)), 2),
        }
        for c in raw_chapters
        if c.get("title")
    ]

    return {
        "title":       info.get("title", ""),
        "thumbnail":   info.get("thumbnail", ""),
        "duration":    info.get("duration"),
        "uploader":    info.get("uploader", ""),
        "platform":    plataforma,
        "formats":     formats,
        "webpage_url": info.get("webpage_url", url),
        "pipeline":    get_pipeline_config(plataforma),
        "has_native_subtitles": has_native_subs,
        "native_subtitle_languages": subs_langs,
        "processing_speed": "turbo_native" if has_native_subs else "whisper_standard",
        "estimated_time": "~15s (Modo Turbo: Legenda Nativa)" if has_native_subs else "1-3min (Whisper IA)",
        "chapters": chapters,
        "has_chapters": len(chapters) > 0,
        "chapter_count": len(chapters),
    }


def get_playlist_videos(url: str, limit: int = 50) -> dict:
    """
    Lista vídeos de uma playlist, canal ou perfil sem baixar nenhum vídeo.

    Funciona para: playlists do YouTube, canais (@handle/videos),
    perfis do TikTok, perfis do Instagram (público), e outros.

    Retorna os vídeos ordenados por visualizações (mais viral primeiro).
    """
    cmd = [
        "yt-dlp", "--flat-playlist", "-J",
        "--no-warnings",
        "--playlist-end", str(limit),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        ultimo_erro = (result.stderr.strip().split("\n") or ["Erro desconhecido"])[-1]
        raise ValueError(ultimo_erro)

    info = json.loads(result.stdout)
    entradas = info.get("entries", []) or []

    videos = []
    for e in entradas:
        if not e.get("url"):
            continue
        videos.append({
            "url":         e.get("url"),
            "title":       e.get("title", ""),
            "duration":    e.get("duration"),
            "thumbnail":   (e.get("thumbnail") or
                            (e.get("thumbnails") or [{}])[-1].get("url")),
            "view_count":  e.get("view_count"),
            "upload_date": e.get("upload_date"),
        })

    # Mais viral primeiro (do ReClip)
    videos.sort(key=lambda x: x.get("view_count") or 0, reverse=True)

    return {
        "playlist_title": info.get("title", ""),
        "uploader":       info.get("uploader", ""),
        "total":          len(videos),
        "videos":         videos,
    }


# ─── Perfis inteiros (edição em massa) ────────────────────────────────────────

_PROFILE_SORTS = {"views", "likes", "engagement", "date"}
_MAX_PROFILE_SCAN = 1000
_MAX_ENRICH = 300


def _cookies_args(platform: str) -> list[str]:
    """Cookies de login opcionais por plataforma (INSTAGRAM_COOKIES_FILE, TIKTOK_COOKIES_FILE...)."""
    path = os.environ.get(f"{platform.upper()}_COOKIES_FILE") or ""
    if not path and platform == "youtube" and os.path.exists("/tmp/yt_cookies.txt"):
        path = "/tmp/yt_cookies.txt"
    return ["--cookies", path] if path and os.path.exists(path) else []


def _proxy_args() -> list[str]:
    """Proxy residencial opcional (YTDLP_PROXY) para contornar bloqueio de IP de datacenter."""
    proxy = os.environ.get("YTDLP_PROXY")
    return ["--proxy", proxy] if proxy else []


def normalize_profile_url(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("http"):
        url = raw
    elif raw.startswith("@"):
        url = f"https://www.tiktok.com/{raw}"
    else:
        url = f"https://{raw}"
    platform = detect_platform(url)
    if platform == "youtube" and re.search(r"youtube\.com/(@[^/]+|channel/[^/]+|c/[^/]+)/?$", url):
        url = url.rstrip("/") + "/shorts"
    if platform == "facebook" and "/videos" not in url and "/reel" not in url:
        url = url.rstrip("/") + "/videos"
    return url


def _entry_to_video(e: dict) -> dict | None:
    url = e.get("webpage_url") or e.get("url")
    if not url or not str(url).startswith("http"):
        return None
    ts = e.get("timestamp")
    if not ts and e.get("upload_date"):
        try:
            ts = datetime.strptime(e["upload_date"], "%Y%m%d").replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            ts = None
    return {
        "url": url,
        "title": e.get("title") or e.get("description") or "",
        "duration": e.get("duration"),
        "thumbnail": e.get("thumbnail") or ((e.get("thumbnails") or [{}])[-1].get("url")),
        "view_count": e.get("view_count"),
        "like_count": e.get("like_count"),
        "comment_count": e.get("comment_count"),
        "timestamp": ts,
    }


def _enrich(video: dict, cookies: list[str]) -> dict:
    """Metadados completos de um vídeo (a listagem 'flat' às vezes não traz curtidas/views)."""
    try:
        r = subprocess.run(["yt-dlp", "-j", "--no-playlist", "--no-warnings", *cookies, *_proxy_args(), video["url"]],
                           capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            full = _entry_to_video(json.loads(r.stdout)) or {}
            return {**video, **{k: v for k, v in full.items() if v is not None}}
    except Exception as e:
        print(f"[profile] metadados de {video['url'][:60]} falharam: {e}")
    return video


_IG_APP_ID = "936619743392459"  # id público do app web do Instagram
# o mesmo pedido por dois caminhos: o do site e o do app (o do app costuma passar quando o do site dá 401/429)
_IG_ROTAS = [
    ("https://www.instagram.com", {"x-ig-app-id": _IG_APP_ID, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36", "X-Requested-With": "XMLHttpRequest", "Referer": "https://www.instagram.com/"}),
    ("https://i.instagram.com", {"x-ig-app-id": _IG_APP_ID, "User-Agent": "Instagram 309.1.0.41.113 Android (33/13; 420dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; pt_BR; 541635890)"}),
]
_IG_QUERY_HASH = "69cba40317214236af40e7efa697781d"  # posts do perfil (paginação pública)


def _ig_no(n: dict) -> dict | None:
    """Nó do Instagram (edge da timeline) → vídeo no formato do Clipost (só vídeos)."""
    if not n.get("is_video"):
        return None
    caption = ((n.get("edge_media_to_caption") or {}).get("edges") or [{}])[0].get("node", {}).get("text", "")
    return {
        "url": f"https://www.instagram.com/reel/{n.get('shortcode')}/",
        "permalink": f"https://www.instagram.com/reel/{n.get('shortcode')}/",
        "title": caption[:120],
        "duration": n.get("video_duration"),
        "thumbnail": n.get("thumbnail_src") or n.get("display_url"),
        "view_count": n.get("video_view_count") or n.get("video_play_count"),
        "like_count": (n.get("edge_liked_by") or n.get("edge_media_preview_like") or {}).get("count"),
        "comment_count": (n.get("edge_media_to_comment") or {}).get("count"),
        "timestamp": n.get("taken_at_timestamp"),
    }


def _ig_cookies() -> dict:
    """Cookies do Instagram salvos no servidor (arquivo Netscape) → {nome: valor}."""
    caminho = os.environ.get("INSTAGRAM_COOKIES_FILE") or ""
    if not caminho or not os.path.exists(caminho):
        return {}
    cookies = {}
    try:
        for linha in open(caminho, encoding="utf-8", errors="replace"):
            partes = linha.rstrip("\n").split("\t")
            if len(partes) >= 7 and "instagram.com" in partes[0]:
                cookies[partes[5]] = partes[6]
    except OSError:
        return {}
    return cookies


def _instagram_com_sessao(usuario: str, limit: int) -> list[dict] | None:
    """Com a sessão do usuário (sessionid): perfil + feed completo, igual ao site logado.
    None = sem sessão salva; [] = sessão existe mas o Instagram recusou."""
    import time
    import httpx
    ck = _ig_cookies()
    if not ck.get("sessionid"):
        return None
    cab = {**_IG_ROTAS[0][1], "x-csrftoken": ck.get("csrftoken", ""), "Cookie": "; ".join(f"{k}={v}" for k, v in ck.items())}
    videos: list[dict] = []
    try:
        with httpx.Client(timeout=25, follow_redirects=False) as c:
            r = c.get("https://www.instagram.com/api/v1/users/web_profile_info/", params={"username": usuario}, headers=cab)
            if r.status_code != 200:
                print(f"[profile] instagram com sessão: perfil HTTP {r.status_code}")
                return []
            uid = ((r.json().get("data") or {}).get("user") or {}).get("id")
            if not uid:
                return []
            proximo = ""
            for _ in range(120):
                r = c.get(f"https://www.instagram.com/api/v1/feed/user/{uid}/", params={"count": 33, **({"max_id": proximo} if proximo else {})}, headers=cab)
                if r.status_code != 200:
                    print(f"[profile] instagram com sessão: feed HTTP {r.status_code} (fica com {len(videos)})")
                    break
                feed = r.json()
                for m in feed.get("items") or []:
                    midia = m if m.get("media_type") == 2 else next((x for x in m.get("carousel_media") or [] if x.get("media_type") == 2), None)
                    if not midia:
                        continue
                    v = sorted(midia.get("video_versions") or [], key=lambda x: x.get("width") or 0, reverse=True)
                    link = f"https://www.instagram.com/reel/{m.get('code')}/"
                    videos.append({
                        "url": (v[0]["url"] if v else link),  # link direto da CDN: baixa sem login
                        "permalink": link,
                        "title": ((m.get("caption") or {}).get("text") or "")[:120],
                        "duration": midia.get("video_duration"),
                        "thumbnail": (((m.get("image_versions2") or {}).get("candidates") or [{}])[0]).get("url"),
                        "view_count": m.get("play_count") or m.get("ig_play_count") or m.get("view_count"),
                        "like_count": m.get("like_count"),
                        "comment_count": m.get("comment_count"),
                        "timestamp": m.get("taken_at"),
                    })
                if (limit and len(videos) >= limit) or not feed.get("more_available") or not feed.get("next_max_id"):
                    break
                proximo = feed["next_max_id"]
                time.sleep(0.8)
    except Exception as e:
        print(f"[profile] instagram com sessão: {type(e).__name__}")
    print(f"[profile] instagram com sessão: {len(videos)} vídeos de @{usuario}")
    return videos[:limit] if limit else videos


def _instagram_web_profile(url: str, limit: int = 0) -> list[dict]:
    """Vídeos do perfil pela API web pública do Instagram, SEM login: primeiro os ~12 mais novos
    (web_profile_info), depois pagina pela consulta pública. Tenta o caminho do site e o do app,
    com uma nova tentativa quando o Instagram pede para ir devagar."""
    import time
    import httpx
    m = re.search(r"instagram\.com/([^/?#]+)", url)
    if not m or m.group(1) in ("reel", "reels", "p", "explore"):
        return []
    usuario = m.group(1)
    com_sessao = _instagram_com_sessao(usuario, limit)
    if com_sessao:
        return com_sessao
    user = None
    rota_ok = None
    with httpx.Client(timeout=20, follow_redirects=True, **({"proxy": os.environ["YTDLP_PROXY"]} if os.environ.get("YTDLP_PROXY") else {})) as c:
        for tentativa in range(2):
            for base, cab in _IG_ROTAS:
                try:
                    r = c.get(f"{base}/api/v1/users/web_profile_info/", params={"username": usuario}, headers=cab)
                    if r.status_code == 200:
                        user = (r.json().get("data") or {}).get("user")
                        if user:
                            rota_ok = (base, cab)
                            break
                    print(f"[profile] instagram {base.split('//')[1]}: HTTP {r.status_code}")
                except Exception as e:
                    print(f"[profile] instagram {base.split('//')[1]}: {type(e).__name__}")
            if user:
                break
            time.sleep(3)
        if not user:
            return []
        timeline = user.get("edge_owner_to_timeline_media") or {}
        videos = [v for v in (_ig_no(e.get("node") or {}) for e in timeline.get("edges") or []) if v]
        cursor = (timeline.get("page_info") or {}).get("end_cursor")
        tem_mais = (timeline.get("page_info") or {}).get("has_next_page")
        # paginação pública (sem login) — o Instagram às vezes bloqueia; aí fica com o que já veio
        paginas = 0
        while tem_mais and cursor and (not limit or len(videos) < limit) and paginas < 40:
            paginas += 1
            try:
                r = c.get("https://www.instagram.com/graphql/query/", headers=rota_ok[1] if rota_ok[0].startswith("https://www.") else _IG_ROTAS[0][1],
                          params={"query_hash": _IG_QUERY_HASH, "variables": json.dumps({"id": user["id"], "first": 50, "after": cursor})})
                if r.status_code != 200:
                    print(f"[profile] instagram paginação: HTTP {r.status_code} (fica com {len(videos)} vídeos)")
                    break
                midia = (((r.json().get("data") or {}).get("user") or {}).get("edge_owner_to_timeline_media") or {})
                videos += [v for v in (_ig_no(e.get("node") or {}) for e in midia.get("edges") or []) if v]
                cursor = (midia.get("page_info") or {}).get("end_cursor")
                tem_mais = (midia.get("page_info") or {}).get("has_next_page")
                time.sleep(1.2)
            except Exception as e:
                print(f"[profile] instagram paginação: {type(e).__name__}")
                break
    print(f"[profile] instagram sem login: {len(videos)} vídeos de @{usuario}")
    return videos[:limit] if limit else videos


def _sort_key(sort_by: str):
    def key(v: dict):
        views = v.get("view_count") or 0
        likes = v.get("like_count") or 0
        comments = v.get("comment_count") or 0
        if sort_by == "likes":
            return likes
        if sort_by == "engagement":
            return (likes + comments) / views if views else likes + comments
        if sort_by == "date":
            return v.get("timestamp") or 0
        return views
    return key


def video_key(url: str) -> str:
    """Id estável de um vídeo a partir do link (shortcode do Instagram, id do TikTok...)."""
    for padrao in (r"/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)", r"/video/(\d+)", r"[?&]v=([A-Za-z0-9_-]{6,})",
                   r"/shorts/([A-Za-z0-9_-]+)", r"/videos/(\d+)", r"[?&]v=(\d+)"):
        m = re.search(padrao, url)
        if m:
            return m.group(1)
    return url.rstrip("/").rsplit("/", 1)[-1][:120]


def profile_key(raw: str) -> tuple[str, str, str] | None:
    """(plataforma, nome do perfil, url do perfil) para Instagram/TikTok/Facebook; None para YouTube
    (um "@canal" solto continua sendo YouTube, como sempre foi no Autopilot)."""
    if not re.search(r"(instagram\.com|tiktok\.com|facebook\.com|fb\.com)", raw, re.I):
        return None
    url = normalize_profile_url(raw)
    platform = detect_platform(url)
    if platform not in ("instagram", "tiktok", "facebook"):
        return None
    m = re.search(r"(?:instagram\.com|tiktok\.com|facebook\.com)/(@?[^/?#]+)", url)
    if not m or m.group(1).lower() in ("reel", "reels", "p", "explore", "watch", "video"):
        raise ValueError("Cole o link do PERFIL (ex.: instagram.com/nomedoperfil), não de um vídeo.")
    return platform, m.group(1).lstrip("@"), url


def latest_profile_videos(url: str, limit: int = 6, user_id: str | None = None) -> list[dict]:
    """Vídeos mais recentes de um perfil (do mais novo para o mais antigo), com 'key' estável.
    O 'key' sai do link público (permalink) quando existe: o link direto da CDN muda a cada leitura."""
    # sem abrir vídeo a vídeo: a listagem do perfil já vem do mais novo para o mais antigo (e menos bloqueio)
    videos = list_profile_videos(url, limit=limit, sort_by="date", user_id=user_id, enriquecer=False)["videos"]
    return [{**v, "key": video_key(v.get("permalink") or v["url"])} for v in videos]


def _instagram_oficial(url: str, limit: int, sort_by: str, user_id: str | None) -> tuple[list[dict] | None, str]:
    """Tenta a API oficial da Meta (Business Discovery). (videos, aviso) — videos None se não deu."""
    try:
        from services.instagram_oficial import credenciais, listar_videos
        if not credenciais(user_id):
            return None, ""
        m = re.search(r"instagram\.com/([^/?#]+)", url)
        if not m:
            return None, ""
        # para ordenar por curtidas/engajamento lê mais que o pedido e escolhe os melhores
        alvo = limit if (sort_by == "date" or not limit) else min(limit * 3, 300)
        return listar_videos(m.group(1), alvo, user_id), ""
    except ValueError as e:
        print(f"[profile] API oficial do Instagram: {e}")
        return None, str(e)
    except Exception as e:
        print(f"[profile] API oficial do Instagram falhou: {type(e).__name__}")
        return None, ""


def list_profile_videos(profile: str, limit: int = 0, sort_by: str = "views", user_id: str | None = None,
                        enriquecer: bool = True) -> dict:
    """
    Vídeos de um perfil/página (TikTok, Instagram, Facebook, YouTube) ordenados.
    limit=0 traz todos. sort_by: views | likes | engagement | date.
    enriquecer=False não abre vídeo por vídeo para completar números/datas que a listagem rápida não traz
    (bem mais rápido; a ordem do próprio perfil já é do mais novo para o mais antigo).
    """
    sort_by = sort_by if sort_by in _PROFILE_SORTS else "views"
    url = normalize_profile_url(profile)
    platform = detect_platform(url)
    cookies = _cookies_args(platform)

    # Instagram: primeiro a API oficial da Meta (sem cookies, sem 429), se estiver configurada
    aviso_oficial = ""
    if platform == "instagram":
        oficiais, aviso_oficial = _instagram_oficial(url, limit, sort_by, user_id)
        if oficiais:
            # sem views de terceiros na API oficial: "mais vistos" usa as curtidas
            chave = _sort_key("date" if sort_by == "date" else "likes" if sort_by in ("views", "likes") else sort_by)
            oficiais.sort(key=chave, reverse=True)
            return {"profile_url": url, "platform": platform, "total_found": len(oficiais),
                    "videos": oficiais[:limit] if limit else oficiais, "fonte": "api_oficial"}

    scan = limit if (sort_by == "date" and limit) else _MAX_PROFILE_SCAN
    videos: list[dict] = []
    # Instagram: API web pública primeiro (sem login); o extrator de perfil do yt-dlp costuma falhar
    if platform == "instagram":
        videos = _instagram_web_profile(url, scan)

    result = subprocess.CompletedProcess([], 0, "", "")
    if not videos:
        # títulos no idioma original/português (sem isso o YouTube devolve traduzidos para inglês)
        idioma = ["--extractor-args", "youtube:lang=pt"] if platform == "youtube" else []
        cmd = ["yt-dlp", "--flat-playlist", "-J", "--no-warnings", "--ignore-errors",
               "--playlist-end", str(scan), *idioma, *cookies, *_proxy_args(), url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0 and result.stdout.strip():
            info = json.loads(result.stdout)
            videos = [v for v in (_entry_to_video(e) for e in (info.get("entries") or []) if e) if v]
    if not videos:
        # detalhe técnico só no log; a pessoa vê uma frase simples
        print(f"[perfil] listagem falhou em {url}: {(result.stderr.strip().split(chr(10)) or [''])[-1][:300]}")
        hint = ""
        if platform in ("instagram", "facebook"):
            hint = f" O {platform.capitalize()} só mostra os vídeos para quem está conectado."
        if aviso_oficial:
            hint = f" {aviso_oficial}{hint}"
        raise ValueError(f"Não encontrei vídeos nesse perfil.{hint}".strip())

    metric = {"views": "view_count", "likes": "like_count", "engagement": "like_count", "date": "timestamp"}[sort_by]
    missing = [v for v in videos[:_MAX_ENRICH] if v.get(metric) is None] if enriquecer else []
    if missing:
        with ThreadPoolExecutor(max_workers=6) as pool:
            enriched = list(pool.map(lambda v: _enrich(v, cookies), missing))
        by_url = {v["url"]: v for v in enriched}
        videos = [by_url.get(v["url"], v) for v in videos]

    # Perfis listam do mais novo para o mais antigo; sem data, mantém essa ordem
    if not (sort_by == "date" and all(v.get("timestamp") is None for v in videos)):
        videos.sort(key=_sort_key(sort_by), reverse=True)

    return {"profile_url": url, "platform": platform, "total_found": len(videos),
            "videos": videos[:limit] if limit else videos}
