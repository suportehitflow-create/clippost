# Contexto: Clip Pro - Fase 1 (Autenticação e Esquema de Banco de Dados)

Inicie a construção do ecossistema Clip Pro. A arquitetura exige Next.js 15 (App Router) para o frontend e Supabase para Auth e PostgreSQL. Nenhuma senha ou URL de banco de dados deve ser exposta no código; utilize estritamente variáveis de ambiente.

Implemente as 3 etapas abaixo com código funcional e retorne os arquivos atualizados:

## 1. Banco de Dados (Supabase - SQL)
Crie o script SQL para as tabelas essenciais. Apenas forneça o código para execução no painel:

- users: Gerenciado pelo Supabase Auth.
- projects: id, user_id (referência a users), source_url, platform (youtube/instagram), raw_video_url, transcript (jsonb), title, created_at.
- clips: id, project_id, start_time, end_time, ai_score, status, final_video_url, created_at.

Habilite Row Level Security (RLS) para garantir que cada usuário só acesse seus dados.

## 2. Autenticação Frontend (src/app/(auth)/login/page.tsx)

Construa uma tela de login minimalista em Dark Mode usando Tailwind CSS e shadcn/ui.

Integre o @supabase/supabase-js para permitir login via Google OAuth e Email/Senha.

## 3. Roteamento e Proteção (middleware.ts)

Crie um middleware no Next.js que bloqueie o acesso à rota /dashboard para usuários não autenticados, redirecionando-os para /login.

## Critério de Aprovação (Loop Gate)
O comando `npm run build` deve compilar sem erros (Status 0).

## STATUS
✅ CONCLUÍDA
