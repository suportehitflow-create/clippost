"""Desenho dos moldes do Figma (sem rede): usa uma estrutura pequena montada à mão no mesmo formato do importador."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from PIL import Image

from services import figma_modelo as fm


def _texto(nome, x, y, w, h, conteudo, tam=40, familia="Inter", peso=500, cor=(0, 0, 0), alinha="LEFT"):
    return {"id": f"t{nome}", "tipo": "TEXT", "nome": nome, "x": x, "y": y, "w": w, "h": h, "texto": conteudo,
            "fills": [{"type": "SOLID", "color": {"r": cor[0], "g": cor[1], "b": cor[2]}}],
            "estilo": {"fontFamily": familia, "fontWeight": peso, "fontSize": tam, "lineHeightPx": tam * 1.2, "textAlignHorizontal": alinha}}


def _slide(filhos, fundo=(1.0, 1.0, 1.0)):
    return {"id": "s", "tipo": "FRAME", "nome": "1 (Teste)", "x": 0, "y": 0, "w": 1080, "h": 1350,
            "fills": [{"type": "SOLID", "color": {"r": fundo[0], "g": fundo[1], "b": fundo[2]}}], "filhos": filhos}


def test_campos_acha_textos_e_fotos_e_ignora_rodape():
    s = _slide([
        _texto("texto1", 40, 100, 900, 100, "A"), _texto("texto2", 40, 300, 900, 100, "B"),
        {"id": "i", "tipo": "RECTANGLE", "nome": "imagem01", "x": 40, "y": 500, "w": 900, "h": 400, "fills": [{"type": "IMAGE"}]},
        {"id": "r", "tipo": "INSTANCE", "nome": "Infos", "x": 0, "y": 0, "w": 1080, "h": 20,
         "filhos": [_texto("texto254", 0, 0, 100, 20, "estudo de caso", 14)]},
    ])
    c = fm.campos(s)
    assert sorted(c["textos"]) == [1, 2]  # texto254 está em "Infos": é rótulo fixo, não texto do carrossel
    assert sorted(c["fotos"]) == [1]


def test_texto_novo_substitui_o_do_exemplo_e_encolhe_se_nao_cabe():
    s = _slide([_texto("texto1", 40, 100, 600, 120, "Curto", tam=60, familia="Anton")])
    longo = "Uma frase comprida para obrigar o texto a encolher dentro da caixa do exemplo."
    img = fm.renderizar(s, Path("."), {1: longo}, {}, {"nome": "X", "arroba": "@x"})
    assert img.size == (1080, 1350)
    t = fm._Texto(s["filhos"][0], longo, 120)
    assert 33 <= t.tam < 60 and t.altura <= 122  # encolheu até caber na altura que o exemplo tinha
    absurdo = fm._Texto(s["filhos"][0], longo * 5, 120)
    assert absurdo.tam >= 33  # nunca abaixo de 55% do tamanho original (fica legível, mesmo estourando)


def test_foto_entra_no_encaixe_imagemNN_com_cantos():
    foto = Image.new("RGB", (1280, 720), (200, 30, 30))
    s = _slide([{"id": "i", "tipo": "RECTANGLE", "nome": "imagem01", "x": 40, "y": 500, "w": 900, "h": 400,
                 "cornerRadius": 30, "fills": [{"type": "IMAGE", "imageRef": "x", "scaleMode": "FILL"}]}])
    img = fm.renderizar(s, Path("."), {}, {1: (foto, 0.5)}, {"nome": "X"})
    assert img.getpixel((500, 700)) == (200, 30, 30)      # dentro do encaixe: foto
    assert img.getpixel((41, 501)) == (255, 255, 255)     # canto arredondado: fundo
    assert img.getpixel((10, 10)) == (255, 255, 255)      # fora do encaixe: fundo


def test_marca_substitui_arroba_e_nome_do_molde():
    s = _slide([_texto("Perfil", 40, 40, 400, 40, "@BrandsDecoded__"), _texto("nome", 600, 40, 300, 40, "BRANDSDECODED TM")])
    cx = fm.Contexto(Path("."), {}, {}, {"nome": "Toguro Clip", "arroba": "toguroclip"})
    assert fm._substituir_marca(s["filhos"][0], cx, True) == "@toguroclip"
    assert fm._substituir_marca(s["filhos"][1], cx, True) == "Toguro Clip"  # a caixa alta vem do estilo do texto no Figma


def test_gradiente_vertical_vai_de_transparente_a_preto():
    g = fm._gradiente(10, 100, {"gradientHandlePositions": [{"x": 0.5, "y": 0}, {"x": 0.5, "y": 1}],
                                "gradientStops": [{"position": 0, "color": {"r": 0, "g": 0, "b": 0, "a": 0}},
                                                  {"position": 1, "color": {"r": 0, "g": 0, "b": 0, "a": 1}}]}, 1.0)
    assert g.getpixel((5, 1))[3] < 10 and g.getpixel((5, 98))[3] > 245


def test_autolayout_vertical_ancora_embaixo_quando_o_texto_muda():
    caixa = {"id": "f", "tipo": "FRAME", "nome": "textos", "x": 0, "y": 600, "w": 1000, "h": 600, "layoutMode": "VERTICAL",
             "primaryAxisAlignItems": "MAX", "itemSpacing": 20,
             "filhos": [_texto("texto1", 0, 600, 1000, 300, "Titulo", 80, "Anton", 400, (1, 1, 1)),
                        _texto("texto2", 0, 1000, 1000, 200, "Sub", 40, "Inter", 700, (1, 1, 1))]}
    s = _slide([caixa], fundo=(0, 0, 0))
    curto = fm.renderizar(s, Path("."), {1: "Oi", 2: "Ok"}, {}, {"nome": "X"})
    # texto curto e âncora embaixo: o topo da caixa fica vazio e o texto fica perto da base (y~1200)
    topo = curto.crop((0, 600, 1000, 800)).getextrema()
    base = curto.crop((0, 1100, 1000, 1210)).getextrema()
    assert topo == ((0, 0), (0, 0), (0, 0)) and base != ((0, 0), (0, 0), (0, 0))


def test_estrutura_so_existe_com_molde_importado(monkeypatch):
    monkeypatch.setattr(fm, "moldes", lambda t: None)
    assert fm.estrutura("principal") is None
