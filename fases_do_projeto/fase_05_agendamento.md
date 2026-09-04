# Contexto: Clip Pro - Fase 5 (Motor de Agendamento e Integração Social)

## Objetivo
Criar a conexão com o Instagram e estruturar a postagem automática do conteúdo gerado.

## 1. Banco de Dados (Supabase SQL)

```sql
CREATE TABLE IF NOT EXISTS social_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform     text NOT NULL DEFAULT 'instagram',
  access_token text NOT NULL,
  account_id   text NOT NULL,
  username     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own social accounts" ON social_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id           uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  social_account_id uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  caption           text,
  scheduled_time    timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
  error_log         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scheduled posts" ON scheduled_posts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## 2. Publisher (backend/services/social_publisher.py)

Integrar Instagram Graph API v19.0 para publicação de Reels:
- Criar container de mídia via `POST /{account_id}/media`
- Polling de status até `FINISHED`
- Publicar via `POST /{account_id}/media_publish`
- Retornar permalink

## 3. Celery Beat (backend/workers/scheduler_tasks.py)

Task `check_and_publish_scheduled_posts` rodando a cada 60s:
- Query `scheduled_posts WHERE status='pending' AND scheduled_time <= now()`
- Chamar `social_publisher.publish_reel()` para cada post
- Atualizar status para `published` ou `failed`

## 4. Frontend (src/app/(dashboard)/schedule/page.tsx)

- Lista de clipes disponíveis (thumbnail + score)
- Formulário: seletor de conta, caption, datetime picker
- Lista de posts agendados com status badges e botão cancelar

## Critério de Aprovação (Loop Gate)
O build do frontend precisa passar e o script do backend deve iniciar sem erros.

## STATUS
✅ CONCLUÍDA
