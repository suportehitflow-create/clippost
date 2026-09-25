"""
Vídeos com frases: foto de fundo + frase (fonte, cor, contorno) + @ no rodapé + música → MP4 9:16.
Cada vídeo vira um corte pronto na Biblioteca (dá para agendar como está).
"""
import os
import shutil
import subprocess
import tempfile
import textwrap
import threading
import time
import uuid
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

L, A = 1080, 1920
MAX_VIDEOS = 60

# nome no site → arquivo instalado no Dockerfile (fonts-dejavu-core, fonts-roboto-unhinted, fonts-montserrat, Anton)
_FONTES = {
    "Anton": ["Anton-Regular.ttf"],
    "Montserrat": ["Montserrat-ExtraBold.otf", "Montserrat-ExtraBold.ttf", "Montserrat-Bold.otf", "Montserrat-Bold.ttf"],
    "Roboto": ["Roboto-Black.ttf", "Roboto-Bold.ttf"],
    "DejaVu": ["DejaVuSans-Bold.ttf"],
}
_cache_fontes: dict[str, str | None] = {}

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _arquivo_fonte(nome: str) -> str | None:
    if nome in _cache_fontes:
        return _cache_fontes[nome]
    achado = None
    for arquivo in _FONTES.get(nome, []) + _FONTES["DejaVu"]:
        for pasta in ("/usr/share/fonts", "/usr/local/share/fonts"):
            if os.path.isdir(pasta):
                achado = next((str(p) for p in Path(pasta).rglob(arquivo)), None)
                if achado:
                    break
        if achado:
            break
    _cache_fontes[nome] = achado
    return achado


def _fonte(nome: str, tamanho: int):
    caminho = _arquivo_fonte(nome)
    try:
        return ImageFont.truetype(caminho, tamanho) if caminho else ImageFont.load_default(tamanho)
    except Exception:
        return ImageFont.load_default()


def _hex(cor: str, padrao=(255, 255, 255)):
    c = (cor or "").lstrip("#")
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) if len(c) == 6 else padrao
    except ValueError:
        return padrao


def _quebrar(draw, texto: str, fonte, largura: int) -> list[str]:
    linhas = []
    for paragrafo in texto.split("\n"):
        palavras, atual = paragrafo.split(), ""
        for p in palavras:
            teste = f"{atual} {p}".strip()
            if draw.textlength(teste, font=fonte) <= largura or not atual:
                atual = teste
            else:
                linhas.append(atual)
                atual = p
        linhas.append(atual)
    return linhas


