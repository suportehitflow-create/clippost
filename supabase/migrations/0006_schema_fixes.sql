-- 0006_schema_fixes.sql
-- Corrige divergências entre schema.sql e o código em produção.
-- Aplique no SQL Editor do Supabase (Settings → SQL Editor).

-- ── projects: colunas que o tasks.py insere mas o schema não tem ──────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS platform        text,
  ADD COLUMN IF NOT EXISTS raw_video_url   text,
  ADD COLUMN IF NOT EXISTS transcript      jsonb;

-- ── scheduled_posts: caption usada em create_scheduled_post ──────────────
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS caption text;

-- ── brand_kits: tabela usada por /api/brand-kit (não existia no schema) ──
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  avatar_url      text,
  username        text,
  layout_config   jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_kits_self" ON public.brand_kits;
CREATE POLICY "brand_kits_self" ON public.brand_kits
  FOR ALL USING (auth.uid() = user_id);

-- ── user_plans: usada pelo stripe_service e billing routes ───────────────
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id                 uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan                    text NOT NULL DEFAULT 'free',
  clips_used_this_month   integer NOT NULL DEFAULT 0,
  clips_limit             integer NOT NULL DEFAULT 3,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  period_reset            timestamptz,
  updated_at              timestamptz DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_plans_self" ON public.user_plans;
CREATE POLICY "user_plans_self" ON public.user_plans
  FOR ALL USING (auth.uid() = user_id);

-- ── social_accounts: usada por /api/social-accounts (se não existir) ─────
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform     text NOT NULL,
  access_token text,
  account_id   text,
  username     text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, platform)
);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_accounts_self" ON public.social_accounts;
CREATE POLICY "social_accounts_self" ON public.social_accounts
  FOR ALL USING (auth.uid() = user_id);

-- ── RPC: increment_clips_used (chamada pelo stripe_service) ──────────────
CREATE OR REPLACE FUNCTION public.increment_clips_used(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, clips_used_this_month)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET clips_used_this_month = user_plans.clips_used_this_month + 1,
        updated_at = now();
END;
$$;

-- ── clips: coluna ai_score usada em order by score ────────────────────────
-- (score já existe; alias ai_score por compatibilidade)
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS hook_title text;

-- Índice para acelerar lookup de scheduled_posts pendentes
CREATE INDEX IF NOT EXISTS idx_schedule_status
  ON public.scheduled_posts(status, scheduled_at);
