-- 0008_storage_videos_rls.sql
-- Desbloqueio e políticas de RLS para o bucket de vídeos no Supabase Storage

-- 1. Garante que o bucket 'videos' exista e seja público para leitura
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permite que qualquer usuário autenticado faça upload (INSERT) no bucket 'videos'
DROP POLICY IF EXISTS "Allow authenticated uploads to videos" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to videos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'videos');

-- 3. Permite a leitura pública dos vídeos gerados (SELECT)
DROP POLICY IF EXISTS "Allow public read access to videos" ON storage.objects;
CREATE POLICY "Allow public read access to videos" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'videos');

-- 4. Permite que o usuário autenticado atualize arquivos no bucket 'videos'
DROP POLICY IF EXISTS "Allow users to update own videos" ON storage.objects;
CREATE POLICY "Allow users to update own videos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'videos');

-- 5. Permite que o usuário autenticado delete arquivos no bucket 'videos'
DROP POLICY IF EXISTS "Allow users to delete own videos" ON storage.objects;
CREATE POLICY "Allow users to delete own videos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'videos');
