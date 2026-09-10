import os, sys, json, subprocess, time, re
import urllib.request, urllib.error

PHASE_FILE = os.environ["PHASE_FILE"]
API_KEY = os.environ["OPENROUTER_API_KEY"]
SLACK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
MAX_ITER = int(os.environ.get("MAX_ITERATIONS", "8"))
FRONTEND_DIR = os.environ.get("FRONTEND_DIR", ".")
BACKEND_DIR = os.environ.get("BACKEND_DIR", "backend")

# Fallback model list — tries next if rate-limited
MODELS = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "thinkingmachines/inkling:free",
]
current_model_idx = 0

with open(PHASE_FILE, "r", encoding="utf-8") as f:
    PHASE = f.read()

RULES = ""
if os.path.exists(".cursorrules"):
    with open(".cursorrules", "r", encoding="utf-8") as f:
        RULES = f.read()

SYSTEM = (
    RULES + "\n\n"
    "You are a senior engineer implementing phases of a SaaS project. "
    "Return ONLY code blocks in this format:\n"
    "FILE: path/to/file\n"
    "```language\ncontent\n```\n"
    "No text outside the blocks."
)

PHASE_NAME = os.path.basename(PHASE_FILE).replace(".md", "")


def slack(msg):
    if not SLACK_URL:
        return
    try:
        payload = json.dumps({"text": msg}).encode()
        req = urllib.request.Request(SLACK_URL, data=payload,
                                     headers={"content-type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def call_ai(messages, attempt=0):
    global current_model_idx
    model = MODELS[current_model_idx]
    msgs_with_system = [{"role": "system", "content": SYSTEM}] + messages
    payload = json.dumps({
        "model": model,
        "max_tokens": 8192,
        "messages": msgs_with_system,
    }).encode()

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "HTTP-Referer": "https://github.com/suportehitflow-create/clippost",
            "X-Title": "ClipPost AI Phase Runner",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
            if "choices" not in data:
                print(f"Unexpected response (no choices): {json.dumps(data)[:500]}")
                # Treat as rate limit — try next model
                if current_model_idx < len(MODELS) - 1:
                    current_model_idx += 1
                    print(f"Switching to {MODELS[current_model_idx]}...")
                    return call_ai(messages, 0)
                raise RuntimeError(f"No choices in response: {data}")
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        code = e.code
        if code == 402:
            msg = f":warning: *ClipPost AI Phase Runner pausado.*\nSaldo OpenRouter esgotado (402). Adicione creditos em openrouter.ai e re-execute a fase `{PHASE_NAME}`."
            slack(msg)
            print("::error::OPENROUTER CREDITS EXHAUSTED (402).")
            sys.exit(2)
        if code == 429 or code >= 500:
            # Try next model if available
            if current_model_idx < len(MODELS) - 1:
                current_model_idx += 1
                print(f"Model {model} rate-limited. Switching to {MODELS[current_model_idx]}...")
                return call_ai(messages, 0)
            wait = min(10 * (2 ** attempt), 120)
            print(f"All models rate-limited. Waiting {wait}s...")
            time.sleep(wait)
            if attempt < 4:
                current_model_idx = 0  # reset to best model
                return call_ai(messages, attempt + 1)
        print(f"HTTP error {code}: {body}")
        sys.exit(1)


def extract_files(text):
    files = {}
    pattern = re.compile(r'FILE:\s*(\S+)\n```[^\n]*\n(.*?)```', re.DOTALL)
    for m in pattern.finditer(text):
        files[m.group(1)] = m.group(2)
    return files


def write_files(files):
    for path, content in files.items():
        dir_ = os.path.dirname(path)
        if dir_:
            os.makedirs(dir_, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  -> wrote: {path}")


def run_tests():
    errors = []
    # Frontend: TypeScript check + build (runs from repo root where package.json is)
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=FRONTEND_DIR)
    if r.returncode != 0:
        errors.append(f"TypeScript:\n{r.stdout}\n{r.stderr}")
    r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True, timeout=300, cwd=FRONTEND_DIR)
    if r.returncode != 0:
        errors.append(f"Next.js build:\n{r.stdout[-3000:]}\n{r.stderr[-2000:]}")
    # Backend: Python syntax check
    for root, _, fnames in os.walk(BACKEND_DIR):
        for fn in fnames:
            if fn.endswith(".py"):
                p = os.path.join(root, fn)
                r = subprocess.run(["python3", "-m", "py_compile", p], capture_output=True, text=True)
                if r.returncode != 0:
                    errors.append(f"Python {p}:\n{r.stderr}")
    return errors


slack(f":rocket: *ClipPost AI Phase Runner iniciado*\nFase: `{PHASE_NAME}` | Modelo: `{MODELS[0]}`")

messages = [{"role": "user", "content": f"Implement this phase:\n\n{PHASE}"}]

for iteration in range(1, MAX_ITER + 1):
    print(f"\n{'='*60}\n  ITERATION {iteration}/{MAX_ITER} | model: {MODELS[current_model_idx]}\n{'='*60}")
    response = call_ai(messages)
    files = extract_files(response)

    if not files:
        print("No FILE: blocks returned. Retrying...")
        messages.append({"role": "assistant", "content": response})
        messages.append({"role": "user", "content": "Return ONLY FILE: blocks as specified."})
        continue

    print(f"Files received: {list(files.keys())}")
    write_files(files)
    errors = run_tests()

    if not errors:
        print("\nALL TESTS PASSED!")
        with open("/tmp/changed_files.txt", "w") as f:
            f.write("\n".join(files.keys()))
        slack(f":white_check_mark: *ClipPost — `{PHASE_NAME}` implementada com sucesso!*\nArquivos modificados: {list(files.keys())}\nAcesse: https://clippost-silk.vercel.app")
        sys.exit(0)

    combined = "\n\n".join(errors)
    print(f"\nErrors:\n{combined[:2000]}")
    messages.append({"role": "assistant", "content": response})
    messages.append({"role": "user", "content": f"Tests failed. Fix only these errors:\n\n{combined}"})

slack(f":x: *ClipPost AI Phase Runner falhou*\nFase `{PHASE_NAME}` atingiu o limite de {MAX_ITER} iteracoes sem sucesso.\nVerifique os logs: https://github.com/suportehitflow-create/clippost/actions")
print(f"\nLimit of {MAX_ITER} iterations reached.")
sys.exit(1)
