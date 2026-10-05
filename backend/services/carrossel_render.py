"""Slides do carrossel em PNG (1080×1350, 4:5 do Instagram), desenhados no servidor com Pillow.

Templates (os 4 do Content Machine), cada um com seu jeito de distribuir os textos nos slides:
- principal: 18 textos → 9 slides (título + corpo), capa com a imagem do vídeo
- autoral:   18 textos → 9 slides, fundo claro e leitura de ensaio
- futurista: 14 textos → 10 slides, fundo preto com destaque em néon
- twitter:   21 textos → 7 slides, cara de post do X (foto, nome, selo, @ e texto corrido)
A identidade (foto, nome, @, selo, cor de fundo) vem do template do Clipost (brand kit).
"""
import re

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from services.template_overlay import (_badge, _circle, _draw_line_with_emojis, _font, _hex,
                                       _largura_com_emojis, _load_image)

L, A = 1080, 1350
MARGEM = 80

# quantos textos cada template tem e como eles se juntam em slides (índices começando em 0)
TEMPLATES = {
    "principal": {"nome": "Template Principal", "blocos": 18, "slides": [[i, i + 1] for i in range(0, 18, 2)]},
    "autoral": {"nome": "Template Autoral 2.0", "blocos": 18, "slides": [[i, i + 1] for i in range(0, 18, 2)]},
    "futurista": {"nome": "Template Futurista", "blocos": 14,
                  "slides": [[0, 1], [2, 3], [4, 5], [6, 7], [8], [9], [10], [11], [12], [13]]},
    "twitter": {"nome": "Template Twitter", "blocos": 21, "slides": [[i, i + 1, i + 2] for i in range(0, 21, 3)]},
}


def limpar(texto: str) -> str:
    """Tira marcação de Markdown que a IA às vezes devolve (**negrito**, # título, 'texto 3 -')."""
    t = re.sub(r"[*_#`]+", "", str(texto or ""))
    t = re.sub(r"^\s*texto\s*\d+\s*[-–—:]\s*", "", t, flags=re.I)
    return re.sub(r"[ \t]+", " ", t).strip()


def _tema(template: str, marca: dict) -> dict:
    fundo = (marca.get("fundo") or "dark").lower()
    if template == "autoral":
        return {"bg": (250, 250, 249), "titulo": (12, 10, 9), "corpo": (68, 64, 60), "fraco": (120, 113, 108), "destaque": (12, 10, 9), "claro": True}
    if template == "futurista":
        return {"bg": (5, 5, 8), "titulo": (255, 255, 255), "corpo": (212, 212, 216), "fraco": (113, 113, 122), "destaque": (34, 211, 238), "claro": False}
    if fundo == "white":
        return {"bg": (255, 255, 255), "titulo": (15, 20, 25), "corpo": (39, 39, 42), "fraco": (113, 118, 123), "destaque": (29, 155, 240), "claro": True}
    if fundo.startswith("#"):
        bg = _hex(fundo, (0, 0, 0))
        claro = sum(bg) / 3 > 150
        return {"bg": bg, "titulo": (15, 15, 15) if claro else (255, 255, 255), "corpo": (40, 40, 40) if claro else (228, 228, 231),
                "fraco": (100, 100, 100) if claro else (161, 161, 170), "destaque": _hex(marca.get("destaque"), (139, 92, 246)), "claro": claro}
    bg = (24, 24, 27) if fundo in ("gray", "zinc") else (0, 0, 0)
    return {"bg": bg, "titulo": (255, 255, 255), "corpo": (228, 228, 231), "fraco": (161, 161, 170),
            "destaque": _hex(marca.get("destaque"), (139, 92, 246)), "claro": False}


# ─── texto ────────────────────────────────────────────────────────────────────

def _quebrar(draw, texto: str, fonte, px: int, largura: int) -> list[str]:
    linhas: list[str] = []
    for paragrafo in texto.split("\n"):
        atual = ""
        for palavra in paragrafo.split():
            teste = f"{atual} {palavra}".strip()
            if _largura_com_emojis(draw, teste, fonte, px) <= largura or not atual:
                atual = teste
            else:
                linhas.append(atual)
                atual = palavra
        linhas.append(atual)
    while linhas and not linhas[-1]:
        linhas.pop()
    return linhas


def _caber(draw, texto: str, kind: str, maior: int, menor: int, largura: int, altura: int, entrelinha: float):
    """Maior tamanho de fonte em que o texto cabe na caixa."""
    px = maior
    while True:
        fonte = _font(kind, px)
        linhas = _quebrar(draw, texto, fonte, px, largura)
        alt = int(len(linhas) * px * entrelinha)
        if alt <= altura or px <= menor:
            return fonte, px, linhas, alt
        px -= 2


