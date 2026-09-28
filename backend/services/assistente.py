"""
Assistente "O que vamos criar?": entende o pedido do usuário e aponta a ferramenta certa do Clipost,
já preenchida (link do vídeo, @ do perfil). Usa os provedores baratos do ai_curator (Gemini → Groq →
OpenRouter). A IA só escolhe ações do catálogo abaixo; os links são montados aqui, nunca pela IA.
Sem IA disponível, cai num roteador por palavras-chave.
"""
import json
import re
from urllib.parse import quote

from services.ai_curator import _try_providers

# id → (rótulo do botão, rota, parâmetro que a rota aceita, o que a ferramenta faz)
ACOES = {
    "cortar": ("Criar cortes", "/upload", "url", "cortar um vídeo longo (YouTube, Twitch, Instagram, TikTok, arquivo) em cortes 9:16 com legenda e template"),
    "explorar": ("Explorar perfil", "/explorar", "u", "ver reels/posts/carrosséis de um @ com views e curtidas, baixar, salvar ou editar com template"),
    "monitorar": ("Monitorar no Autopilot", "/autopilot", "url", "monitorar um canal do YouTube ou perfil de Instagram/TikTok e gerar cortes de cada vídeo novo sozinho (com ou sem aprovação antes de postar)"),
    "massa": ("Edição em Massa", "/bulk", None, "editar dezenas de vídeos no template de uma vez: texto, música, legendas, efeitos"),
    "templates": ("Identidade Visual", "/templates", None, "criar/editar o template: fontes, cores, marca d'água, posição do vídeo e das legendas"),
    "raiox": ("Raio-X da página", "/raio-x-pagina", None, "métricas da conta do próprio usuário: views, engajamento, melhor horário, top posts"),
    "agendar": ("Calendário", "/schedule", None, "agendar e ver publicações no calendário"),
    "frases": ("Vídeos com frases", "/frases", None, "fotos + frases + música viram vídeos 9:16 em série"),
    "posts": ("Posts em massa", "/posts", None, "posts de foto, carrosséis e stories em massa, já agendados"),
    "musicas": ("Músicas", "/musicas", None, "biblioteca de músicas salva na conta"),
    "roteiro": ("Roteiros IA", "/creator", None, "escrever roteiros e ganchos para vídeos"),
    "tendencias": ("Radar de Viralidade", "/trends", None, "vídeos que estão viralizando nas últimas 24h"),
    "legenda": ("Legenda com IA", "/ferramentas?t=legenda", None, "legenda e hashtags para um post"),
    "aovivo": ("Cortes Ao Vivo", "/live", None, "clipar lives da Twitch/YouTube"),
    "biblioteca": ("Biblioteca", "/dashboard", None, "ver os cortes e vídeos já prontos"),
}

_URL = re.compile(r"https?://\S+", re.I)
_ARROBA = re.compile(r"(?<![\w.])@([A-Za-z0-9_.]{2,30})")


def _href(acao: str, url: str = "", perfil: str = "") -> str:
    _, rota, param, _ = ACOES[acao]
    valor = {"url": url, "u": perfil}.get(param or "", "")
    if not valor:
        return rota
    return f"{rota}{'&' if '?' in rota else '?'}{param}={quote(valor, safe='')}"


def _montar(ids: list, url: str, perfil: str) -> list[dict]:
    vistos, acoes = set(), []
    for item in ids:
        aid = item.get("id") if isinstance(item, dict) else item
        if not isinstance(aid, str) or aid not in ACOES or aid in vistos:
            continue
        vistos.add(aid)
        # link e @ vêm só do que o usuário escreveu, nunca da IA
        acoes.append({"id": aid, "rotulo": ACOES[aid][0], "href": _href(aid, url, perfil)})
    return acoes[:3]


