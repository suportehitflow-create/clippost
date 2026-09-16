-- 1. Criação da tabela de templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    layout TEXT NOT NULL DEFAULT 'single_speaker', -- 'single_speaker', 'split_screen', 'screen_share'
    layout_type TEXT DEFAULT 'single_speaker',
    subtitle_preset TEXT NOT NULL DEFAULT 'hormozi_yellow', -- 'hormozi_yellow', 'neon', 'clean_box', 'minimal'
    font_family TEXT DEFAULT 'Arial Black',
    highlight_color TEXT DEFAULT '#FFE600',
    show_username BOOLEAN DEFAULT false,
    username TEXT,
    avatar_url TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitação de RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own templates" ON templates;
CREATE POLICY "Users manage own templates" ON templates
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Inserção de template padrão para usuários existentes
INSERT INTO templates (user_id, name, layout, layout_type, subtitle_preset, is_default)
SELECT id, 'Padrão Viral', 'single_speaker', 'single_speaker', 'hormozi_yellow', true
FROM auth.users
ON CONFLICT DO NOTHING;

-- 4. Suporte a transcrição editada e template nos clipes
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS transcript_override jsonb,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtitle_preset text DEFAULT 'hormozi_yellow',
  ADD COLUMN IF NOT EXISTS highlight_color text DEFAULT '#FFE600';
