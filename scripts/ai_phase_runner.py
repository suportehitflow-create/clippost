import os
import subprocess
import time
import sys
import re

API_KEY = os.environ["EXPLABS_API_KEY"]
BASE_URL = "https://api.experientiallabs.ai/v1"
MODEL = "claude-sonnet-5"
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "5"))

# Modo: "all" roda todas as fases em sequência; qualquer outro valor roda só aquela fase
INPUT_PHASE = os.environ.get("INPUT_PHASE_FILE", "fase_06_monetizacao.md")

# Ordem canônica das fases
ALL_PHASES = [
    "fase_01_infra_seguranca_banco.md",
    "fase_02_mineracao_youtube_instagram.md",
    "fase_03_cerebro_ia_cortes.md",
    "fase_04_motor_edicao_brand_kit.md",
    "fase_05_agendamento_distribuicao.md",
    "fase_06_monetizacao.md",
    "fase_07_agente_conteudo.md",
]

if INPUT_PHASE.strip().lower() == "all":
    phases_to_run = ALL_PHASES
else:
    phases_to_run = [INPUT_PHASE.strip()]

from openai import OpenAI, RateLimitError, APIStatusError
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

cursorrules = ""
if os.path.exists(".cursorrules"):
    with open(".cursorrules") as f:
        cursorrules = f.read()

SYSTEM_PROMPT = f"""Você é um engenheiro de software sênior trabalhando no projeto ClipPost.

REGRAS ABSOLUTAS (nunca viole):
{cursorrules}

ESTRUTURA DO PROJETO (OBRIGATÓRIO):
- Frontend Next.js 15 App Router: arquivos em src/app/ (NÃO em frontend/app/ ou app/)
- Backend FastAPI: arquivos em backend/
- Componentes React: src/components/
- Utilitários: src/lib/
- NUNCA importe de @/components/ui/* (shadcn/ui não está instalado)
- NUNCA importe de bibliotecas não listadas no package.json
- Use apenas Tailwind CSS para estilos, sem CSS Modules
- Implemente componentes inline quando precisar de Button, Card etc.
- NUNCA crie arquivo src/middleware.ts (convenção depreciada no Next.js 15; use src/proxy.ts se necessário)
- Em arquivos CSS, coloque @import sempre como PRIMEIRA linha antes de qualquer outra regra

Sua tarefa: implementar exatamente o que está descrito no arquivo de fase.
Retorne APENAS código funcional nos arquivos corretos.
Formato de resposta: para cada arquivo, use blocos ```filepath:caminho/do/arquivo``` seguido do código completo.
NÃO explique, NÃO use markdown além dos blocos de código, NÃO invente funcionalidades extras."""


