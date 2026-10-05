"""Carrosséis automáticos: link (vídeo/podcast, Instagram, artigo, site) ou texto → insights → carrosséis prontos.

Mesma ideia do Criar cortes, mas a saída é carrossel:
1. lê o conteúdo (legenda do YouTube / transcrição / texto da página)
2. a IA acha os insights que rendem carrossel (com o trecho em que cada um é falado)
3. para cada insight, o Content Machine (prompt do usuário, em backend/prompts/privado) roda as etapas
   sozinho — triagem, headlines, escolha, espinha dorsal e render no template — e devolve os textos
4. as imagens saem do próprio vídeo: frames do trecho do insight, os mais nítidos, com rosto se houver
5. os slides são desenhados (carrossel_render) e guardados; cada carrossel vira uma linha em "carousels"
IA: a mesma cadeia grátis dos cortes (Gemini → Groq → OpenRouter).
"""
import io
import json
import re
import shutil
import tempfile
import threading
import time
import uuid
from pathlib import Path

from services import carrossel_render as render
from services.carrossel_conteudo import obter, tipo_da_fonte

PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
PRIVADO = PROMPTS / "privado" / "content_machine"
MAX_FONTES = 10
MAX_POR_FONTE = 8

# limite de palavras por texto, para caber no slide (título / corpo / slide de um texto só)
LIMITES = {"principal": (12, 45, 40), "autoral": (12, 50, 45), "futurista": (10, 32, 26), "twitter": (40, 40, 40)}

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


# ─── andamento ────────────────────────────────────────────────────────────────

def _set(job_id: str, **kw):
    with _lock:
        _jobs[job_id].update(kw)


def _item(job_id: str, idx: int, **kw):
    with _lock:
        _jobs[job_id]["fontes"][idx].update(kw)


def _novo_carrossel(job_id: str, idx: int, dados: dict) -> int:
    with _lock:
        lista = _jobs[job_id]["fontes"][idx].setdefault("carrosseis", [])
        lista.append(dados)
        return len(lista) - 1


def _carrossel(job_id: str, idx: int, k: int, **kw):
    with _lock:
        _jobs[job_id]["fontes"][idx]["carrosseis"][k].update(kw)


def status(job_id: str, user_id: str) -> dict | None:
    with _lock:
        j = _jobs.get(job_id)
        if not j or j["user_id"] != user_id:
            return None
        return json.loads(json.dumps({k: v for k, v in j.items() if k != "user_id"}, default=str))


# ─── IA ───────────────────────────────────────────────────────────────────────