def _escrever(canvas, linhas, fonte, px, x, y, cor, entrelinha, largura=None, centro=False):
    draw = ImageDraw.Draw(canvas)
    passo = px * entrelinha
    for i, linha in enumerate(linhas):
        lx = x
        if centro and largura:
            lx = x + (largura - _largura_com_emojis(draw, linha, fonte, px)) / 2
        _draw_line_with_emojis(draw, linha, lx, y + i * passo + passo / 2, fonte, None, cor + (255,), 0, None, px)
    return y + len(linhas) * passo


# ─── peças ────────────────────────────────────────────────────────────────────

def _avatar_padrao(d: int) -> Image.Image:
    """Bolinha em degradê com a silhueta (a do template girava o degradê e ficava com cantos tortos)."""
    g = Image.linear_gradient("L").resize((d, d)).transpose(Image.Transpose.ROTATE_90)
    img = Image.composite(Image.new("RGBA", (d, d), (236, 72, 153, 255)), Image.new("RGBA", (d, d), (99, 102, 241, 255)), g)
    dr = ImageDraw.Draw(img)
    u = d / 120.0
    dr.ellipse([45 * u, 30 * u, 75 * u, 60 * u], fill=(255, 255, 255, 240))
    dr.chord([32 * u, 66 * u, 88 * u, 118 * u], 180, 360, fill=(255, 255, 255, 240))
    return img


def _avatar(marca: dict, d: int) -> Image.Image:
    return _circle(_load_image(marca.get("avatar_url")) or _avatar_padrao(d), d)


def _cabecalho(canvas: Image.Image, marca: dict, tema: dict, x: int, y: int, d: int, nome_px: int, arroba_px: int,
               cor_nome=None, cor_arroba=None) -> int:
    """Foto redonda + nome + selo azul + @ (igual ao template dos cortes). Devolve a altura usada.
    Sem identidade cadastrada (nem nome, nem @, nem foto) não desenha nada."""
    draw = ImageDraw.Draw(canvas)
    nome = str(marca.get("nome") or "").strip()
    arroba = str(marca.get("arroba") or "").strip()
    if not (nome or arroba or marca.get("avatar_url")):
        return 0
    canvas.alpha_composite(_avatar(marca, d), (x, y))
    if arroba and not arroba.startswith("@"):
        arroba = "@" + arroba
    fn, fa = _font("sans_bold", nome_px), _font("sans_medium", arroba_px)
    tx = x + d + int(d * 0.28)
    alt_txt = nome_px * 1.25 + (arroba_px * 1.25 if arroba else 0)
    ty = y + (d - alt_txt) / 2
    draw.text((tx, ty + nome_px * 0.625), nome, font=fn, fill=cor_nome or tema["titulo"], anchor="lm")
    if marca.get("selo", True) and nome:
        b = int(nome_px * 0.95)
        canvas.alpha_composite(_badge(b), (int(tx + draw.textlength(nome, font=fn) + nome_px * 0.3), int(ty + (nome_px * 1.25 - b) / 2)))
    if arroba:
        draw.text((tx, ty + nome_px * 1.25 + arroba_px * 0.625), arroba, font=fa, fill=cor_arroba or tema["fraco"], anchor="lm")
    return d


def _foto(img: Image.Image, w: int, h: int, foco_x: float = 0.5) -> Image.Image:
    """Recorta a imagem para preencher w×h, centrando no ponto de interesse (rosto) na horizontal."""
    return ImageOps.fit(img.convert("RGB"), (w, h), Image.LANCZOS, centering=(max(0.0, min(1.0, foco_x)), 0.4))


def _arredondar(img: Image.Image, raio: int) -> Image.Image:
    m = Image.new("L", (img.width * 3, img.height * 3), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, m.width - 1, m.height - 1], radius=raio * 3, fill=255)
    out = img.convert("RGBA")
    out.putalpha(m.resize(img.size, Image.LANCZOS))
    return out


def _rodape(canvas: Image.Image, tema: dict, marca: dict, n: int, total: int, mostrar_arroba: bool = True):
    draw = ImageDraw.Draw(canvas)
    f = _font("sans_medium", 26)
    draw.text((L - MARGEM, A - 64), f"{n}/{total}", font=f, fill=tema["fraco"], anchor="rm")
    arroba = str(marca.get("arroba") or "").strip()
    if mostrar_arroba and arroba:
        draw.text((MARGEM, A - 64), arroba if arroba.startswith("@") else "@" + arroba, font=f, fill=tema["fraco"], anchor="lm")


