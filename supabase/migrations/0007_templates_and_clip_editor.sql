-- 0007_templates_and_clip_editor.sql
-- Nível Global: Tabela de templates de vídeo e automação
CREATE TABLE IF NOT EXISTS public.templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  layout_type     text NOT NULL DEFAULT 'full_speaker', -- 'split_screen', 'full_speaker', 'screen_react'
  subtitle_preset text NOT NULL DEFAULT 'hormozi_yellow', -- 'hormozi_yellow', 'neon_glow', 'clean_box', 'minimal_apple'
  font_family     text DEFAULT 'Arial Black',
  highlight_color text DEFAULT '#FFE600',
  show_username   boolean DEFAULT true,
  username        text,
  avatar_url      text,
  config          jsonb DEFAULT '{}'::jsonb,
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_self" ON public.templates;
CREATE POLICY "templates_self" ON public.templates
  FOR ALL USING (auth.uid() = user_id);

-- Nível Individual: Suporte a transcrição editada e template nos clipes
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS transcript_override jsonb,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtitle_preset text DEFAULT 'hormozi_yellow',
  ADD COLUMN IF NOT EXISTS highlight_color text DEFAULT '#FFE600';
