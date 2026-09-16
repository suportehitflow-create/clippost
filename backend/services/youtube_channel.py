"""
Resolve um canal do YouTube a partir de @handle, URL ou ID, e lê o feed público.

O RSS exige o ID no formato UC..., mas o usuário digita o @handle. A conversão
é feita lendo a página do canal, sem precisar de chave da API do YouTube.
"""
import re
import xml.etree.ElementTree as ET

import httpx

NS = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
UA = {"User-Agent": "Mozilla/5.0"}
RSS = "https://www.youtube.com/feeds/videos.xml"


class CanalNaoEncontrado(Exception):
    pass


def _extrair_channel_id(entrada: str) -> str:
    direto = re.search(r"(UC[\w-]{22})", entrada)
    if direto:
        return direto.group(1)

    handle = entrada.strip().rstrip("/").split("/")[-1].split("?")[0].lstrip("@")
    if not handle:
        raise CanalNaoEncontrado("Informe o @handle ou a URL do canal.")

    resp = httpx.get(f"https://www.youtube.com/@{handle}", headers=UA,
                     timeout=20, follow_redirects=True)
    if not resp.is_success:
        raise CanalNaoEncontrado(f"Canal @{handle} não encontrado.")

    # A página cita vários canais (recomendados, do menu), e "channelId" aparece
    # seis vezes — a primeira é de outro canal. Só estas fontes descrevem o canal
    # da própria página.
    for padrao in (
        r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"',
        r'<meta property="og:url" content="https://www\.youtube\.com/channel/(UC[\w-]{22})"',
        r'"externalId":"(UC[\w-]{22})"',
    ):
        achado = re.search(padrao, resp.text)
        if achado:
            return achado.group(1)
    raise CanalNaoEncontrado(f"Não consegui descobrir o ID do canal @{handle}.")


def resolve_channel(entrada: str) -> dict:
    """Devolve id e nome do canal e, quando o feed responde, o vídeo mais recente.

    O YouTube limita o feed por IP e chega a devolver 404/500 de forma passageira.
    Exigir o feed aqui impediria cadastrar um canal nesses momentos, então o
    baseline é opcional: o monitor o define na primeira leitura que der certo.
    """
    channel_id = _extrair_channel_id(entrada)
    dados = {"channel_id": channel_id, "channel_name": "",
             "baseline_video_id": None, "ultimo_video": None}

    try:
        feed = httpx.get(RSS, params={"channel_id": channel_id}, headers=UA,
                         timeout=20, follow_redirects=True)
        if feed.is_success:
            raiz = ET.fromstring(feed.text)
            entradas = raiz.findall("atom:entry", NS)
            dados["channel_name"] = raiz.findtext("atom:title", default="", namespaces=NS)
            if entradas:
                dados["baseline_video_id"] = entradas[0].findtext("yt:videoId", namespaces=NS)
                dados["ultimo_video"] = entradas[0].findtext("atom:title", namespaces=NS)
    except (httpx.HTTPError, ET.ParseError):
        pass

    if not dados["channel_name"]:
        dados["channel_name"] = entrada.strip().rstrip("/").split("/")[-1].lstrip("@")
    return dados
