"""
Ferramentas rápidas do painel:
- youtube_para_texto: legenda (manual ou automática) de um vídeo do YouTube em texto limpo / Markdown
- raio_x_perfil: nota de desempenho de um perfil (YouTube, Instagram, TikTok, Facebook) a partir
  dos vídeos mais recentes: média de views, engajamento, frequência e vídeos que estouraram
"""
import os
import re
import statistics
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def youtube_para_texto(url: str) -> dict:
    import yt_dlp
    from tasks import parse_vtt_subtitles

    if not re.search(r"(youtube\.com|youtu\.be)", url or ""):
        raise ValueError("Cole um link de vídeo do YouTube.")
    cookies = os.environ.get("YOUTUBE_COOKIES_FILE") or ("/tmp/yt_cookies.txt" if os.path.exists("/tmp/yt_cookies.txt") else None)
    with tempfile.TemporaryDirectory(prefix="clippost_yt_txt_") as tmp:
        opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitlesformat": "vtt",
            "subtitleslangs": ["pt", "pt-BR", "pt-orig", "en", "en-orig"],
            "outtmpl": str(Path(tmp) / "v.%(ext)s"),
            "quiet": True,
            "noplaylist": True,
            "socket_timeout": 20,
            **({"cookiefile": cookies} if cookies else {}),
            **({"proxy": os.environ["YTDLP_PROXY"]} if os.environ.get("YTDLP_PROXY") else {}),
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True) or {}
        arquivos = sorted(Path(tmp).glob("*.vtt"), key=lambda p: (0 if ".pt" in p.name else 1, p.name))
        if not arquivos:
            raise ValueError("Esse vídeo não tem legenda (nem automática) disponível.")
        segs = parse_vtt_subtitles(arquivos[0]).get("segments") or []

    # legendas automáticas repetem a linha anterior: junta sem duplicar
    partes: list[str] = []
    for s in segs:
        t = re.sub(r"\s+", " ", str(s.get("text") or "")).strip()
        if not t:
            continue
        if partes and (t == partes[-1] or partes[-1].endswith(t)):
            continue
        if partes and t.startswith(partes[-1]):
            partes[-1] = t
            continue
        partes.append(t)
    texto = " ".join(partes).strip()
    titulo = info.get("title") or "Vídeo do YouTube"
    canal = info.get("uploader") or info.get("channel") or ""
    markdown = (
        f"# {titulo}\n\n"
        f"- Canal: {canal}\n- Link: {info.get('webpage_url') or url}\n"
        f"- Duração: {int((info.get('duration') or 0) // 60)} min\n\n---\n\n{texto}\n"
    )
    return {
        "titulo": titulo,
        "canal": canal,
        "duracao": info.get("duration"),
        "texto": texto,
        "markdown": markdown,
        "palavras": len(texto.split()),
        "tokens_aprox": int(len(texto) / 4),
    }


def explorar_perfil(perfil: str, limite: int = 50, ordem: str = "recentes", periodo_dias: int = 0,
                    user_id: str | None = None) -> dict:
    """Explorador de perfis: mídias de um perfil com totais, filtro de período e ordenação.
    Instagram: API oficial (reels, posts, carrosséis) se configurada; senão o caminho comum (vídeos).
    TikTok / YouTube / Facebook: caminho comum (yt-dlp)."""
    import time
    from services.downloader import detect_platform, list_profile_videos, normalize_profile_url

    limite = max(1, min(int(limite or 50), 10000))
    url = normalize_profile_url(perfil if ("." in perfil or perfil.startswith("http")) else f"instagram.com/{perfil.lstrip('@')}")
    plataforma = detect_platform(url)
    # período e ordem por curtidas/views pedem uma leitura maior que o limite
    leitura = limite if (ordem == "recentes" and not periodo_dias) else min(limite * 3, 3000)

    dados = None
    fonte = "servidor"
    if plataforma == "instagram":
        try:
            from services.instagram_oficial import credenciais, listar_midias
            if credenciais(user_id):
                m = re.search(r"instagram\.com/([^/?#]+)", url)
                dados = listar_midias(m.group(1) if m else perfil, leitura, user_id)
                fonte = "api_oficial"
        except ValueError:
            dados = None  # perfil não profissional: tenta o caminho comum
    if dados is None:
        lista = list_profile_videos(url, limit=leitura, sort_by="date", user_id=user_id)
        dados = {
            "perfil": {"usuario": (re.search(r"\.com/(@?[^/?#]+)", lista["profile_url"]) or re.search(r"(.+)", perfil)).group(1).lstrip("@"), "seguidores": None},
            "itens": [{
                "id": v.get("url"), "tipo": "reel", "url": v.get("url"), "thumbnail": v.get("thumbnail"),
                "permalink": v.get("permalink") or v.get("url"), "legenda": v.get("title") or "",
                "views": v.get("view_count"), "likes": v.get("like_count"), "comentarios": v.get("comment_count"),
                "timestamp": v.get("timestamp"), "duracao": v.get("duration"),
            } for v in lista["videos"]],
        }

    itens = dados["itens"]
    if periodo_dias:
        corte = time.time() - periodo_dias * 86400
        itens = [i for i in itens if (i.get("timestamp") or 0) >= corte]
    chave = {"curtidos": "likes", "visualizados": "views"}.get(ordem, "timestamp")
    # sem views (API oficial não informa de terceiros): "mais visualizados" usa curtidas
    if chave == "views" and not any(i.get("views") for i in itens):
        chave = "likes"
    itens = sorted(itens, key=lambda i: i.get(chave) or 0, reverse=True)[:limite]

    soma = lambda k: sum(i.get(k) or 0 for i in itens)  # noqa: E731
    return {
        "perfil": {**dados["perfil"], "url": url},
        "plataforma": plataforma,
        "fonte": fonte,
        "totais": {
            "views": soma("views") if any(i.get("views") for i in itens) else None,
            "likes": soma("likes"),
            "comentarios": soma("comentarios"),
            "posts": len(itens),
            "reels": sum(1 for i in itens if i["tipo"] == "reel"),
            "posts_imagem": sum(1 for i in itens if i["tipo"] == "post"),
            "carrosseis": sum(1 for i in itens if i["tipo"] == "carrossel"),
        },
        "itens": itens,
    }