def _gradiente(w: int, h: int, cor=(0, 0, 0), de=0, ate=235) -> Image.Image:
    g = Image.linear_gradient("L").resize((w, h))
    g = g.point(lambda v: int(de + (ate - de) * (v / 255) ** 1.4))
    cam = Image.new("RGBA", (w, h), cor + (0,))
    cam.putalpha(g)
    return cam


# ─── slides ───────────────────────────────────────────────────────────────────

def _capa(template: str, tema: dict, marca: dict, textos: list[str], img, foco: float, total: int) -> Image.Image:
    c = Image.new("RGBA", (L, A), tema["bg"] + (255,))
    titulo = textos[0] if textos else ""
    sub = textos[1] if len(textos) > 1 else ""
    draw = ImageDraw.Draw(c)
    largura = L - 2 * MARGEM
    if img is not None:
        c.alpha_composite(_foto(img, L, A, foco).convert("RGBA"))
        c.alpha_composite(_gradiente(L, int(A * 0.72)), (0, A - int(A * 0.72)))
        cor_t, cor_s = (255, 255, 255), (228, 228, 231)
        _cabecalho(c, marca, tema, MARGEM, 70, 76, 30, 25, (255, 255, 255), (228, 228, 231))
        ft, pt, lt, at = _caber(draw, titulo, "montserrat_black", 88, 50, largura, int(A * 0.30), 1.08)
        fs, ps, ls, as_ = _caber(draw, sub, "sans_medium", 40, 28, largura, int(A * 0.14), 1.3) if sub else (None, 0, [], 0)
        y = A - 150 - at - (as_ + 28 if sub else 0)
        y = _escrever(c, lt, ft, pt, MARGEM, y, cor_t, 1.08)
        if sub:
            _escrever(c, ls, fs, ps, MARGEM, y + 28, cor_s, 1.3)
    else:
        if template == "futurista":
            c.alpha_composite(_gradiente(L, 10, tema["destaque"], 255, 255), (0, 0))
        _cabecalho(c, marca, tema, MARGEM, 80, 76, 30, 25)
        ft, pt, lt, at = _caber(draw, titulo, "montserrat_black", 96, 52, largura, int(A * 0.42), 1.08)
        fs, ps, ls, as_ = _caber(draw, sub, "sans_medium", 42, 28, largura, int(A * 0.18), 1.3) if sub else (None, 0, [], 0)
        y = (A - at - (as_ + 34 if sub else 0)) // 2
        y = _escrever(c, lt, ft, pt, MARGEM, y, tema["titulo"] if template != "futurista" else tema["destaque"], 1.08)
        if sub:
            _escrever(c, ls, fs, ps, MARGEM, y + 34, tema["corpo"], 1.3)
    f = _font("sans_bold", 26)
    ImageDraw.Draw(c).text((L - MARGEM, A - 64), "arrasta →", font=f, fill=(255, 255, 255) if img is not None else tema["fraco"], anchor="rm")
    return c.convert("RGB")