def _gemini_json(prompt: str, temperatura: float) -> str:
    """Gemini no modo JSON (responseMimeType): a resposta já vem como JSON válido, sem texto em volta."""
    import os
    import httpx
    chave = os.environ.get("GEMINI_API_KEY", "")
    if not chave:
        return ""
    from services.ai_curator import GEMINI_BASE, GEMINI_MODEL
    corpo = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 24000, "temperature": temperatura, "responseMimeType": "application/json"},
    }, ensure_ascii=False).encode("utf-8")
    for modelo in dict.fromkeys([GEMINI_MODEL, "gemini-2.5-flash-lite", "gemini-2.5-flash"]):
        for tentativa in range(2):
            try:
                r = httpx.post(f"{GEMINI_BASE}/{modelo}:generateContent", content=corpo, timeout=120,
                               headers={"Content-Type": "application/json; charset=utf-8", "x-goog-api-key": chave})
                if r.status_code == 429:
                    time.sleep(20)
                    continue
                if r.status_code >= 400:
                    break
                partes = ((r.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
                texto = "".join(p.get("text", "") for p in partes if not p.get("thought")).strip()
                if texto:
                    return texto
            except Exception as e:
                print(f"[carrossel] gemini {modelo}: {type(e).__name__}: {str(e)[:120]}")
    return ""


def _ia(prompt: str, temperatura: float = 0.4) -> str:
    texto = _gemini_json(prompt, temperatura)
    if texto:
        return texto
    from services.ai_curator import _try_providers  # Groq / OpenRouter grátis, se o Gemini falhar
    return _try_providers(prompt)


def _json(raw: str):
    """Primeiro objeto/array JSON da resposta (a IA às vezes embrulha em ```json ou deixa vírgula sobrando)."""
    t = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.M).strip()
    # o que abre primeiro manda: um objeto com lista dentro não pode virar só a lista
    pares = sorted((("[", "]"), ("{", "}")), key=lambda p: t.find(p[0]) if t.find(p[0]) != -1 else len(t))
    for abre, fecha in pares:
        i, j = t.find(abre), t.rfind(fecha)
        if i != -1 and j > i:
            trecho = t[i:j + 1]
            for candidato in (trecho, re.sub(r",\s*([\]}])", r"\1", trecho)):
                try:
                    return json.loads(candidato)
                except json.JSONDecodeError:
                    continue
    print(f"[carrossel] resposta sem JSON válido: {(raw or '')[:300]!r}")
    raise ValueError("a IA não devolveu JSON válido")


def _ia_json(prompt: str, temperatura: float = 0.4, tentativas: int = 2):
    erro = None
    for _ in range(tentativas):
        try:
            return _json(_ia(prompt, temperatura))
        except ValueError as e:
            erro = e
    raise erro


def especificacao() -> str:
    """Prompt do Content Machine do usuário (fica só na máquina, fora do repositório público)."""
    partes = []
    for nome in ("system_instructions.md", "master_spec.md", "template_library.md", "few_shots.md"):
        p = PRIVADO / nome
        if p.exists():
            partes.append(re.sub(r"\\([#*_\-.()!>`|\[\]])", r"\1", p.read_text(encoding="utf-8")))
    if partes:
        return "\n\n".join(partes)
    return ("Você é um roteirista de carrosséis narrativos para Instagram: capa com headline de 2 linhas que captura "
            "e ancora, desenvolvimento com mecanismo, prova e aplicação, sem 2ª pessoa, sem inventar fatos.")


def segundos(v) -> float:
    """Tempo vindo da IA: número (segundos) ou texto "mm:ss" / "hh:mm:ss"."""
    if isinstance(v, (int, float)):
        return max(0.0, float(v))
    s = str(v or "").strip().strip("[]")
    try:
        if ":" in s:
            partes = [float(p) for p in s.split(":")]
            total = 0.0
            for p in partes:
                total = total * 60 + p
            return total
        return max(0.0, float(s or 0))
    except ValueError:
        return 0.0


def _mmss(s: float) -> str:
    s = max(0, int(s))
    return f"{s // 60:02d}:{s % 60:02d}"


def _conteudo_para_ia(c: dict, limite: int = 120000) -> str:
    if c["segments"]:
        linhas = [f"[{_mmss(float(s.get('start') or 0))}] {str(s.get('text') or '').strip()}" for s in c["segments"]]
        texto = "\n".join(linhas)
    else:
        texto = c["texto"]
    return texto[:limite]


def _quantidade_auto(c: dict) -> int:
    if c["segments"]:
        dur = float(c["segments"][-1].get("end") or 0)
        return max(1, min(MAX_POR_FONTE, round(dur / 600)))  # ~1 carrossel a cada 10 min de conversa
    return max(1, min(4, len(c["texto"]) // 4000 + 1))


def achar_insights(c: dict, quantidade) -> list[dict]:
    n = _quantidade_auto(c) if str(quantidade) == "auto" else max(1, min(MAX_POR_FONTE, int(quantidade)))
    prompt = (PROMPTS / "carrossel_insights.txt").read_text(encoding="utf-8").format(
        quantidade=f"exatamente {n} insight(s)", titulo=c.get("titulo") or "(sem título)", conteudo=_conteudo_para_ia(c))
    itens = _ia_json(prompt, 0.3)
    if isinstance(itens, dict):
        itens = itens.get("insights") or [itens]
    validos = [i for i in itens if isinstance(i, dict) and str(i.get("tese") or "").strip()]
    for i in validos:
        i["inicio"], i["fim"] = segundos(i.get("inicio")), segundos(i.get("fim"))
    if not validos:
        raise RuntimeError("A IA não achou insights nesse conteúdo.")
    return validos[:n]


def _trecho(c: dict, ins: dict, folga: float = 45.0) -> str:
    ini, fim = segundos(ins.get("inicio")), segundos(ins.get("fim"))
    if c["segments"] and fim > ini:
        partes = [str(s.get("text") or "").strip() for s in c["segments"]
                  if float(s.get("end") or 0) >= ini - folga and float(s.get("start") or 0) <= fim + folga]
        txt = " ".join(partes)
        if len(txt) > 300:
            return txt[:14000]
    return c["texto"][:14000]


SEGUNDA_PESSOA = re.compile(r"\b(você|vocês|voce|seu|sua|seus|suas|teu|tua|te|contigo)\b", re.I)


def _reescrever_sem_segunda_pessoa(blocos: list[str]) -> list[str] | None:
    prompt = ("Reescreva cada texto abaixo SEM 2ª pessoa (sem você, seu, sua, seus, suas, te, teu, tua), "
              "trocando por 3ª pessoa ou formulação impessoal. Mantenha o sentido, o tamanho e a força de cada texto; "
              "não mude o que não precisa. Responda SOMENTE um array JSON com a mesma quantidade de textos, na mesma ordem.\n\n"
              + json.dumps(blocos, ensure_ascii=False))
    try:
        novos = _ia_json(prompt, 0.3)
        if isinstance(novos, list) and len(novos) == len(blocos):
            return [render.limpar(n) or b for n, b in zip(novos, blocos)]
    except Exception as e:
        print(f"[carrossel] reescrita sem 2ª pessoa: {type(e).__name__}")
    return None


def escrever(c: dict, ins: dict, template: str) -> dict:
    t = render.TEMPLATES[template]
    mt, mc, mu = LIMITES.get(template, (12, 45, 40))
    # papel de cada texto, um por linha: a IA erra menos quando sabe exatamente o que vai em cada slide
    papeis = []
    for k, g in enumerate(t["slides"]):
        for pos, i in enumerate(g):
            if k == 0:
                papel = "capa, linha 1 da headline (captura)" if pos == 0 else "capa, linha 2 da headline (ancoragem)"
            elif template == "twitter":
                papel = f"parágrafo {pos + 1} de 3 do post (frase completa)"
            elif len(g) == 1:
                papel = f"texto ÚNICO do slide: frase completa e autossuficiente (até {mu} palavras), NÃO é título"
            else:
                papel = f"título do slide (até {mt} palavras)" if pos == 0 else f"corpo do slide (até {mc} palavras)"
            papeis.append(f"\n  texto {i + 1} → slide {k + 1}: {papel}")
    distribuicao = "".join(papeis)
    prompt = (PROMPTS / "carrossel_auto.txt").read_text(encoding="utf-8").format(
        especificacao=especificacao(), template_nome=t["nome"], blocos=t["blocos"], distribuicao=distribuicao,
        max_titulo=mt, max_corpo=mc, max_unico=mu, fonte_titulo=c.get("titulo") or "(sem título)",
        titulo_interno=ins.get("titulo_interno") or "", tese=ins.get("tese") or "",
        evidencias=" | ".join(str(e) for e in (ins.get("evidencias") or [])), trecho=_trecho(c, ins))
    ultimo_erro = None
    for tentativa in range(2):
        try:
            r = _ia_json(prompt if tentativa == 0 else prompt + f"\n\nATENÇÃO: o array \"blocos\" precisa ter EXATAMENTE {t['blocos']} itens.", 0.6)
            # a posição de cada texto é o papel dele no slide: não dá para descartar vazios e deslocar o resto
            bruto = [render.limpar(b) for b in (r.get("blocos") or [])]
            if len(bruto) != t["blocos"] or any(not b for b in bruto):
                if tentativa == 0:
                    raise ValueError(f"vieram {len(bruto)} textos ({sum(1 for b in bruto if not b)} vazios), o template pede {t['blocos']}")
                # última tentativa: só aceita se faltar pouco, completando sem mover os textos que já estão no lugar
                if len([b for b in bruto if b]) < t["blocos"] - 2:
                    raise ValueError("a IA devolveu textos de menos")
                ultimo = next((b for b in reversed(bruto) if b), "")
                bruto = (bruto + [""] * t["blocos"])[:t["blocos"]]
                bruto = [b or ultimo for b in bruto]
            blocos = bruto
            r["blocos"] = blocos
            # regra do Content Machine: sem 2ª pessoa — se escapou, pede uma reescrita só dos textos
            if tentativa == 0 and SEGUNDA_PESSOA.search(" ".join(blocos)):
                corrigido = _reescrever_sem_segunda_pessoa(blocos)
                if corrigido:
                    r["blocos"] = corrigido
            return r
        except Exception as e:
            ultimo_erro = e
    raise RuntimeError(f"Não consegui escrever o carrossel ({ultimo_erro}).")


# ─── imagens do vídeo ─────────────────────────────────────────────────────────

_rostos = None


def _detector():
    global _rostos
    if _rostos is None:
        import cv2
        _rostos = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _rostos


def _melhorar(img):
    """Frame de vídeo costuma vir pequeno e mole: aumenta com Lanczos, tira o ruído leve e devolve a nitidez."""
    import cv2
    h, w = img.shape[:2]
    if h < 1350:
        e = 1350 / h
        img = cv2.resize(img, (int(w * e), 1350), interpolation=cv2.INTER_LANCZOS4)
    img = cv2.bilateralFilter(img, 5, 30, 30)
    borrado = cv2.GaussianBlur(img, (0, 0), 2.2)
    return cv2.addWeighted(img, 1.45, borrado, -0.45, 0)


def _sem_legenda_gravada(quadro):
    """Muitos vídeos (cortes, podcasts) já vêm com legenda gravada na parte de baixo. Ela brigaria com o texto
    do slide: se a faixa de baixo tem bem mais contorno de letra que o resto, corta a imagem acima dela."""
    import cv2
    h = quadro.shape[0]
    bordas = cv2.Canny(cv2.cvtColor(quadro, cv2.COLOR_BGR2GRAY), 80, 200)
    faixa = bordas[int(h * 0.68):int(h * 0.95)].mean()
    resto = bordas[int(h * 0.15):int(h * 0.62)].mean() + 1e-6
    if faixa > resto * 1.5 and faixa > 6:
        return quadro[: int(h * 0.68)]
    return quadro


def frames_do_trecho(video: Path, inicio: float, fim: float, quantos: int) -> list[tuple]:
    """Os melhores frames do trecho: nítidos, bem expostos, com rosto, e longe uns dos outros no tempo.
    Devolve [(imagem PIL, foco_x)] — foco_x = centro do rosto, para o recorte não cortar a pessoa."""
    import cv2
    from PIL import Image
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return []
    dur = max(0.0, (cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)) / (cap.get(cv2.CAP_PROP_FPS) or 30)
    if dur < 2:  # contagem de quadros indisponível ou vídeo curtíssimo: lê o início para descobrir
        dur = max(dur, 10.0)
    if fim <= inicio or fim > dur + 1:
        inicio, fim = 0.0, dur
    inicio, fim = max(0.0, inicio - 3), max(inicio + 1.0, min(dur - 0.5, fim + 3))
    amostras = max(quantos * 6, 18)
    candidatos = []
    for k in range(amostras):
        t = inicio + (fim - inicio) * (k + 0.5) / amostras
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, quadro = cap.read()
        if not ok or quadro is None:
            continue
        quadro = _sem_legenda_gravada(quadro)
        cinza = cv2.cvtColor(quadro, cv2.COLOR_BGR2GRAY)
        nitidez = cv2.Laplacian(cinza, cv2.CV_64F).var()
        brilho = float(cinza.mean())
        exp = 1.0 - min(1.0, abs(brilho - 120) / 120)
        pequeno = cv2.resize(cinza, (cinza.shape[1] // 2, cinza.shape[0] // 2))
        rostos = _detector().detectMultiScale(pequeno, 1.15, 5, minSize=(40, 40))
        foco, bonus = 0.5, 1.0
        if len(rostos):
            x, y, w, h = max(rostos, key=lambda r: r[2] * r[3])
            foco = (x + w / 2) / pequeno.shape[1]
            bonus = 1.6
        hsv = cv2.cvtColor(cv2.resize(quadro, (160, 90)), cv2.COLOR_BGR2HSV)
        hist = cv2.normalize(cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256]), None).flatten()
        candidatos.append((nitidez * (0.4 + exp) * bonus, t, quadro, foco, hist))
    cap.release()
    candidatos.sort(key=lambda c: c[0], reverse=True)
    escolhidos = []
    for nota, t, quadro, foco, hist in candidatos:
        longe = all(abs(t - e[1]) > max(2.5, (fim - inicio) / (quantos * 2.5)) for e in escolhidos)
        # mesma câmera e mesmo enquadramento = imagem repetida no carrossel: pula
        diferente = all(cv2.compareHist(hist, e[4], cv2.HISTCMP_CORREL) < 0.93 for e in escolhidos)
        if longe and diferente:
            escolhidos.append((nota, t, quadro, foco, hist))
        if len(escolhidos) >= quantos:
            break
    escolhidos.sort(key=lambda c: c[1])  # na ordem do vídeo
    return [(Image.fromarray(cv2.cvtColor(_melhorar(q), cv2.COLOR_BGR2RGB)), f) for _, _, q, f, _ in escolhidos]


def _imagens_de_url(urls: list[str], quantos: int) -> list[tuple]:
    from PIL import Image
    from services.carrossel_conteudo import baixar_seguro
    Image.MAX_IMAGE_PIXELS = 60_000_000  # barra "bomba" de descompressão
    out = []
    for u in urls[:quantos]:
        try:
            dados, _ = baixar_seguro(u, limite=10_000_000, tipo_prefixo="image/")
            out.append((Image.open(io.BytesIO(dados)).convert("RGB"), 0.5))
        except Exception as e:
            print(f"[carrossel] imagem ignorada: {type(e).__name__}")
    return out


def slides_com_imagem(template: str, n_slides: int, modo: str) -> list[int]:
    """Em quais slides entra imagem: capa sempre; em 'algumas', mais 2–3 slides do meio."""
    if modo == "nenhuma":
        return []
    if modo == "capa" or n_slides <= 2:
        return [0]
    meio = [k for k in range(2, n_slides - 1, 3)][:3] if template != "twitter" else [k for k in range(2, n_slides - 1, 3)][:1]
    return [0] + meio


# ─── trabalho ─────────────────────────────────────────────────────────────────

_vagas = threading.Semaphore(2)  # no máximo 2 gerações ao mesmo tempo no servidor (CPU, disco e cota de IA)


class Ocupado(Exception):
    pass


def iniciar(user_id: str, req: dict, supabase) -> str:
    fontes_brutas = req.get("fontes")
    if not isinstance(fontes_brutas, list):
        raise ValueError("fontes deve ser uma lista")
    fontes = [str(f).strip()[:60000] for f in fontes_brutas if str(f).strip()][:MAX_FONTES]
    q = str(req.get("quantidade") or "auto")
    req["quantidade"] = q if q == "auto" or (q.isdigit() and 1 <= int(q) <= MAX_POR_FONTE) else "auto"
    job_id = uuid.uuid4().hex[:12]
    with _lock:
        if any(j["user_id"] == user_id and j["status"] == "processing" for j in _jobs.values()):
            raise Ocupado("Você já tem carrosséis sendo criados. Espere terminar para começar outros.")
        _jobs[job_id] = {
            "user_id": user_id, "status": "processing", "criado": time.time(),
            "template": req.get("template") if req.get("template") in render.TEMPLATES else "principal",
            "fontes": [{"fonte": f, "tipo": tipo_da_fonte(f), "etapa": "na fila", "status": "pending", "erro": None,
                        "titulo": None, "carrosseis": []} for f in fontes],
        }
    threading.Thread(target=_rodar, args=(job_id, user_id, req, supabase), daemon=True).start()
    return job_id


def _rodar(job_id: str, user_id: str, req: dict, supabase):
    with _vagas:
        _rodar_com_vaga(job_id, user_id, req, supabase)


def _rodar_com_vaga(job_id: str, user_id: str, req: dict, supabase):
    tmp = Path(tempfile.mkdtemp(prefix="clippost_carrossel_"))
    template = _jobs[job_id]["template"]
    marca = req.get("marca") or {}
    modo_img = req.get("imagens") if req.get("imagens") in ("capa", "algumas", "nenhuma") else "algumas"
    quantidade = req.get("quantidade") or "auto"
    try:
        for idx, item in enumerate(list(_jobs[job_id]["fontes"])):
            _item(job_id, idx, status="processing", etapa="lendo o conteúdo")
            pasta = tmp / str(idx)
            try:
                c = obter(item["fonte"], pasta, com_video=modo_img != "nenhuma",
                          aviso=lambda e, i=idx: _item(job_id, i, etapa=e))
                if c["segments"] and float(c["segments"][-1].get("end") or 0) > 3 * 3600:
                    raise RuntimeError("Conteúdo longo demais (máximo 3 horas por link).")
                _item(job_id, idx, titulo=c.get("titulo") or None, etapa="achando os insights")
                insights = achar_insights(c, quantidade)
                projeto = supabase.table("projects").insert({
                    "user_id": user_id, "title": (f"Carrosséis · {c.get('titulo') or item['fonte']}")[:200],
                    "source_url": item["fonte"] if item["tipo"] != "texto" else "texto",
                    "source_type": "url" if item["tipo"] != "texto" else "file", "platform": "carrossel", "status": "done",
                }).execute().data[0]
                for ins in insights:
                    k = _novo_carrossel(job_id, idx, {"titulo": ins.get("titulo_interno") or ins.get("tese", "")[:60],
                                                     "status": "processing", "etapa": "escrevendo", "slides": [], "erro": None})
                    try:
                        _fazer_carrossel(job_id, idx, k, c, ins, template, marca, modo_img, projeto["id"], user_id, supabase, pasta)
                    except Exception as e:
                        print(f"[carrossel] carrossel {idx}/{k}: {type(e).__name__}: {str(e)[:200]}")
                        _carrossel(job_id, idx, k, status="failed", erro=str(e)[:200])
                feitos = [x for x in _jobs[job_id]["fontes"][idx]["carrosseis"] if x["status"] == "done"]
                if not feitos:  # nenhum ficou pronto: não deixa um projeto vazio na lista do usuário
                    try:
                        supabase.table("projects").delete().eq("id", projeto["id"]).execute()
                    except Exception:
                        pass
                _item(job_id, idx, status="done" if feitos else "failed", etapa="pronto" if feitos else "falhou",
                      erro=None if feitos else "Nenhum carrossel ficou pronto.")
            except Exception as e:
                print(f"[carrossel] fonte {idx}: {type(e).__name__}: {str(e)[:200]}")
                _item(job_id, idx, status="failed", etapa="falhou", erro=str(e)[:200])
            finally:
                shutil.rmtree(pasta, ignore_errors=True)
        _set(job_id, status="done")
    except Exception as e:
        print(f"[carrossel] job {job_id}: {type(e).__name__}: {str(e)[:200]}")
        _set(job_id, status="failed", erro=str(e)[:200])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        with _lock:
            for chave in [k for k, v in _jobs.items() if time.time() - v["criado"] > 6 * 3600]:
                _jobs.pop(chave, None)


def _fazer_carrossel(job_id, idx, k, c, ins, template, marca, modo_img, project_id, user_id, supabase, pasta):
    r = escrever(c, ins, template)
    blocos = r["blocos"]
    grupos = render.textos_por_slide(template, blocos)
    titulo = " ".join(grupos[0]) if grupos else ins.get("titulo_interno", "")
    _carrossel(job_id, idx, k, titulo=titulo[:160], etapa="escolhendo as imagens")

    alvo = slides_com_imagem(template, len(grupos), modo_img)
    fotos: list[tuple] = []
    if alvo and c.get("video"):
        fotos = frames_do_trecho(c["video"], segundos(ins.get("inicio")), segundos(ins.get("fim")), len(alvo))
    if alvo and not fotos and c.get("imagens"):
        fotos = _imagens_de_url(c["imagens"], len(alvo))
    imagens = {s: fotos[i] for i, s in enumerate(alvo) if i < len(fotos)}

    _carrossel(job_id, idx, k, etapa="montando os slides")
    slides = render.montar_slides(template, blocos, marca, imagens)

    from services import armazenamento
    cid = uuid.uuid4().hex[:10]
    urls = []
    for n, img in enumerate(slides, 1):
        buf = io.BytesIO()
        img.save(buf, "PNG", optimize=True)
        urls.append(armazenamento.enviar(f"{user_id}/carrosseis/{cid}/{n:02d}.png", buf.getvalue(), "image/png"))
    meta = {k2: r.get(k2) for k2 in ("triagem", "headlines", "escolhida", "espinha")}
    meta.update({"insight": ins, "fonte_titulo": c.get("titulo")})
    linha = supabase.table("carousels").insert({
        "user_id": user_id, "project_id": project_id, "title": titulo[:200], "caption": str(r.get("legenda") or "")[:2200],
        "template": template, "source_url": None if c["tipo"] == "texto" else _jobs[job_id]["fontes"][idx]["fonte"],
        "blocos": blocos, "slides": [{"url": u, "textos": g} for u, g in zip(urls, grupos)], "meta": meta, "status": "ready",
    }).execute().data[0]
    _carrossel(job_id, idx, k, status="done", etapa="pronto", slides=urls, id=linha["id"],
               legenda=linha.get("caption") or "")