def _palavras(texto: str, url: str, perfil: str) -> dict:
    t = texto.lower()
    regras = [
        ("monitorar", ("monitor", "autopilot", "automátic", "automatic", "todo vídeo novo", "sozinho", "vigiar")),
        ("raiox", ("minha conta", "meu desempenho", "métrica", "metrica", "insight", "melhor horário", "raio")),
        ("posts", ("carrossel", "carrosséis", "carrosseis", "story", "stories", "post de foto", "fotos em massa")),
        ("frases", ("frase", "citação", "citacao")),
        ("massa", ("em massa", "vários vídeos", "varios videos", "dezenas", "lote")),
        ("agendar", ("agendar", "agenda", "programar", "calendário", "calendario", "postar dia")),
        ("templates", ("template", "identidade", "marca d", "fonte", "cores")),
        ("roteiro", ("roteiro", "script", "gancho")),
        ("tendencias", ("viral", "tendência", "tendencia", "trend", "em alta")),
        ("legenda", ("legenda para", "hashtag", "descrição do post", "descricao do post")),
        ("musicas", ("música", "musica", "trilha")),
        ("aovivo", ("live", "ao vivo", "twitch")),
        ("explorar", ("explorar", "perfil", "concorrente", "baixar reels", "ver os posts")),
        ("cortar", ("corte", "cortar", "clip", "podcast", "vídeo longo", "video longo")),
    ]
    ids = [aid for aid, chaves in regras if any(c in t for c in chaves)]
    if url and not ids:
        ids = ["cortar", "monitorar"]
    if perfil and "explorar" not in ids and "monitorar" not in ids:
        ids.append("explorar")
    if not ids:
        ids = ["cortar", "explorar", "massa"]
    return {"resposta": "Separei o melhor caminho para isso no Clipost:", "acoes": _montar(ids, url, perfil)}


def _prompt(texto: str, historico: list[dict], url: str, perfil: str) -> str:
    catalogo = "\n".join(f"- {aid}: {d[3]}" for aid, d in ACOES.items())
    conversa = "\n".join(f"{'Usuário' if m.get('de') == 'usuario' else 'Assistente'}: {str(m.get('texto') or '')[:400]}"
                         for m in historico[-6:])
    return f"""Você é o assistente do Clipost, um app brasileiro de cortes e posts para Reels/TikTok/Shorts.
Responda em português do Brasil, curto (no máximo 3 frases), simpático e prático. Diga em 1 frase o
que o usuário vai fazer na ferramenta indicada. Nunca invente ferramentas que não estão no catálogo.

Ferramentas (use só estes ids):
{catalogo}

{f'Conversa até agora:{chr(10)}{conversa}{chr(10)}' if conversa else ''}Pedido do usuário: \"\"\"{texto[:1500]}\"\"\"
Link encontrado no pedido: {url or '(nenhum)'}
@ encontrado no pedido: {perfil or '(nenhum)'}

Escolha de 1 a 3 ações, a mais indicada primeiro. Se o pedido não tiver a ver com criar conteúdo,
responda educadamente e sugira ações úteis mesmo assim.
Responda SÓ com JSON válido, sem markdown:
{{"resposta": "...", "acoes": ["id1", "id2"]}}"""


def responder(texto: str, historico: list[dict] | None = None) -> dict:
    texto = (texto or "").strip()
    url_m = _URL.search(texto)
    url = url_m.group(0).rstrip(").,;!?\"'") if url_m else ""
    sem_url = _URL.sub(" ", texto)
    arroba = _ARROBA.search(sem_url)
    perfil = arroba.group(1) if arroba else ""

    bruto = ""
    try:
        bruto = _try_providers(_prompt(texto, historico or [], url, perfil))
    except Exception as e:
        print(f"[assistente] IA falhou: {type(e).__name__}")
    if bruto:
        try:
            limpo = re.sub(r"^```(?:json)?|```$", "", bruto.strip(), flags=re.MULTILINE).strip()
            i, f = limpo.find("{"), limpo.rfind("}")
            dados = json.loads(limpo[i:f + 1] if i >= 0 else limpo)
            resposta = str(dados.get("resposta") or "").strip()[:600]
            acoes = _montar(list(dados.get("acoes") or []), url, perfil)
            if resposta or acoes:
                if not acoes:
                    acoes = _palavras(texto, url, perfil)["acoes"]
                return {"resposta": resposta or "Separei o melhor caminho para isso:", "acoes": acoes, "fonte": "ia"}
        except Exception as e:
            print(f"[assistente] resposta da IA inválida: {type(e).__name__}")
    return {**_palavras(texto, url, perfil), "fonte": "regras"}