def _conteudo(template: str, tema: dict, marca: dict, textos: list[str], img, foco: float, n: int, total: int) -> Image.Image:
    c = Image.new("RGBA", (L, A), tema["bg"] + (255,))
    draw = ImageDraw.Draw(c)
    if template == "futurista":
        c.alpha_composite(_gradiente(int(L * n / total), 8, tema["destaque"], 255, 255), (0, 0))
    _cabecalho(c, marca, tema, MARGEM, 64, 58, 25, 21)
    largura = L - 2 * MARGEM
    topo, base = 190, A - 120
    if img is not None:
        alt_img = int((base - topo) * 0.46)
        # texto longo: a foto encolhe para o texto nunca ficar por baixo dela
        texto_todo = " ".join(textos)
        if len(texto_todo) > 170:
            alt_img = max(220, int((base - topo) * 0.46) - (len(texto_todo) - 170) * 2)
        caixa_txt = base - topo - alt_img - 40
    else:
        alt_img, caixa_txt = 0, base - topo
    titulo = textos[0] if textos else ""
    corpo = "\n".join(textos[1:]) if len(textos) > 1 else ""
    if corpo:
        ft, pt, lt, at = _caber(draw, titulo, "sans_black", 58, 34, largura, int(caixa_txt * 0.42), 1.15)
        fc, pc, lc, ac = _caber(draw, corpo, "sans_medium", 40, 26, largura, caixa_txt - at - 30, 1.42)
        bloco = at + 30 + ac
    else:
        # slide de um texto só: o texto fica grande e no meio
        ft, pt, lt, at = _caber(draw, titulo, "sans_black", 66, 34, largura, caixa_txt, 1.18)
        fc, pc, lc, ac, bloco = None, 0, [], 0, at
    y = topo + max(0, (caixa_txt - bloco) // 2) if img is None else topo
    cor_titulo = tema["destaque"] if template == "futurista" else tema["titulo"]
    y = _escrever(c, lt, ft, pt, MARGEM, y, cor_titulo, 1.15 if corpo else 1.18)
    if corpo:
        y = _escrever(c, lc, fc, pc, MARGEM, y + 30, tema["corpo"], 1.42)
    if img is not None:
        foto = _arredondar(_foto(img, largura, alt_img, foco), 28)
        c.alpha_composite(foto, (MARGEM, base - alt_img))
    _rodape(c, tema, marca, n, total, mostrar_arroba=False)
    return c.convert("RGB")


def _tweet(tema: dict, marca: dict, textos: list[str], img, foco: float, n: int, total: int) -> Image.Image:
    c = Image.new("RGBA", (L, A), tema["bg"] + (255,))
    draw = ImageDraw.Draw(c)
    _cabecalho(c, marca, tema, MARGEM, 110, 104, 40, 33)
    largura = L - 2 * MARGEM
    topo, base = 270, A - 120
    alt_img = int((base - topo) * 0.42) if img is not None else 0
    caixa = base - topo - (alt_img + 40 if img is not None else 0)
    texto = "\n\n".join(t for t in textos if t)
    fonte, px, linhas, alt = _caber(draw, texto, "sans_medium", 48, 28, largura, caixa, 1.38)
    y = _escrever(c, linhas, fonte, px, MARGEM, topo, tema["titulo"], 1.38)
    if img is not None:
        foto = _arredondar(_foto(img, largura, alt_img, foco), 32)
        c.alpha_composite(foto, (MARGEM, int(y + 40)))
    _rodape(c, tema, marca, n, total, mostrar_arroba=False)
    return c.convert("RGB")


def estrutura_figma(template: str) -> dict | None:
    """Molde do Figma do usuário, se estiver importado (senão None e valem os 4 desenhos embutidos)."""
    try:
        from services import figma_modelo
        return figma_modelo.estrutura(template)
    except Exception as e:
        print(f"[carrossel] molde do Figma indisponível: {type(e).__name__}: {str(e)[:100]}")
        return None


def montar_slides_figma(template: str, blocos: list[str], marca: dict, fotos: dict[int, tuple]) -> list[Image.Image]:
    """Desenha o carrossel no molde do Figma: cada textoN recebe o bloco N; cada imagemNN, a foto NN."""
    from services import figma_modelo
    est = figma_modelo.estrutura(template)
    textos = {i + 1: limpar(b) for i, b in enumerate(blocos)}
    return [figma_modelo.renderizar_slide(template, k, textos, fotos, marca) for k in range(len(est["slides"]))]


def montar_slides(template: str, blocos: list[str], marca: dict, imagens: dict[int, tuple[Image.Image, float]]) -> list[Image.Image]:
    """blocos = textos do carrossel; imagens = {índice do slide: (imagem, foco_x)}. Devolve os slides prontos."""
    tema = _tema(template, marca)
    grupos = textos_por_slide(template, blocos)
    total = len(grupos)
    saida = []
    for k, textos in enumerate(grupos):
        img, foco = imagens.get(k, (None, 0.5))
        if template == "twitter":
            saida.append(_tweet(tema, marca, textos, img, foco, k + 1, total))
        elif k == 0:
            saida.append(_capa(template, tema, marca, textos, img, foco, total))
        else:
            saida.append(_conteudo(template, tema, marca, textos, img, foco, k + 1, total))
    return saida


def textos_por_slide(template: str, blocos: list[str]) -> list[list[str]]:
    t = TEMPLATES.get(template) or TEMPLATES["principal"]
    grupos = [[limpar(blocos[i]) for i in g if i < len(blocos) and limpar(blocos[i])] for g in t["slides"]]
    grupos = [g for g in grupos if g]
    # rede de segurança: slide de um texto só que é na verdade um título curto ("O custo da conformidade")
    # seguido de outro slide de um texto só → os dois viram título + corpo no mesmo slide
    juntos: list[list[str]] = []
    k = 0
    while k < len(grupos):
        g = grupos[k]
        prox = grupos[k + 1] if k + 1 < len(grupos) else None
        if (k > 0 and len(g) == 1 and prox and len(prox) == 1 and len(g[0].split()) <= 7
                and not g[0].rstrip().endswith((".", "!", "?")) and len(prox[0].split()) > 7):
            juntos.append([g[0], prox[0]])
            k += 2
        else:
            juntos.append(g)
            k += 1
    return juntos
