-- 0012_carousels.sql
-- Carrosséis gerados automaticamente a partir de um link (vídeo/podcast, artigo, site, Instagram) ou texto.
-- Cada linha = um carrossel pronto: os slides (PNG) ficam no armazenamento e a lista vai em "slides".

create table if not exists public.carousels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  project_id  uuid references public.projects(id) on delete cascade,
  title       text,
  caption     text,
  template    text not null default 'principal',
  source_url  text,
  blocos      jsonb,          -- textos do carrossel (texto 1..N)
  slides      jsonb,          -- [{ "url": "...png", "textos": [..] }]
  meta        jsonb,          -- triagem, headlines, espinha dorsal, trecho de origem
  status      text not null default 'ready',
  created_at  timestamptz default now()
);
alter table public.carousels enable row level security;
drop policy if exists "carousels_self" on public.carousels;
create policy "carousels_self" on public.carousels for all using (auth.uid() = user_id);
create index if not exists idx_carousels_user on public.carousels(user_id, created_at desc);
create index if not exists idx_carousels_project on public.carousels(project_id);
