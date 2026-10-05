"""Partes do carrossel automático que não dependem de IA nem de rede."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from services import carrossel_render as render
from services.carrossel_conteudo import extrair_pagina, tipo_da_fonte
from services.carrosseis import SEGUNDA_PESSOA, _json, segundos, slides_com_imagem


@pytest.mark.parametrize("v,esperado", [(75, 75.0), ("75", 75.0), ("01:15", 75.0), ("1:02:03", 3723.0), ("[12:09]", 729.0), (None, 0.0), ("x", 0.0)])
def test_segundos_aceita_numero_e_mmss(v, esperado):
    assert segundos(v) == esperado


def test_json_tolera_cerca_e_virgula_sobrando():
    assert _json('```json\n[{"a": 1},]\n```') == [{"a": 1}]
    assert _json('Aqui está: {"blocos": ["x", "y",]} fim') == {"blocos": ["x", "y"]}
    with pytest.raises(ValueError):
        _json("sem json nenhum")


@pytest.mark.parametrize("tpl,slides", [("principal", 9), ("autoral", 9), ("futurista", 10), ("twitter", 7)])
def test_cada_template_usa_todos_os_textos(tpl, slides):
    t = render.TEMPLATES[tpl]
    usados = sorted(i for g in t["slides"] for i in g)
    assert usados == list(range(t["blocos"]))
    assert len(t["slides"]) == slides
    blocos = [f"texto {i + 1} - conteúdo {i + 1}" for i in range(t["blocos"])]
    grupos = render.textos_por_slide(tpl, blocos)
    assert grupos[0][0] == "conteúdo 1"  # prefixo "texto N -" sai


def test_titulo_solto_junta_com_o_texto_seguinte():
    blocos = ["Capa linha 1:", "Capa linha 2."] + ["Título A", "Corpo A com bastante conteúdo aqui."] * 3 + \
             ["O custo da conformidade", "Enquanto a liberação ocorre rápido lá, aqui o emplacamento exige muitas etapas.",
              "Uma frase completa e autossuficiente que fecha o raciocínio do carrossel.", "Outra frase final completa para o último slide.",
              "Mais uma frase completa com conteúdo concreto do insumo.", "E a última frase completa que fecha o carrossel inteiro."]
    assert len(blocos) == render.TEMPLATES["futurista"]["blocos"]
    grupos = render.textos_por_slide("futurista", blocos)
    assert ["O custo da conformidade", "Enquanto a liberação ocorre rápido lá, aqui o emplacamento exige muitas etapas."] in grupos
    assert sum(len(g) for g in grupos) == 14


def test_limpar_tira_markdown():
    assert render.limpar("**texto 3 -** Um *ponto* importante") == "Um ponto importante"


def test_slides_com_imagem():
    assert slides_com_imagem("principal", 9, "nenhuma") == []
    assert slides_com_imagem("principal", 9, "capa") == [0]
    assert slides_com_imagem("principal", 9, "algumas")[0] == 0
    assert len(slides_com_imagem("principal", 9, "algumas")) <= 4


@pytest.mark.parametrize("fonte,tipo", [
    ("https://www.youtube.com/watch?v=abc", "video"), ("https://youtu.be/abc", "video"),
    ("https://www.instagram.com/p/xyz/", "instagram"), ("https://g1.globo.com/economia/noticia.html", "pagina"),
    ("Um texto colado qualquer", "texto"),
])
def test_tipo_da_fonte(fonte, tipo):
    assert tipo_da_fonte(fonte) == tipo


def test_extrair_pagina_pega_titulo_texto_e_capa():
    html = """<html><head><title>Título da aba</title>
    <meta property="og:title" content="Título do artigo"><meta property="og:image" content="https://x.com/capa.jpg"></head>
    <body><nav><p>menu menu menu menu menu menu menu menu menu menu</p></nav>
    <article><p>Primeiro parágrafo com conteúdo suficiente para contar como texto do artigo.</p>
    <p>Segundo parágrafo, também longo o bastante para entrar na extração do conteúdo.</p></article>
    <script>var x = "<p>não é texto</p>";</script></body></html>"""
    p = extrair_pagina(html)
    assert p["titulo"] == "Título do artigo"
    assert p["imagem"] == "https://x.com/capa.jpg"
    assert "Primeiro parágrafo" in p["texto"] and "Segundo parágrafo" in p["texto"]
    assert "menu" not in p["texto"] and "não é texto" not in p["texto"]


@pytest.mark.parametrize("url", [
    "http://localhost/admin", "http://127.0.0.1:8000/health", "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/x", "http://[::1]/x", "file:///etc/passwd", "ftp://example.com/x", "http://0.0.0.0/",
    "http://exemplo.com:8080/x", "http://clippost-backend.internal/x",
])
def test_url_segura_bloqueia_rede_interna(url):
    from services.carrossel_conteudo import url_segura
    assert not url_segura(url)


def test_baixar_seguro_recusa_endereco_interno():
    from services.carrossel_conteudo import baixar_seguro
    with pytest.raises(RuntimeError):
        baixar_seguro("http://127.0.0.1:8000/health")


def test_escrever_nao_desloca_textos_quando_vem_vazio(monkeypatch):
    from services import carrosseis
    n = render.TEMPLATES["principal"]["blocos"]
    cheio = [f"Texto {i + 1} completo e concreto do insumo." for i in range(n)]
    furado = list(cheio)
    furado[4] = ""  # vazio no meio: antes deslocava todo o resto
    respostas = [{"blocos": furado, "legenda": "x"}, {"blocos": cheio, "legenda": "x"}]
    monkeypatch.setattr(carrosseis, "_ia_json", lambda *a, **k: respostas.pop(0))
    monkeypatch.setattr(carrosseis, "especificacao", lambda: "spec")
    r = carrosseis.escrever({"titulo": "t", "texto": "x" * 400, "segments": []}, {"tese": "t"}, "principal")
    assert r["blocos"][4] == "Texto 5 completo e concreto do insumo."  # no lugar certo, depois de refazer


def test_iniciar_valida_entrada_e_um_job_por_usuario():
    from services import carrosseis
    with pytest.raises(ValueError):
        carrosseis.iniciar("u1", {"fontes": "não é lista"}, None)


def test_detector_de_segunda_pessoa():
    assert SEGUNDA_PESSOA.search("Seu contador sabe mais")
    assert SEGUNDA_PESSOA.search("o que você não vê")
    assert not SEGUNDA_PESSOA.search("O contador sabe mais sobre a operação")
    assert not SEGUNDA_PESSOA.search("a seção de setembro")  # 'se' e 'set' não contam


@pytest.mark.parametrize("tpl", list(render.TEMPLATES))
def test_slides_saem_no_tamanho_do_instagram(tpl):
    t = render.TEMPLATES[tpl]
    blocos = ["Uma frase de teste com algumas palavras para caber no slide."] * t["blocos"]
    slides = render.montar_slides(tpl, blocos, {"nome": "Página", "arroba": "@pagina"}, {})
    assert len(slides) == len(t["slides"])
    assert all(s.size == (1080, 1350) for s in slides)
