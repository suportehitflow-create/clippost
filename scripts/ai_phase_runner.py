import os
import json
import subprocess
import time
import sys
import re

PHASE_FILE = os.environ.get("INPUT_PHASE_FILE", "fase_06_monetizacao.md")
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "5"))
API_KEY = os.environ["ANTHROPIC_API_KEY"]

import anthropic
client = anthropic.Anthropic(api_key=API_KEY)

phase_path = f"docs/fases/{PHASE_FILE}"
with open(phase_path, "r") as f:
    phase_content = f.read()

print(f"=== AI Phase Runner: {PHASE_FILE} ===")
print(f"Phase instructions loaded ({len(phase_content)} chars)")

cursorrules = ""
if os.path.exists(".cursorrules"):
    with open(".cursorrules") as f:
        cursorrules = f.read()

system_prompt = f"""Você é um engenheiro de software sênior trabalhando no projeto Clip Pro.

REGRAS ABSOLUTAS (nunca viole):
{cursorrules}

Sua tarefa: implementar exatamente o que está descrito no arquivo de fase.
Retorne APENAS código funcional nos arquivos corretos.
Formato de resposta: para cada arquivo, use blocos ```filepath:caminho/do/arquivo``` seguido do código completo.
NÃO explique, NÃO use markdown além dos blocos de código, NÃO invente funcionalidades extras."""

error_context = ""
attempt = 0

while attempt < MAX_ATTEMPTS:
    attempt += 1
    print(f"\n--- Tentativa {attempt}/{MAX_ATTEMPTS} ---")

    if error_context:
        user_msg = f"A implementação anterior quebrou com este erro:\n\n{error_context}\n\nCorrijae implemente novamente:\n\n{phase_content}"
    else:
        user_msg = f"Implemente a seguinte fase:\n\n{phase_content}"

    backoff = 10
    for api_try in range(3):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}]
            )
            break
        except anthropic.RateLimitError:
            print(f"Rate limit hit, waiting {backoff}s...")
            time.sleep(backoff)
            backoff *= 2
        except anthropic.BadRequestError as e:
            if "402" in str(e) or "credit" in str(e).lower():
                print("ERRO: Créditos da API zerados! Pausando pipeline.")
                sys.exit(1)
            raise

    ai_code = response.content[0].text
    print(f"AI response received ({len(ai_code)} chars)")

    file_blocks = re.findall(r'```filepath:(.+?)\n(.*?)```', ai_code, re.DOTALL)

    if not file_blocks:
        file_blocks = re.findall(r'```[\w./-]*\n#\s*file:\s*(.+?)\n(.*?)```', ai_code, re.DOTALL)

    if file_blocks:
        for filepath, code in file_blocks:
            filepath = filepath.strip()
            dirpath = os.path.dirname(filepath)
            if dirpath:
                os.makedirs(dirpath, exist_ok=True)
            with open(filepath, "w") as f:
                f.write(code.strip())
            print(f"  Written: {filepath}")
    else:
        print("  No file blocks found in response, saving raw output for review")
        with open(f"docs/fases/output_{PHASE_FILE}", "w") as f:
            f.write(ai_code)

    print("\nTesting frontend build (Vercel)...")
    build_result = subprocess.run(
        ["npm", "run", "build"],
        capture_output=True, text=True, timeout=300
    )

    if build_result.returncode == 0:
        print("Frontend build: GREEN")
        print("Testing backend (Fly.io)...")
        backend_result = subprocess.run(
            ["python", "-c", "import sys; sys.path.insert(0, 'backend'); import main; print('Backend OK')"],
            capture_output=True, text=True, timeout=60,
            cwd="."
        )
        if backend_result.returncode == 0:
            print("Backend check: GREEN")
            print(f"\n=== LOOP GREEN on attempt {attempt} ===")
            sys.exit(0)
        else:
            error_context = f"Backend error:\n{backend_result.stderr}\n{backend_result.stdout}"
            print(f"Backend check: RED\n{error_context}")
    else:
        error_context = f"Frontend build error:\n{build_result.stderr}\n{build_result.stdout}"
        print(f"Frontend build: RED")
        print(error_context[:2000])

    if attempt < MAX_ATTEMPTS:
        print(f"Retrying in 5s...")
        time.sleep(5)

print(f"\n=== FAILED after {MAX_ATTEMPTS} attempts ===")
sys.exit(1)
