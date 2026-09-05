# Contexto: Clip Pro - Fase 1 (Infraestrutura, Segurança e CORS)

O objetivo é solidificar as fundações do SaaS e eliminar erros 500, 422 e bloqueios de RLS.

## 1. Segurança de Banco de Dados (Supabase)
- Tabelas: `projects`, `clips`, `brand_kits`, `social_accounts`, `scheduled_posts`, `user_plans`
- RLS em todas as tabelas e buckets (`videos`, `avatars`, `templates`)
- Políticas: `auth.uid() = user_id` para SELECT, INSERT, UPDATE, DELETE
- Regra Absoluta: NUNCA expor chaves. `os.environ.get('SUPABASE_KEY')` no Python, `process.env` no Next.js

## 2. Fallbacks e CORS (FastAPI no Fly.io)
- CORSMiddleware aceitar `https://clippost-silk.vercel.app` com `allow_credentials=True`
- Todas as rotas GET com `try/except`: retornar `[]` ou `{}` com Status 200 em caso de erro
- Nunca retornar 500 para o frontend

## Critério de Aprovação (Loop Gate)
GET nas rotas da API → Status 200 sem erro de CORS. Console da Vercel sem falhas de build.

## STATUS
✅ CONCLUÍDA (CORS + try/except implementados)
