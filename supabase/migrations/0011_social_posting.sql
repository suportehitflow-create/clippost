-- 0011_social_posting.sql
-- Tabela de contas sociais conectadas por usuário + campos de auto-post

-- social_accounts: cada linha = uma conta conectada (Instagram, Facebook, TikTok, YouTube)
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('instagram','facebook','tiktok','youtube','youtube_shorts')),
  account_id      text NOT NULL,
  username        text,
  display_name    text,
  avatar_url      text,
  access_token    text,
  page_token      text,
  expires_at      timestamptz,
  template_config jsonb,
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_accounts_self" ON public.social_accounts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON public.social_accounts(user_id);

-- Adicionar campos ao profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_publish boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL;

-- Adicionar campos faltantes ao scheduled_posts
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL;

-- Ampliar check de plataforma para incluir facebook
ALTER TABLE public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_platform_check;
ALTER TABLE public.scheduled_posts ADD CONSTRAINT scheduled_posts_platform_check
  CHECK (platform IN ('tiktok','instagram','facebook','youtube_shorts','twitter'));