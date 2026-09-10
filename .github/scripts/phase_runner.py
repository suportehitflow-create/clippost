import os, sys, json, subprocess, time, re
import urllib.request, urllib.error

PHASE_FILE = os.environ["PHASE_FILE"]
API_KEY = os.environ["ANTHROPIC_API_KEY"]
MAX_ITER = int(os.environ.get("MAX_ITERATIONS", "8"))

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


def call_claude(messages, attempt=0):
    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 8192,
        "system": SYSTEM,
        "messages": messages,
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())["content"][0]["text"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        code = e.code
        if code == 402:
            print("::error::ANTHROPIC CREDITS EXHAUSTED (402). Add credits at console.anthropic.com and re-run.")
            sys.exit(2)
        if code == 429 or code >= 500:
            wait = min(10 * (2 ** attempt), 120)
            print(f"Rate limit/server error {code}. Waiting {wait}s...")
            time.sleep(wait)
            if attempt < 6:
                return call_claude(messages, attempt + 1)
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
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True)
    if r.returncode != 0:
        errors.append(f"TypeScript:\n{r.stdout}\n{r.stderr}")
    r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        errors.append(f"Next.js build:\n{r.stdout[-3000:]}\n{r.stderr[-2000:]}")
    for root, _, fnames in os.walk("backend"):
        for fn in fnames:
            if fn.endswith(".py"):
                p = os.path.join(root, fn)
                r = subprocess.run(["python3", "-m", "py_compile", p], capture_output=True, text=True)
                if r.returncode != 0:
                    errors.append(f"Python {p}:\n{r.stderr}")
    return errors


messages = [{"role": "user", "content": f"Implement this phase:\n\n{PHASE}"}]

for iteration in range(1, MAX_ITER + 1):
    print(f"\n{'='*60}\n  ITERATION {iteration}/{MAX_ITER}\n{'='*60}")
    response = call_claude(messages)
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
        sys.exit(0)

    combined = "\n\n".join(errors)
    print(f"\nErrors:\n{combined[:2000]}")
    messages.append({"role": "assistant", "content": response})
    messages.append({"role": "user", "content": f"Tests failed. Fix only these errors:\n\n{combined}"})

print(f"\nLimit of {MAX_ITER} iterations reached.")
sys.exit(1)
