# Contexto de Emergência: Clip Pro (Falhas de Comunicação)

O sistema atual está inoperante. O frontend (Vercel) e o backend (Fly.io) não conseguem se comunicar, travando a geração de clipes e o dashboard.

**URL de Produção:** https://clippost-silk.vercel.app
**Backend:** https://clippost-backend.fly.dev

## Objetivo Imediato

Corrigir as causas raiz dos erros de CORS, 500 e 422 apontados no console do navegador. NÃO criar funcionalidades novas — apenas religar os cabos quebrados.

## Tarefas de Correção Obrigatórias

### 1. Alinhamento do Payload (Erro 422 em /api/jobs)

Compare o JSON que o frontend (Next.js) envia no POST para `/api/jobs` com o schema Pydantic do FastAPI. Sincronize os campos (`url`, `user_id`, `clip_duration`) no arquivo onde o fetch é feito para que o backend aceite a requisição e o YouTube possa ser processado.

**Arquivos a verificar:**
- Frontend: qualquer arquivo que faça `fetch('/api/jobs')` ou `fetch('...clippost-backend.fly.dev/api/jobs')`
- Backend: `app/routers/jobs.py` ou equivalente — o schema Pydantic do endpoint POST

**Ação:** Alinhar os campos enviados com os campos esperados. Se o backend espera `video_url` e o frontend manda `url`, corrija um dos dois.

### 2. Tratamento de Dados Vazios (Erros 500 gerando CORS)

Verifique os endpoints GET:
- `/api/scheduled-posts/{user_id}`
- `/api/billing/status`

Se o Supabase não encontrar dados para um usuário recém-criado, o backend DEVE interceptar com `try/except` e retornar JSON vazio `[]` ou `{}` com Status 200. **Nunca** deixar propagar um erro 500.

**Padrão obrigatório:**
```python
try:
    result = supabase.table(...).select(...).eq(...).execute()
    return result.data or []
except Exception:
    return []
```

### 3. Blindagem do CORS (FastAPI)

Assegure que o `CORSMiddleware` no `main.py` inclua:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://clippost-silk.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Critério de Aprovação (Loop Gate)

1. Ao colar um link do YouTube na interface, a requisição deve retornar **Status 200**, iniciando o processamento.
2. O console do navegador deve estar **limpo de erros CORS** ao navegar pelas abas do Dashboard.
3. Os endpoints `/api/scheduled-posts/{user_id}` e `/api/billing/status` devem retornar **200** mesmo para usuários sem dados.
