"""
Gera as imagens de capa dos cards do painel Início com o Gemini (Nano Banana / Imagen)
e sobe no Storage público: videos/site/capas/<id>.png

Roda DENTRO da máquina do backend (onde está a GEMINI_API_KEY), disparado pelo workflow
"Capas do painel" (.github/workflows/capas.yml):  python gerar_capas.py [--forcar]
"""
import base64
import os
import sys

import httpx
from supabase import create_client

ESTILO = (
    "Premium Apple keynote style 3D render, dark near-black background with a soft indigo "
    "(#6366f1) to purple (#9333ea) glow, glossy glass and brushed aluminium materials, "
    "cinematic soft studio lighting, shallow depth of field, minimal, centered composition "
    "with empty space at the bottom, no text, no letters, no logos, no watermark. Subject: "
)

CAPAS = {
    "cortes": "a pair of sleek glass scissors cutting a long horizontal film strip into three glowing vertical smartphone video clips",
    "massa": "a floating grid of many small vertical smartphone video tiles being edited at once, each tile glowing",
    "autopilot": "a glowing glass satellite dish scanning floating video thumbnails and turning them into vertical clips automatically, orbit lines",
    "templates": "a floating glass smartphone showing a clean layout with a round profile avatar, title bar and a video frame, color swatches around it",
    "aovivo": "a glowing red live broadcast signal icon over a vertical smartphone, soundwaves and a record dot",
    "radar": "a glass radar screen with a sweeping beam revealing small rising flame-shaped trend graphs",
    "roteiros": "an elegant glass fountain pen writing glowing lines on a floating translucent script page",
    "calendario": "a floating glass calendar with a few glowing checkmarked days and small vertical video thumbnails scheduled on it",
    "biblioteca": "neatly stacked translucent glass folders filled with vertical video thumbnails, soft reflections",
    "explorar": "a glass magnifying glass hovering over a floating grid of vertical social video thumbnails with small heart and eye icons",
    "raiox": "a translucent glass smartphone showing glowing bar charts, a rising line graph and a small heatmap grid, x-ray scan light passing through it",
    "ferramentas":"a tidy row of small precise glass tools (a hashtag symbol, a clock, a magnifying glass over a bar chart, a text cursor) floating on a dark workbench",
}

MODELO_GEMINI = "gemini-2.5-flash-image"
MODELO_IMAGEN = "imagen-4.0-fast-generate-001"


def _erro(e: Exception) -> str:
    """Mensagem de erro SEM a URL (as URLs de API nunca podem aparecer em log público)."""
    if isinstance(e, httpx.HTTPStatusError):
        return f"HTTP {e.response.status_code}"
    return type(e).__name__


def gerar(chave: str, prompt: str) -> bytes:
    base = "https://generativelanguage.googleapis.com/v1beta/models"
    # A chave vai no cabeçalho, nunca na URL (a URL aparece em mensagens de erro)
    cab = {"x-goog-api-key": chave}
    # 1) Gemini (Nano Banana)
    try:
        r = httpx.post(
            f"{base}/{MODELO_GEMINI}:generateContent",
            headers=cab,
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9"}},
            },
            timeout=120,
        )
        r.raise_for_status()
        for parte in r.json()["candidates"][0]["content"]["parts"]:
            dado = parte.get("inlineData") or parte.get("inline_data")
            if dado and dado.get("data"):
                return base64.b64decode(dado["data"])
        raise RuntimeError("resposta sem imagem")
    except Exception as e:
        print(f"  Gemini falhou ({_erro(e)}), tentando Imagen...")
    # 2) Imagen
    r = httpx.post(
        f"{base}/{MODELO_IMAGEN}:predict",
        headers=cab,
        json={"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1, "aspectRatio": "16:9"}},
        timeout=120,
    )
    r.raise_for_status()
    return base64.b64decode(r.json()["predictions"][0]["bytesBase64Encoded"])


def main() -> int:
    chave = os.environ.get("GEMINI_API_KEY", "")
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not chave or not url or not key:
        print("faltam GEMINI_API_KEY / SUPABASE_URL / SUPABASE_KEY no ambiente")
        return 1
    forcar = "--forcar" in sys.argv
    sb = create_client(url, key).storage.from_("videos")
    existentes = {f["name"] for f in (sb.list("site/capas") or [])}
    falhas = 0
    for nome, assunto in CAPAS.items():
        arquivo = f"{nome}.png"
        if arquivo in existentes and not forcar:
            print(f"- {nome}: já existe")
            continue
        print(f"- {nome}: gerando...")
        try:
            png = gerar(chave, ESTILO + assunto)
            sb.upload(f"site/capas/{arquivo}", png, {"content-type": "image/png", "upsert": "true"})
            print(f"  ok ({len(png) // 1024} KB)")
        except Exception as e:
            falhas += 1
            print(f"  FALHOU: {_erro(e)}")
    return 1 if falhas == len(CAPAS) else 0


if __name__ == "__main__":
    sys.exit(main())
