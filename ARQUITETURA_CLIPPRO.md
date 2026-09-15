# ARQUITETURA CLIPOST — Constituição do Projeto

Este arquivo é a lei do repositório. Toda geração de código deve respeitá-lo integralmente.
Em caso de conflito com qualquer outra instrução, **este documento prevalece**.

---

## 1. Frontend (Estrutura e Visual)

- **Stack:** Next.js 15 usando estritamente o App Router, no diretório `src/app/`
- **Estilização:** Tailwind CSS puro
- **Deploy:** Vercel

**REGRA DE BLOQUEIO:** É EXPRESSAMENTE PROIBIDO instalar, importar ou utilizar a biblioteca
`shadcn/ui` ou qualquer um de seus componentes. Nunca importe de `@/components/ui/*`.
O projeto usa exclusivamente Tailwind nativo. Quando precisar de Button, Card ou similar,
implemente o componente inline.

**Caminhos obrigatórios:**

| Tipo | Caminho correto | Caminho ERRADO |
|---|---|---|
| Páginas | `src/app/` | ~~`frontend/app/`~~, ~~`app/`~~ |
| Componentes | `src/components/` | ~~`components/`~~ |
| Utilitários | `src/lib/` | ~~`lib/`~~ |

Nunca crie `src/middleware.ts` — convenção depreciada no Next.js 15. Use `src/proxy.ts`.
Em arquivos CSS, `@import` deve ser sempre a primeira linha, antes de qualquer outra regra.
Nunca importe bibliotecas que não estejam no `package.json`.

---

## 2. Backend (Motor e Filas)

- **API Core:** Python FastAPI
- **Processamento assíncrono:** uso obrigatório de **Celery + Redis** para filas e workers
- **Deploy:** Fly.io (app `clippost-backend`)

**REGRA DE BLOQUEIO:** É PROIBIDO substituir Celery por ARQ, RQ, Dramatiq ou qualquer outra
biblioteca de filas. A orquestração existente é Celery e deve permanecer.

Estrutura real do backend (não invente subpastas):

```
backend/
  main.py            rotas FastAPI
  tasks.py           tarefas Celery do pipeline de vídeo
  celery_app.py      configuração do Celery e beat_schedule
  services/          ai_curator, ffmpeg_engine, subtitle_generator,
                     instagram_scraper, social_publisher, stripe_service
  workers/           scheduler_tasks
```

Nunca crie `backend/src/`, `backend/app/` ou `backend/api/routes/`.

---

## 3. Processamento de Vídeo e IA

- **Pipeline base:** FFmpeg, yt-dlp e **faster-whisper rodando localmente**

**REGRA DE BLOQUEIO:** É PROIBIDO sugerir ou implementar a API da OpenAI para transcrições.
A dependência é total no ecossistema local configurado.

**Curadoria de cortes:** `services/ai_curator.py` usa um endpoint compatível com a API da
OpenAI, configurado por variável de ambiente (`AI_CURATOR_BASE_URL`, `AI_CURATOR_MODEL`,
`AI_CURATOR_API_KEY`), apontando por padrão para o Gemini free tier. Não troque essa
configuração por chamada direta a um provedor pago.

---

## 4. Banco de Dados e Autenticação

- **Plataforma:** Supabase — Auth, PostgreSQL e Storage
- **RLS:** deve estar ativada nas tabelas, permitindo operações apenas onde `auth.uid() = user_id`

Nunca renomeie tabelas ou colunas existentes.

---

## 5. Segurança (Tolerância Zero)

NUNCA exponha senhas, tokens de API ou chaves (Supabase, Stripe, Gemini, Fly) diretamente
no código-fonte. O uso de variáveis de ambiente é estritamente obrigatório:

```python
os.environ.get('SUPABASE_KEY')
```

---

## 6. Domínio de Produção

- Frontend: `https://clippost-three.vercel.app`
- Backend: `https://clippost-backend.fly.dev`

Não altere a lista `FRONTEND_ORIGINS` em `backend/main.py` nem o padrão de `FRONTEND_URL`
em `services/stripe_service.py` — são o que mantém o CORS e os redirects do Stripe funcionando.

---

## 7. Marca

O nome da plataforma é **`clipost`**, todo em minúsculas, em textos visíveis ao usuário.
Identificadores técnicos que contêm `clippost` (domínio Vercel, app do Fly, nome do
repositório) **não devem ser alterados**.