def _snapshot_seguidores(sb, user_id: str | None, usuario: str, seguidores: int | None) -> list[dict]:
    """Guarda 1 contagem de seguidores por dia (bucket privado) e devolve o histórico — vira o gráfico."""
    import json
    from datetime import date
    if sb is None or not user_id or not usuario:
        return []
    try:
        caminho = f"raiox/{user_id}/{usuario.lower()}.json"
        try:
            hist = json.loads(sb.download(caminho))
        except Exception:
            hist = []
        if seguidores is not None:
            hoje = date.today().isoformat()
            hist = [h for h in hist if h.get("data") != hoje] + [{"data": hoje, "n": int(seguidores)}]
            hist = sorted(hist, key=lambda h: h["data"])[-400:]
            sb.upload(caminho, json.dumps(hist).encode(), {"content-type": "application/json", "upsert": "true"})
        return hist
    except Exception as e:
        print(f"[raio-x-pagina] histórico de seguidores: {type(e).__name__}")
        return []


def raio_x_pagina(perfil: str, dias: int = 30, user_id: str | None = None, armazem=None) -> dict:
    """Painel da página: totais do período, melhor horário, formato campeão, séries por dia,
    mapa dia×hora (horário de Brasília), top posts e evolução de seguidores."""
    from collections import defaultdict
    from datetime import timedelta

    dias = dias if dias in (7, 30, 90, 180) else 30
    dados = explorar_perfil(perfil, limite=150, ordem="recentes", periodo_dias=dias, user_id=user_id)
    itens = dados["itens"]
    seguidores = dados["perfil"].get("seguidores")
    tem_views = any(i.get("views") for i in itens)
    sp = timezone(timedelta(hours=-3))  # Brasília (sem horário de verão desde 2019)

    def eng(i: dict) -> float:
        inter = (i.get("likes") or 0) + (i.get("comentarios") or 0)
        base = i.get("views") if tem_views else seguidores
        if base:
            return inter / base
        return 0.0 if tem_views else float(inter)

    likes = sum(i.get("likes") or 0 for i in itens)
    coms = sum(i.get("comentarios") or 0 for i in itens)
    views = sum(i.get("views") or 0 for i in itens) if tem_views else None
    engajamento = ((likes + coms) / views * 100) if views else ((likes + coms) / (seguidores * max(1, len(itens))) * 100 if seguidores else None)

    # mapa dia da semana × hora (0 = domingo), engajamento médio
    soma = defaultdict(float)
    cont = defaultdict(int)
    por_dia = defaultdict(lambda: {"likes": 0, "comentarios": 0, "views": 0, "posts": 0})
    for i in itens:
        if not i.get("timestamp"):
            continue
        dt = datetime.fromtimestamp(i["timestamp"], tz=timezone.utc).astimezone(sp)
        slot = ((dt.weekday() + 1) % 7, dt.hour)
        soma[slot] += eng(i)
        cont[slot] += 1
        d = por_dia[dt.date().isoformat()]
        d["likes"] += i.get("likes") or 0
        d["comentarios"] += i.get("comentarios") or 0
        d["views"] += i.get("views") or 0
        d["posts"] += 1
    mapa = [[round(soma[(d, h)] / cont[(d, h)], 5) if cont[(d, h)] else None for h in range(24)] for d in range(7)]

    media_geral = (sum(soma.values()) / sum(cont.values())) if cont else 0
    melhor = max(cont, key=lambda s: soma[s] / cont[s], default=None)
    nomes_dia = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
    melhor_horario = None
    if melhor and media_geral:
        media_slot = soma[melhor] / cont[melhor]
        melhor_horario = {"dia": nomes_dia[melhor[0]], "hora": melhor[1],
                          "ganho_pct": round((media_slot / media_geral - 1) * 100, 1), "posts": cont[melhor]}

    # formato campeão: maior média de views (ou curtidas) por post
    por_tipo = defaultdict(list)
    for i in itens:
        por_tipo[i["tipo"]].append((i.get("views") if tem_views else i.get("likes")) or 0)
    formato = None
    if por_tipo:
        tipo, vals = max(por_tipo.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))
        formato = {"tipo": tipo, "media": round(sum(vals) / len(vals)), "metrica": "views" if tem_views else "curtidas"}

    top = sorted(itens, key=lambda i: (i.get("views") if tem_views else i.get("likes")) or 0, reverse=True)[:6]
    return {
        "perfil": dados["perfil"],
        "plataforma": dados["plataforma"],
        "fonte": dados["fonte"],
        "dias": dias,
        "totais": {"views": views, "posts": len(itens), "engajamento": round(engajamento, 2) if engajamento is not None else None,
                   "likes": likes, "comentarios": coms, "compartilhamentos": None},
        "melhor_horario": melhor_horario,
        "formato_campeao": formato,
        "por_dia": [{"data": k, **v} for k, v in sorted(por_dia.items())],
        "mapa": mapa,
        "top_posts": [{**t, "engajamento": round(eng(t) * 100, 2) if (tem_views or seguidores) else None} for t in top],
        "seguidores": _snapshot_seguidores(armazem, user_id, dados["perfil"].get("usuario") or "", seguidores),
    }