def call_ai(phase_content, error_context=""):
    if error_context:
        user_msg = f"A implementação anterior quebrou com este erro:\n\n{error_context}\n\nCorrijae implemente novamente:\n\n{phase_content}"
    else:
        user_msg = f"Implemente a seguinte fase:\n\n{phase_content}"

    backoff = 60
    for api_try in range(5):
        try:
            print(f"  API call tentativa {api_try+1}/5...")
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=8096,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg}
                ]
            )
            return response.choices[0].message.content
        except RateLimitError as e:
            print(f"  RateLimitError: {e} — aguardando {backoff}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, 300)
        except APIStatusError as e:
            print(f"  APIStatusError {e.status_code}: {e}")
            if e.status_code == 402 or "credit" in str(e).lower():
                print("ERRO 402: Créditos da API zerados! Pausando pipeline.")
                sys.exit(1)
            if e.status_code in (429, 503, 529):
                print(f"  Aguardando {backoff}s...")
                time.sleep(backoff)
                backoff = min(backoff * 2, 300)
                continue
            raise
        except Exception as e:
            print(f"  Erro inesperado ({type(e).__name__}): {e} — aguardando {backoff}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, 300)
    return None


def write_files(ai_code, phase_file):
    file_blocks = re.findall(r'```filepath:(.+?)\n(.*?)```', ai_code, re.DOTALL)
    if not file_blocks:
        file_blocks = re.findall(r'```[\w./-]*\n#\s*file:\s*(.+?)\n(.*?)```', ai_code, re.DOTALL)

    if file_blocks:
        repo_root = os.path.abspath(".")
        for filepath, code in file_blocks:
            filepath = filepath.strip()
            target = os.path.abspath(filepath)
            if os.path.commonpath([repo_root, target]) != repo_root:
                print(f"  IGNORADO (fora do repo): {filepath}")
                continue
            dirpath = os.path.dirname(target)
            if dirpath:
                os.makedirs(dirpath, exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(code.strip())
            print(f"  Escrito: {filepath}")
    else:
        out = f"docs/fases/output_{phase_file}"
        print(f"  Nenhum bloco de arquivo encontrado, salvando output bruto em {out}")
        with open(out, "w") as f:
            f.write(ai_code)


def test_build():
    print("  Validando sintaxe do backend Python...")
    py = subprocess.run(
        [sys.executable, "-m", "compileall", "-q", "backend"],
        capture_output=True, text=True
    )
    if py.returncode != 0:
        return False, f"Backend Python syntax error:\n{py.stdout}\n{py.stderr}"

    print("  Testando build frontend (npm run build)...")
    try:
        result = subprocess.run(
            ["npm", "run", "build"],
            capture_output=True, text=True, timeout=300
        )
    except subprocess.TimeoutExpired:
        return False, "Frontend build error: npm run build excedeu 300s"
    if result.returncode == 0:
        return True, ""
    return False, f"Frontend build error:\n{result.stderr}\n{result.stdout}"


def run_phase(phase_file):
    phase_path = f"docs/fases/{phase_file}"
    if not os.path.exists(phase_path):
        print(f"  AVISO: {phase_path} não encontrado, pulando.")
        return True  # não falha o pipeline por fase ausente

    with open(phase_path, "r") as f:
        phase_content = f.read()

    print(f"\n{'='*60}")
    print(f"FASE: {phase_file} ({len(phase_content)} chars)")
    print('='*60)

    error_context = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n--- Tentativa {attempt}/{MAX_ATTEMPTS} ---")

        ai_code = call_ai(phase_content, error_context)
        if ai_code is None:
            print("Falha na API após 3 tentativas.")
            return False

        print(f"  Resposta AI recebida ({len(ai_code)} chars)")
        write_files(ai_code, phase_file)

        ok, error = test_build()
        if ok:
            print(f"  BUILD GREEN para {phase_file}")
            return True

        error_context = error
        print(f"  BUILD RED:\n{error[:1500]}")
        if attempt < MAX_ATTEMPTS:
            print(f"  Retrying em 30s...")
            time.sleep(30)

    print(f"FALHOU após {MAX_ATTEMPTS} tentativas: {phase_file}")
    return False


# === EXECUÇÃO PRINCIPAL ===
print(f"\n{'#'*60}")
print(f"AI PHASE RUNNER — modo: {'VARREDURA COMPLETA' if len(phases_to_run) > 1 else phases_to_run[0]}")
print(f"Fases a executar: {len(phases_to_run)}")
print('#'*60)

failed_phases = []
for i, phase in enumerate(phases_to_run, 1):
    print(f"\n[{i}/{len(phases_to_run)}] Iniciando {phase}")
    try:
        success = run_phase(phase)
    except Exception:
        import traceback
        print(f"  EXCECAO NAO TRATADA em {phase}:")
        traceback.print_exc()
        success = False
    if success:
        print(f"[{i}/{len(phases_to_run)}] OK: {phase}")
    else:
        print(f"[{i}/{len(phases_to_run)}] FALHOU: {phase}")
        failed_phases.append(phase)
        if len(phases_to_run) == 1:
            sys.exit(1)

    # Pausa entre fases para evitar rate limit da API
    if i < len(phases_to_run):
        print(f"  Aguardando 60s antes da próxima fase (evitar rate limit)...")
        time.sleep(60)

print(f"\n{'#'*60}")
if failed_phases:
    print(f"VARREDURA CONCLUÍDA COM FALHAS:")
    for p in failed_phases:
        print(f"  X {p}")
    sys.exit(1)
else:
    print(f"VARREDURA COMPLETA: TODAS AS {len(phases_to_run)} FASES VERDES!")
    sys.exit(0)
