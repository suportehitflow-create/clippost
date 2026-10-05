"""Moldes de carrossel vindos do Figma: importa o arquivo (API de leitura) e desenha cada slide igual ao original.

Convenção das camadas (a mesma do plugin Content Machine):
  textoN   -> texto N do carrossel          imagemNN -> foto NN (frame do vídeo)
  Imagemperfil -> foto do perfil            Perfil / Nome / "@..." -> @ e nome da marca do usuário
  qualquer outra coisa (fundos, degradês, selo, ícones, textos de rodapé) é desenhada como está.

Importar (uma vez, precisa de FIGMA_TOKEN no .env): importar_arquivo(chave) -> backend/modelos_privados/figma/<chave>/
Os moldes são do usuário (o Content Machine é de terceiros): a pasta fica fora do git.
"""
import io
import json
import os
import re
from pathlib import Path

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "modelos_privados" / "figma"
FONTES = RAIZ / "fontes"
API = "https://api.figma.com/v1"
VETORES = {"VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "REGULAR_POLYGON"}


# ─── importação ───────────────────────────────────────────────────────────────

def _cab() -> dict:
    tok = os.environ.get("FIGMA_TOKEN", "").strip()
    if not tok:
        raise RuntimeError("FIGMA_TOKEN não está configurado no backend/.env")
    return {"X-Figma-Token": tok}


def _nome_seguro(s: str) -> str:
    return re.sub(r"[^\w\-]+", "_", s).strip("_") or "x"


def _classificar(nome_arquivo: str) -> str | None:
    n = nome_arquivo.lower()
    for chave in ("principal", "futurista", "autoral", "twitter"):
        if chave in n:
            return chave
    return None


def _visivel(n: dict) -> bool:
    return n.get("visible", True) is not False


def _coletar(n: dict, ids_img: list, ids_vet: list, dentro_dinamico: bool = False):
    """Junta as camadas que precisam virar PNG: vetores (selo, ícones) e preenchimentos de imagem estáticos."""
    nome = n.get("name", "")
    dinamico = bool(re.match(r"^imagem\d+$", nome, re.I)) or nome.lower() == "imagemperfil"
    if n.get("type") in VETORES and _visivel(n):
        ids_vet.append(n["id"])
        return
    # imagem fixa do molde (selo, ícone, logo): o jeito mais fiel é pedir ao Figma o PNG da própria camada
    if not dinamico and _visivel(n) and any(f.get("type") == "IMAGE" and f.get("visible", True) is not False for f in n.get("fills") or []):
        ids_vet.append(n["id"])
        return
    for c in n.get("children") or []:
        if _visivel(c):
            _coletar(c, ids_img, ids_vet, dentro_dinamico or dinamico)


def importar_arquivo(chave: str, aviso=print) -> dict:
    """Baixa o arquivo, os PNG das camadas que não mudam e grava o molde de cada slide."""
    cab = _cab()
    aviso("lendo o arquivo do Figma")
    r = httpx.get(f"{API}/files/{chave}", headers=cab, timeout=180)
    r.raise_for_status()
    arq = r.json()
    destino = PASTA / chave
    (destino / "ativos").mkdir(parents=True, exist_ok=True)

    quadros = [c for pg in arq["document"]["children"] for c in pg.get("children", []) if c.get("type") == "FRAME"]
    ids_img: list[str] = []
    ids_vet: list[str] = []
    for q in quadros:
        _coletar(q, ids_img, ids_vet)

    aviso(f"baixando {len(set(ids_img))} imagens e {len(ids_vet)} vetores")
    mapa = httpx.get(f"{API}/files/{chave}/images", headers=cab, timeout=120).json().get("meta", {}).get("images", {})
    for ref in set(ids_img):
        if mapa.get(ref):
            (destino / "ativos" / f"img_{ref}.png").write_bytes(_png(httpx.get(mapa[ref], timeout=120).content))
    for i in range(0, len(ids_vet), 40):
        lote = ids_vet[i:i + 40]
        urls = httpx.get(f"{API}/images/{chave}", headers=cab, timeout=180,
                         params={"ids": ",".join(lote), "format": "png", "scale": 2}).json().get("images", {})
        for nid, u in urls.items():
            if u:
                (destino / "ativos" / f"vet_{_nome_seguro(nid)}.png").write_bytes(httpx.get(u, timeout=120).content)

    moldes: dict[str, list] = {}
    for q in quadros:
        tpl = _classificar(q["name"])
        if tpl:
            moldes.setdefault(tpl, []).append(_enxugar(q, q["absoluteBoundingBox"]))
    for tpl, slides in moldes.items():
        ordem = sorted(slides, key=lambda s: (s["x"], s["y"]))
        (destino / f"{tpl}.json").write_text(json.dumps(ordem, ensure_ascii=False), encoding="utf-8")
    aviso("pronto")
    return {tpl: len(s) for tpl, s in moldes.items()}


def _enxugar(n: dict, origem: dict) -> dict:
    """Só o que o desenhista usa, com posições relativas ao slide."""
    b = n.get("absoluteBoundingBox") or {"x": 0, "y": 0, "width": 0, "height": 0}
    # vetores com traço (setas, ícones): o PNG exportado tem o tamanho "com traço", maior que a caixa interna
    if n.get("type") in VETORES and n.get("absoluteRenderBounds"):
        b = n["absoluteRenderBounds"]
    o = {"id": n["id"], "tipo": n["type"], "nome": n.get("name", ""),
         "x": b["x"] - origem["x"], "y": b["y"] - origem["y"], "w": b["width"], "h": b["height"]}
    if n.get("type") == "FRAME" and n.get("fills") is not None and "children" in n and origem is not None and n.get("absoluteBoundingBox") == origem:
        o["x"], o["y"] = 0.0, 0.0
    for k in ("opacity", "cornerRadius", "rectangleCornerRadii", "layoutMode", "itemSpacing", "primaryAxisAlignItems",
              "counterAxisAlignItems", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "clipsContent",
              "blendMode", "textAutoResize"):
        if n.get(k) is not None:
            o[k] = n[k]
    if n.get("visible") is False:
        o["oculto"] = True
    fills = []
    for f in n.get("fills") or []:
        if f.get("visible", True) is False:
            continue
        fills.append({k: f[k] for k in ("type", "color", "opacity", "imageRef", "scaleMode", "gradientHandlePositions", "gradientStops") if k in f})
    if fills:
        o["fills"] = fills
    if n["type"] == "TEXT":
        st = n.get("style", {})
        o["texto"] = n.get("characters", "")
        o["estilo"] = {k: st.get(k) for k in ("fontFamily", "fontWeight", "fontSize", "lineHeightPx", "letterSpacing",
                                               "textAlignHorizontal", "textAlignVertical", "textCase", "italic") if st.get(k) is not None}
    if n.get("children"):
        o["filhos"] = [_enxugar(c, origem) for c in n["children"] if c.get("visible", True) is not False]
    return o


def _png(dados: bytes) -> bytes:
    im = Image.open(io.BytesIO(dados))
    buf = io.BytesIO()
    im.convert("RGBA").save(buf, "PNG")
    return buf.getvalue()


# ─── leitura dos moldes ───────────────────────────────────────────────────────

def _pasta_molde() -> Path | None:
    if not PASTA.exists():
        return None
    pastas = sorted((p for p in PASTA.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime, reverse=True)
    return pastas[0] if pastas else None


_cache: dict[str, list | None] = {}


def moldes(template: str) -> list | None:
    if template in _cache:
        return _cache[template]
    p = _pasta_molde()
    arq = p / f"{template}.json" if p else None
    _cache[template] = json.loads(arq.read_text(encoding="utf-8")) if arq and arq.exists() else None
    return _cache[template]


def _dentro_de_infos(caminho: list[str]) -> bool:
    return any(re.match(r"^(infos?|rodap[eé]|cabe[cç]alho)$", c, re.I) for c in caminho)


def campos(slide: dict) -> dict:
    """{'textos': {N: no}, 'fotos': {NN: no}} dos campos que mudam em um slide."""
    textos, fotos = {}, {}

    def ir(n, caminho):
        nome = n["nome"].strip()
        if n["tipo"] == "TEXT" and re.match(r"^texto\s*\d+$", nome, re.I) and not _dentro_de_infos(caminho):
            textos[int(re.sub(r"\D", "", nome))] = n
        if re.match(r"^imagem\s*\d+$", nome, re.I):
            fotos[int(re.sub(r"\D", "", nome))] = n
        for c in n.get("filhos", []):
            ir(c, caminho + [nome])
    ir(slide, [])
    return {"textos": textos, "fotos": fotos}


def estrutura(template: str) -> dict | None:
    """Slides do molde: [{textos:[N..], capacidade:{N: palavras}, fotos:[{id, w, h}]}]."""
    ms = moldes(template)
    if not ms:
        return None
    slides, total = [], 0
    for m in ms:
        c = campos(m)
        ns = sorted(c["textos"])
        cap = {}
        for n in ns:
            no = c["textos"][n]
            est = no.get("estilo", {})
            tam = float(est.get("fontSize") or 30)
            lh = float(est.get("lineHeightPx") or tam * 1.25)
            largura_media = tam * (0.42 if str(est.get("fontFamily")) in ("Impact", "Anton") else 0.52)
            linhas = max(1, int(no["h"] // lh))
            cap[n] = max(3, int(linhas * (no["w"] / largura_media) / 6.2))
        # grande = título/manchete do slide (maior fonte); os outros textos são corpo
        tams = {n: float(c["textos"][n].get("estilo", {}).get("fontSize") or 0) for n in ns}
        papel = {n: ("título" if len(ns) > 1 and tams[n] == max(tams.values()) and tams[n] > min(tams.values()) else
                     ("frase" if len(ns) == 1 else "corpo")) for n in ns}
        slides.append({"textos": ns, "capacidade": cap, "papel": papel,
                       "fotos": [{"n": k, "w": v["w"], "h": v["h"]} for k, v in sorted(c["fotos"].items())]})
        total = max([total] + ns)
    return {"slides": slides, "blocos": total, "fotos": max([f["n"] for s in slides for f in s["fotos"]] + [0])}


def renderizar_slide(template: str, indice: int, textos: dict[int, str], fotos: dict[int, tuple], marca: dict) -> Image.Image:
    return renderizar(moldes(template)[indice], pasta_dos_moldes(), textos, fotos, marca)


# ─── fontes e texto ───────────────────────────────────────────────────────────

_FAMILIAS = {"impact": "anton", "anton": "anton", "instrument serif": "serif"}
_cache_fonte: dict = {}


def _fonte(familia: str, peso: float, tam: float) -> ImageFont.FreeTypeFont:
    chave = (str(familia).lower(), int(peso or 400), round(tam))
    if chave in _cache_fonte:
        return _cache_fonte[chave]
    tipo = _FAMILIAS.get(str(familia).lower(), "inter")  # Helvetica Now e o resto → Inter
    if tipo == "anton":
        f = ImageFont.truetype(str(FONTES / "Anton-Regular.ttf"), max(6, round(tam)))
    elif tipo == "serif":
        f = ImageFont.truetype(str(FONTES / "InstrumentSerif-Regular.ttf"), max(6, round(tam)))
    else:
        f = ImageFont.truetype(str(FONTES / "Inter-Variable.ttf"), max(6, round(tam)))
        f.set_variation_by_axes([14, max(100, min(900, int(peso or 400)))])  # o "Inter" do Figma é o corte de texto (opsz 14)
    _cache_fonte[chave] = f
    return f


def _cor(c: dict | None, opac: float = 1.0) -> tuple:
    if not c:
        return (0, 0, 0, int(255 * opac))
    return (round(c["r"] * 255), round(c["g"] * 255), round(c["b"] * 255), round(255 * c.get("a", 1.0) * opac))


def _largura(fonte, texto: str, ls: float) -> float:
    return fonte.getlength(texto) + ls * max(0, len(texto))


def _quebrar(texto: str, fonte, ls: float, largura: float) -> list[str]:
    linhas: list[str] = []
    for par in texto.split("\n"):
        atual = ""
        for palavra in par.split(" "):
            teste = f"{atual} {palavra}".strip() if atual else palavra
            if _largura(fonte, teste, ls) <= largura + 0.5 or not atual:
                atual = teste
            else:
                linhas.append(atual)
                atual = palavra
        linhas.append(atual)
    return linhas


def _desenhar_linha(draw: ImageDraw.ImageDraw, x: float, y: float, linha: str, fonte, ls: float, cor):
    if abs(ls) < 0.05:
        draw.text((x, y), linha, font=fonte, fill=cor, anchor="ls")
        return
    for ch in linha:
        draw.text((x, y), ch, font=fonte, fill=cor, anchor="ls")
        x += fonte.getlength(ch) + ls


class _Texto:
    """Texto já quebrado em linhas, pronto para medir e desenhar."""

    def __init__(self, no: dict, conteudo: str, maximo_h: float | None):
        est = no.get("estilo", {})
        self.no = no
        self.fam = est.get("fontFamily", "Inter")
        self.peso = est.get("fontWeight", 400)
        tam0 = float(est.get("fontSize") or 30)
        self.proporcao_lh = (float(est.get("lineHeightPx") or tam0 * 1.25)) / tam0
        self.proporcao_ls = float(est.get("letterSpacing") or 0) / tam0
        caso = est.get("textCase")
        self.conteudo = conteudo.upper() if caso == "UPPER" else conteudo
        self.alinha = est.get("textAlignHorizontal", "LEFT")
        fills = no.get("fills") or [{"color": {"r": 0, "g": 0, "b": 0}}]
        self.cor = _cor(fills[0].get("color"), fills[0].get("opacity", 1.0) * no.get("opacity", 1.0))
        self.tam = tam0
        # texto maior que a caixa do exemplo: encolhe a fonte até caber (mínimo 55%)
        while True:
            self._medir()
            if maximo_h is None or self.altura <= maximo_h + 2 or self.tam <= tam0 * 0.55 + 0.01:
                break
            self.tam = max(tam0 * 0.55, self.tam - max(1.0, tam0 * 0.03))

    def _medir(self):
        self.fonte = _fonte(self.fam, self.peso, self.tam)
        self.ls = self.proporcao_ls * self.tam
        self.lh = self.proporcao_lh * self.tam
        self.linhas = _quebrar(self.conteudo, self.fonte, self.ls, self.no["w"])
        self.altura = len(self.linhas) * self.lh


def _gradiente(w: int, h: int, fill: dict, opac: float) -> Image.Image:
    hp = fill.get("gradientHandlePositions") or [{"x": 0.5, "y": 0}, {"x": 0.5, "y": 1}, {"x": 1, "y": 0}]
    p0, p1 = np.array([hp[0]["x"], hp[0]["y"]]), np.array([hp[1]["x"], hp[1]["y"]])
    eixo = p1 - p0
    yy, xx = np.mgrid[0:h, 0:w]
    px, py = (xx + 0.5) / max(w, 1), (yy + 0.5) / max(h, 1)
    t = ((px - p0[0]) * eixo[0] + (py - p0[1]) * eixo[1]) / max(float(eixo @ eixo), 1e-9)
    t = np.clip(t, 0, 1)
    paradas = sorted(fill.get("gradientStops") or [], key=lambda s: s["position"])
    pos = np.array([s["position"] for s in paradas])
    canais = []
    for k in "rgba":
        canais.append(np.interp(t, pos, [s["color"].get(k, 1.0) for s in paradas]))
    rgba = np.stack(canais, axis=-1)
    rgba[..., 3] *= opac
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).astype("uint8"), "RGBA")


def _mascara(w: int, h: int, no: dict) -> Image.Image | None:
    raio = no.get("rectangleCornerRadii") or no.get("cornerRadius")
    elipse = no["tipo"] == "ELLIPSE"
    if not raio and not elipse:
        return None
    m = Image.new("L", (w * 3, h * 3), 0)
    d = ImageDraw.Draw(m)
    if elipse:
        d.ellipse([0, 0, w * 3 - 1, h * 3 - 1], fill=255)
    else:
        r = raio if isinstance(raio, (int, float)) else max(raio)
        d.rounded_rectangle([0, 0, w * 3 - 1, h * 3 - 1], radius=r * 3, fill=255)
    return m.resize((w, h), Image.LANCZOS)


# ─── desenho de um slide ──────────────────────────────────────────────────────

class Contexto:
    def __init__(self, pasta: Path, textos: dict[int, str], fotos: dict[int, tuple], marca: dict):
        self.pasta, self.textos, self.fotos, self.marca = pasta, textos, fotos, marca

    def ativo(self, nome: str) -> Image.Image | None:
        p = self.pasta / "ativos" / nome
        return Image.open(p).convert("RGBA") if p.exists() else None


def _eh_perfil(nome: str) -> bool:
    return nome.strip().lower() in ("perfil", "perfil e @", "@")


def _substituir_marca(no: dict, cx: Contexto, dentro_infos: bool) -> str | None:
    """Texto fixo do molde que vira dado da marca do usuário (@, nome). None = deixa como está."""
    original = no.get("texto", "")
    nome, arroba = str(cx.marca.get("nome") or "").strip(), str(cx.marca.get("arroba") or "").strip()
    if arroba and not arroba.startswith("@"):
        arroba = "@" + arroba
    n = no["nome"].strip().lower()
    if original.strip().startswith("@") or n in ("perfil",):
        return arroba or None
    if n in ("nome",) and nome:
        return nome
    if re.search(r"brands\s*decoded", original, re.I) and nome:
        return nome.upper() if original.isupper() else nome
    if re.match(r"^®?\s*copyright", original, re.I):
        return re.sub(r"\d{4}", str(__import__("datetime").date.today().year), original)
    return None


def _desenhar(no: dict, tela: Image.Image, cx: Contexto, dx: float, dy: float, caminho: list[str]):
    if no.get("oculto"):
        return
    x, y, w, h = round(no["x"] + dx), round(no["y"] + dy), max(1, round(no["w"])), max(1, round(no["h"]))
    nome = no["nome"].strip()
    opac = no.get("opacity", 1.0)
    tipo = no["tipo"]

    if tipo == "TEXT":
        _desenhar_texto(no, tela, cx, x, y, caminho)
        return

    fixa_imagem = (tipo in ("RECTANGLE", "ELLIPSE") and any(f["type"] == "IMAGE" for f in no.get("fills", []))
                   and not re.match(r"^imagem\s*\d+$", nome, re.I) and nome.lower() != "imagemperfil")
    if tipo in VETORES or fixa_imagem:
        a = cx.ativo(f"vet_{_nome_seguro(no['id'])}.png")
        if a:
            a = a.resize((w, h), Image.LANCZOS)
            if opac < 1:
                a.putalpha(a.getchannel("A").point(lambda v: int(v * opac)))
            tela.alpha_composite(a, (x, y))
        return

    camada = None
    for f in no.get("fills", []):
        t = f["type"]
        op = f.get("opacity", 1.0) * opac
        if t == "SOLID" and tipo != "FRAME" or (t == "SOLID" and tipo == "FRAME"):
            c = Image.new("RGBA", (w, h), _cor(f["color"], op))
        elif t == "GRADIENT_LINEAR":
            c = _gradiente(w, h, f, op)
        elif t == "IMAGE":
            c = _preencher_imagem(no, f, w, h, cx)
            if c is None:
                continue
        else:
            continue
        camada = c if camada is None else _compor(camada, c)
    if camada is not None:
        m = _mascara(w, h, no)
        if m is not None:
            a = np.minimum(np.array(camada.getchannel("A")), np.array(m))
            camada.putalpha(Image.fromarray(a))
        tela.alpha_composite(camada, (x, y)) if x >= 0 and y >= 0 else _colar_cortando(tela, camada, x, y)

    filhos = no.get("filhos", [])
    if filhos:
        if no.get("layoutMode") in ("VERTICAL", "HORIZONTAL") and any(_texto_muda(c, cx, caminho + [nome]) for c in filhos):
            _autolayout(no, tela, cx, dx, dy, caminho + [nome])
        else:
            for c in filhos:
                _desenhar(c, tela, cx, dx, dy, caminho + [nome])


def _compor(base: Image.Image, topo: Image.Image) -> Image.Image:
    base = base.copy()
    base.alpha_composite(topo)
    return base


def _colar_cortando(tela, camada, x, y):
    tela.paste(camada, (x, y), camada)


def _preencher_imagem(no: dict, fill: dict, w: int, h: int, cx: Contexto) -> Image.Image | None:
    nome = no["nome"].strip()
    m = re.match(r"^imagem\s*(\d+)$", nome, re.I)
    if m:
        foto = cx.fotos.get(int(m.group(1)))
        if foto is None and cx.fotos:  # faltou foto: reaproveita a mais próxima
            foto = cx.fotos[min(cx.fotos, key=lambda k: abs(k - int(m.group(1))))]
        if foto is not None:
            img, foco = foto
            return ImageOps.fit(img.convert("RGBA"), (w, h), Image.LANCZOS, centering=(max(0.0, min(1.0, foco)), 0.4))
        return Image.new("RGBA", (w, h), (24, 24, 27, 255))
    if nome.lower() == "imagemperfil":
        av = cx.marca.get("_avatar")
        if av is not None:
            return ImageOps.fit(av.convert("RGBA"), (w, h), Image.LANCZOS)
    a = cx.ativo(f"img_{fill.get('imageRef')}.png")
    if a is None:
        return None
    modo = fill.get("scaleMode", "FILL")
    if modo == "FIT":
        a.thumbnail((w, h))
        base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        base.alpha_composite(a, ((w - a.width) // 2, (h - a.height) // 2))
        return base
    return ImageOps.fit(a, (w, h), Image.LANCZOS)


def _texto_muda(c: dict, cx: Contexto, caminho: list[str]) -> bool:
    """O texto dessa camada é substituído (texto do carrossel ou dado da marca)?"""
    if c["tipo"] != "TEXT":
        return False
    if re.match(r"^texto\s*\d+$", c["nome"].strip(), re.I) and not _dentro_de_infos(caminho):
        return True
    novo = _substituir_marca(c, cx, _dentro_de_infos(caminho))
    return novo is not None and novo != c.get("texto")


def _conteudo_texto(c: dict, cx: Contexto, caminho: list[str]) -> tuple[str, float | None]:
    nome = c["nome"].strip()
    if re.match(r"^texto\s*\d+$", nome, re.I) and not _dentro_de_infos(caminho):
        return cx.textos.get(int(re.sub(r"\D", "", nome)), c["texto"]), c["h"]
    novo = _substituir_marca(c, cx, _dentro_de_infos(caminho))
    return (novo if novo is not None else c["texto"]), None


def _autolayout(no: dict, tela, cx: Contexto, dx: float, dy: float, caminho: list[str]):
    """Frames com auto-layout (o Figma empurra os vizinhos quando o texto muda): refaz a conta com o texto novo.
    Vertical: alturas; horizontal: larguras (o selo azul acompanha o fim do nome)."""
    filhos = no.get("filhos", [])
    vertical = no.get("layoutMode") == "VERTICAL"
    esp = float(no.get("itemSpacing") or 0)
    caixa = no["h"] if vertical else no["w"]

    prontos, tamanhos = {}, []
    for c in filhos:
        if c["tipo"] == "TEXT":
            conteudo, maxh = _conteudo_texto(c, cx, caminho)
            t = _Texto(c, conteudo, None if not vertical else None)
            prontos[c["id"]] = t
            if vertical:
                tamanhos.append(t.altura)
            else:
                tamanhos.append(min(c["w"], max((_largura(t.fonte, l, t.ls) for l in t.linhas), default=0)))
        else:
            tamanhos.append(c["h"] if vertical else c["w"])
    total = sum(tamanhos) + esp * (len(filhos) - 1)
    tentativas = 0
    while vertical and total > caixa + 2 and prontos and tentativas < 25:
        tentativas += 1
        for i, c in enumerate(filhos):
            t = prontos.get(c["id"])
            if t and t.tam > float(c["estilo"].get("fontSize", 30)) * 0.55:
                t.tam *= 0.95
                t._medir()
                tamanhos[i] = t.altura
        total = sum(tamanhos) + esp * (len(filhos) - 1)

    alinh = no.get("primaryAxisAlignItems", "MIN")
    inicio = (no["y"] if vertical else no["x"])
    if alinh == "MAX":
        cursor = inicio + caixa - total
    elif alinh == "CENTER":
        cursor = inicio + (caixa - total) / 2
    else:
        cursor = inicio
    for i, c in enumerate(filhos):
        d_x = 0.0 if vertical else cursor - c["x"]
        d_y = cursor - c["y"] if vertical else 0.0
        t = prontos.get(c["id"])
        if t is not None:
            _escrever(t, tela, round(c["x"] + dx + d_x), round(c["y"] + dy + d_y))
        else:
            _desenhar(c, tela, cx, dx + d_x, dy + d_y, caminho)
        cursor += tamanhos[i] + esp

def _desenhar_texto(no: dict, tela: Image.Image, cx: Contexto, x: int, y: int, caminho: list[str]):
    nome = no["nome"].strip()
    conteudo = no.get("texto", "")
    maximo_h = None
    if re.match(r"^texto\s*\d+$", nome, re.I) and not _dentro_de_infos(caminho):
        conteudo = cx.textos.get(int(re.sub(r"\D", "", nome)), conteudo)
        maximo_h = no["h"]
    else:
        novo = _substituir_marca(no, cx, _dentro_de_infos(caminho))
        if novo is not None:
            conteudo = novo
    if not conteudo.strip():
        return
    _escrever(_Texto(no, conteudo, maximo_h), tela, x, y)


def _escrever(t: _Texto, tela: Image.Image, x: int, y: int):
    draw = ImageDraw.Draw(tela)
    asc, desc = t.fonte.getmetrics()
    for i, linha in enumerate(t.linhas):
        larg = _largura(t.fonte, linha, t.ls)
        if t.alinha == "CENTER":
            lx = x + (t.no["w"] - larg) / 2
        elif t.alinha == "RIGHT":
            lx = x + t.no["w"] - larg
        else:
            lx = x
        base = y + i * t.lh + (t.lh - (asc + desc)) / 2 + asc
        _desenhar_linha(draw, lx, base, linha, t.fonte, t.ls, t.cor)


def _avatar_padrao(marca: dict, d: int = 400) -> Image.Image:
    """Bolinha com a inicial da marca (para quem ainda não colocou foto de perfil)."""
    img = Image.new("RGBA", (d, d), (63, 63, 70, 255))
    letra = (str(marca.get("nome") or marca.get("arroba") or "?").lstrip("@ ") or "?")[0].upper()
    ImageDraw.Draw(img).text((d / 2, d / 2), letra, font=_fonte("Inter", 700, d * 0.5), fill=(255, 255, 255, 255), anchor="mm")
    return img


def renderizar(slide: dict, pasta: Path, textos: dict[int, str], fotos: dict[int, tuple], marca: dict) -> Image.Image:
    """Slide do molde → imagem do tamanho do frame (1080×1350), com os textos e fotos novos."""
    w, h = round(slide["w"]), round(slide["h"])
    fundo = next((f for f in slide.get("fills", []) if f["type"] == "SOLID"), None)
    tela = Image.new("RGBA", (w, h), _cor(fundo["color"]) if fundo else (255, 255, 255, 255))
    marca = dict(marca)
    if marca.get("_avatar") is None:
        marca["_avatar"] = _avatar_padrao(marca)
    cx = Contexto(pasta, textos, fotos, marca)
    for c in slide.get("filhos", []):
        _desenhar(c, tela, cx, -slide["x"], -slide["y"], [])
    return tela.convert("RGB")


def pasta_dos_moldes() -> Path | None:
    return _pasta_molde()