def _nota(engajamento: float, por_semana: float, consistencia: float) -> tuple[str, int]:
    """0-100: engajamento pesa 50, frequência 25, consistência das views 25."""
    p_eng = min(50, engajamento / 0.08 * 50)          # 8% de engajamento = nota cheia
    p_freq = min(25, por_semana / 7 * 25)             # 1 vídeo por dia = nota cheia
    p_cons = max(0, min(25, consistencia * 25))
    pontos = round(p_eng + p_freq + p_cons)
    letra = "A" if pontos >= 80 else "B" if pontos >= 65 else "C" if pontos >= 50 else "D" if pontos >= 35 else "E"
    return letra, pontos


def raio_x_perfil(perfil: str, quantidade: int = 20) -> dict:
    from services.downloader import list_profile_videos

    dados = list_profile_videos(perfil, limit=quantidade, sort_by="date")
    videos = dados["videos"]
    if not videos:
        raise ValueError("Não encontrei vídeos nesse perfil.")

    views = [v.get("view_count") or 0 for v in videos]
    com_views = [v for v in videos if v.get("view_count")]
    engs = [((v.get("like_count") or 0) + (v.get("comment_count") or 0)) / v["view_count"] for v in com_views]
    engajamento = statistics.mean(engs) if engs else 0.0
    mediana = statistics.median(views) if views else 0
    media = statistics.mean(views) if views else 0
    # consistência: quanto a mediana chega perto da média (1 = todos os vídeos vão parecido)
    consistencia = (mediana / media) if media else 0

    datas = sorted(v["timestamp"] for v in videos if v.get("timestamp"))
    por_semana = 0.0
    if len(datas) >= 2:
        dias = max(1.0, (datas[-1] - datas[0]) / 86400)
        por_semana = round((len(datas) - 1) / dias * 7, 1)
    ultimo = datetime.fromtimestamp(datas[-1], tz=timezone.utc).isoformat() if datas else None

    letra, pontos = _nota(engajamento, por_semana, consistencia)
    estouraram = sorted([v for v in videos if mediana and (v.get("view_count") or 0) >= 2 * mediana],
                        key=lambda v: v.get("view_count") or 0, reverse=True)[:3]
    melhor = max(videos, key=lambda v: v.get("view_count") or 0)

    dicas = []
    if engajamento < 0.03:
        dicas.append("Engajamento baixo: capriche no gancho dos 3 primeiros segundos e peça comentário no fim.")
    if por_semana < 3:
        dicas.append("Posta pouco: perfis que crescem com cortes costumam postar pelo menos 1 vez por dia.")
    if consistencia < 0.5:
        dicas.append("Views muito irregulares: repita o formato e o tema dos vídeos que estouraram.")
    if not dicas:
        dicas.append("Perfil saudável: mantenha a frequência e teste variações dos vídeos que estouraram.")

    def curto(v):
        return {"titulo": (v.get("title") or "")[:120], "url": v.get("url"), "views": v.get("view_count"),
                "likes": v.get("like_count"), "comentarios": v.get("comment_count"), "thumbnail": v.get("thumbnail")}

    return {
        "perfil": dados.get("profile_url"),
        "plataforma": dados.get("platform"),
        "analisados": len(videos),
        "nota": letra,
        "pontos": pontos,
        "views_media": round(media),
        "views_mediana": round(mediana),
        "engajamento": round(engajamento * 100, 2),
        "posts_por_semana": por_semana,
        "ultimo_post": ultimo,
        "melhor_video": curto(melhor),
        "estouraram": [curto(v) for v in estouraram],
        "dicas": dicas,
    }