def desenhar_quadro(foto: Image.Image | None, frase: str, arroba: str, estilo: dict) -> Image.Image:
    """Quadro 1080×1920: foto cortada para preencher, escurecida, frase centralizada e @ no rodapé.
    estilo: fonte, tamanho (px), cor, contorno (px), cor_contorno, posicao (topo|centro|base), escurecer (0-80),
    maiusculas (bool), cor_arroba."""
    fundo = ImageOps.fit(foto.convert("RGB"), (L, A), Image.LANCZOS) if foto else Image.new("RGB", (L, A), (18, 18, 22))
    escurecer = max(0, min(80, int(estilo.get("escurecer", 35))))
    if escurecer:
        fundo = Image.blend(fundo, Image.new("RGB", (L, A), (0, 0, 0)), escurecer / 100)
    quadro = fundo.convert("RGBA")
    draw = ImageDraw.Draw(quadro)

    texto = frase.upper() if estilo.get("maiusculas") else frase
    tamanho = max(36, min(140, int(estilo.get("tamanho", 72))))
    margem = 110
    fonte = _fonte(estilo.get("fonte") or "Montserrat", tamanho)
    linhas = _quebrar(draw, texto, fonte, L - 2 * margem)
    # frase longa demais: diminui até caber em ~60% da altura
    while tamanho > 36 and len(linhas) * tamanho * 1.25 > A * 0.6:
        tamanho -= 6
        fonte = _fonte(estilo.get("fonte") or "Montserrat", tamanho)
        linhas = _quebrar(draw, texto, fonte, L - 2 * margem)
    alt_linha = int(tamanho * 1.25)
    bloco = alt_linha * len(linhas)
    pos = estilo.get("posicao") or "centro"
    y = {"topo": int(A * 0.16), "base": int(A * 0.78) - bloco}.get(pos, (A - bloco) // 2)
    contorno = max(0, min(20, int(estilo.get("contorno", 4))))
    cor = _hex(estilo.get("cor"), (255, 255, 255))
    cor_contorno = _hex(estilo.get("cor_contorno"), (0, 0, 0))

    # sombra suave atrás do texto (legibilidade em qualquer foto)
    sombra = Image.new("RGBA", (L, A), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    for i, linha in enumerate(linhas):
        ds.text((L // 2, y + i * alt_linha + 6), linha, font=fonte, fill=(0, 0, 0, 150), anchor="ma")
    quadro = Image.alpha_composite(quadro, sombra.filter(ImageFilter.GaussianBlur(8)))
    draw = ImageDraw.Draw(quadro)
    for i, linha in enumerate(linhas):
        draw.text((L // 2, y + i * alt_linha), linha, font=fonte, fill=cor, anchor="ma",
                  stroke_width=contorno, stroke_fill=cor_contorno)

    if arroba:
        f2 = _fonte(estilo.get("fonte") or "Montserrat", 40)
        marca = "@" + arroba.lstrip("@")
        draw.text((L // 2, A - 170), marca, font=f2, fill=_hex(estilo.get("cor_arroba"), (255, 255, 255)) + (230,),
                  anchor="ma", stroke_width=2, stroke_fill=(0, 0, 0))
    return quadro.convert("RGB")


def _baixar(url: str, destino: Path) -> Path:
    with httpx.Client(timeout=120, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        destino.write_bytes(r.content)
    return destino


def montar_video(png: Path, musica: Path | None, inicio: float, duracao: float, saida: Path, zoom: bool = True):
    quadros = int(duracao * 30)
    vf = (f"scale=1296:2304,zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={quadros}:s={L}x{A}:fps=30,format=yuv420p"
          if zoom else "format=yuv420p")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-i", str(png)]
    if musica:
        cmd += ["-ss", f"{max(0.0, inicio):.2f}", "-i", str(musica)]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    cmd += ["-t", f"{duracao:.2f}", "-vf", vf,
            "-af", f"afade=t=in:d=0.4,afade=t=out:st={max(0.0, duracao - 1):.2f}:d=1",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30",
            "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(saida)]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        raise RuntimeError(f"FFmpeg: {(p.stderr or '')[-300:]}")


def combinacoes(n_fotos: int, n_frases: int, modo: str) -> list[tuple[int, int]]:
    """'todas' = cada foto com cada frase; 'pares' = uma frase por vídeo, fotos em rodízio."""
    if modo == "todas":
        pares = [(f, t) for t in range(n_frases) for f in range(max(1, n_fotos))]
    else:
        pares = [(t % max(1, n_fotos), t) for t in range(n_frases)]
    return pares[:MAX_VIDEOS]


def _set(job_id: str, **kw):
    with _lock:
        _jobs[job_id].update(kw)


def status(job_id: str, user_id: str) -> dict | None:
    with _lock:
        j = _jobs.get(job_id)
        if not j or j["user_id"] != user_id:
            return None
        return {k: v for k, v in j.items() if k != "user_id"}


def iniciar(user_id: str, req: dict, supabase) -> str:
    job_id = uuid.uuid4().hex[:12]
    frases = [f.strip() for f in req.get("frases") or [] if f and f.strip()][:MAX_VIDEOS]
    fotos = [u for u in req.get("fotos") or [] if isinstance(u, str) and u.startswith("http")][:MAX_VIDEOS]
    pares = combinacoes(len(fotos), len(frases), req.get("modo") or "pares")
    with _lock:
        _jobs[job_id] = {
            "user_id": user_id, "status": "processing", "criado": time.time(),
            "itens": [{"frase": frases[t], "foto": fotos[f] if fotos else None, "status": "pending", "url": None, "clip_id": None, "erro": None}
                      for f, t in pares],
        }
    threading.Thread(target=_rodar, args=(job_id, user_id, req, supabase), daemon=True).start()
    return job_id


def _rodar(job_id: str, user_id: str, req: dict, supabase):
    tmp = Path(tempfile.mkdtemp(prefix="clippost_frases_"))
    try:
        estilo = req.get("estilo") or {}
        duracao = max(4.0, min(30.0, float(req.get("duracao") or 8)))
        arroba = str(req.get("arroba") or "")[:40]
        musica = None
        if req.get("musica_url"):
            try:
                musica = _baixar(req["musica_url"], tmp / "musica")
            except Exception as e:
                print(f"[frases] música: {type(e).__name__}")
        fotos_cache: dict[str, Image.Image] = {}
        with _lock:
            itens = list(_jobs[job_id]["itens"])
        projeto = supabase.table("projects").insert({
            "user_id": user_id, "title": (req.get("titulo") or f"Vídeos com frases ({len(itens)})")[:200],
            "source_url": "frases", "source_type": "file", "platform": "frases", "status": "done",
        }).execute().data[0]
        _set(job_id, project_id=projeto["id"])
        for idx, item in enumerate(itens):
            _atualizar_item(job_id, idx, status="processing")
            try:
                foto = None
                if item["foto"]:
                    if item["foto"] not in fotos_cache:
                        # foto de celular vem "deitada" no EXIF: endireita antes de cortar
                        fotos_cache[item["foto"]] = ImageOps.exif_transpose(Image.open(_baixar(item["foto"], tmp / f"foto{len(fotos_cache)}")))
                    foto = fotos_cache[item["foto"]]
                png = tmp / f"q{idx}.png"
                desenhar_quadro(foto, item["frase"], arroba, estilo).save(png)
                mp4 = tmp / f"v{idx}.mp4"
                # música: cada vídeo pega um trecho diferente quando "variar_trecho" está ligado
                inicio = float(req.get("musica_inicio") or 0) + (idx * duracao if req.get("variar_trecho") else 0)
                montar_video(png, musica, inicio, duracao, mp4, zoom=estilo.get("zoom", True) is not False)
                chave = f"{user_id}/frases/{job_id}/{idx + 1}.mp4"
                supabase.storage.from_("videos").upload(chave, mp4.read_bytes(), {"content-type": "video/mp4", "upsert": "true"})
                url = supabase.storage.from_("videos").get_public_url(chave).rstrip("?")
                titulo = item["frase"].replace("\n", " ")[:200]
                clip = supabase.table("clips").insert({
                    "project_id": projeto["id"], "user_id": user_id, "title": titulo, "hook": titulo,
                    "start_time": 0, "end_time": duracao, "score": 0, "storage_url": url, "status": "ready",
                }).execute().data[0]
                _atualizar_item(job_id, idx, status="done", url=url, clip_id=clip["id"])
            except Exception as e:
                print(f"[frases] item {idx}: {type(e).__name__}: {str(e)[:200]}")
                _atualizar_item(job_id, idx, status="failed", erro=str(e)[:200])
        _set(job_id, status="done")
    except Exception as e:
        print(f"[frases] job {job_id}: {type(e).__name__}: {str(e)[:200]}")
        _set(job_id, status="failed", erro=str(e)[:200])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        # limpa jobs com mais de 6h
        with _lock:
            for k in [k for k, v in _jobs.items() if time.time() - v["criado"] > 6 * 3600]:
                _jobs.pop(k, None)


def _atualizar_item(job_id: str, idx: int, **kw):
    with _lock:
        _jobs[job_id]["itens"][idx].update(kw)
