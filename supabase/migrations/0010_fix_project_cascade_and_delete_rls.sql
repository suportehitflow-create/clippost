-- 0010_fix_project_cascade_and_delete_rls.sql
-- Garante integridade referencial com exclusão em cascata e políticas de DELETE

-- 1. Garante que clips sejam apagados automaticamente quando o projeto for apagado
ALTER TABLE public.clips
  DROP CONSTRAINT IF EXISTS clips_project_id_fkey,
  ADD CONSTRAINT clips_project_id_fkey
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE;

-- 2. Garante que posts agendados sejam apagados quando o clipe for apagado
ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT IF EXISTS scheduled_posts_clip_id_fkey,
  ADD CONSTRAINT scheduled_posts_clip_id_fkey
    FOREIGN KEY (clip_id)
    REFERENCES public.clips(id)
    ON DELETE CASCADE;

-- 3. Habilita permissão explícita de DELETE para os usuários nos seus próprios projetos e clipes
DROP POLICY IF EXISTS "projects_delete_self" ON public.projects;
CREATE POLICY "projects_delete_self" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clips_delete_self" ON public.clips;
CREATE POLICY "clips_delete_self" ON public.clips
  FOR DELETE USING (auth.uid() = user_id);
