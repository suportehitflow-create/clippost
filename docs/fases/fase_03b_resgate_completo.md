# Resgate Definitivo do Clip Pro

Você é um Arquiteto Full-Stack Senior. O SaaS (Frontend Next.js na Vercel e Backend FastAPI no Fly.io) está sofrendo com erros de comunicação e interface genérica. Você tem total permissão para analisar, refatorar e aplicar as mudanças abaixo em toda a base de código.

**Frontend:** https://clippost-silk.vercel.app (Next.js 15, App Router, Tailwind, shadcn/ui)
**Backend:** https://clippost-backend.fly.dev (FastAPI, Celery, Redis, Supabase)

## MISSAO 1: Erradicar o Erro 422 e Falhas de Comunicacao

O frontend recebe 422 Unprocessable Content ao enviar links do YouTube para POST /api/jobs.

### 1.1 Alinhar Payload Frontend x Backend

- Analise o fetch/axios no componente que envia o link do YouTube
- Compare com o modelo Pydantic no backend (main.py ou routers/jobs.py)
- Sincronize perfeitamente: se o backend exige `url`, `user_id` e `clip_duration`, o frontend deve enviar exatamente essas chaves com os tipos corretos

### 1.2 Blindagem do CORS

Assegure que o CORSMiddleware no main.py do backend inclua:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://clippost-silk.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 1.3 Protecao contra Erro 500 em GETs

Em todas as rotas GET que buscam dados no Supabase, adicione try/except:

```python
try:
    result = supabase.table(...).select(...).eq(...).execute()
    return result.data or []
except Exception:
    return []
```

Rotas prioritarias: `/api/scheduled-posts/{user_id}` e `/api/billing/status`

## MISSAO 2: Overhaul Estetico UI/UX Pro Max

### 2.1 Tipografia

Importe e aplique a fonte Inter Tight globalmente via `next/font/google`:
- Titulos: `tracking-[-0.03em]`
- Textos: `tracking-[0.02em]`

### 2.2 Glassmorphism nos Cards

Substitua bordas solidas e fundos opacos por:
- Fundo translucido: `bg-white/5` ou `bg-zinc-900/40`
- Desfoque intenso: `backdrop-blur-xl`
- Box-shadow em multiplas camadas nos cartoes

### 2.3 Botoes

Refatore os botoes principais (componentes shadcn):
- Cantos totalmente arredondados: `rounded-full`
- Remover cores chapadas
- Brilho interno sutil: `shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]`

## REGRA ABSOLUTA DE SEGURANCA

Em nenhuma hipotese exponha chaves do Supabase, Stripe ou qualquer API no codigo. Use exclusivamente variaveis de ambiente (`process.env.NOME` no frontend, `os.environ.get('NOME')` no backend).

## Criterio de Aprovacao

1. POST /api/jobs com link do YouTube retorna Status 200
2. Console do navegador sem erros CORS
3. GETs retornam 200 mesmo para usuarios sem dados
4. Interface com Glassmorphism e fonte Inter Tight aplicada
