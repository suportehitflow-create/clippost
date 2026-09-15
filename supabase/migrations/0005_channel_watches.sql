-- Canal AutoPilot: monitora canais do YouTube e gera clipes sozinho.
-- O monitoramento roda no Celery Beat que já existe, sem infraestrutura nova.

create table if not exists public.channel_watches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete cascade not null,
  channel_id        text not null,                 -- UC...
  channel_handle    text,                          -- @handle digitado pelo usuário
  channel_name      text,
  -- Vídeo mais recente quando o watch foi criado: só processa o que vier depois,
  -- senão ao cadastrar um canal o sistema clipava o vídeo antigo do topo do feed.
  baseline_video_id text,
  baseline_date     timestamptz not null default now(),
  clip_duration     text not null default 'auto' check (clip_duration in ('30','60','auto')),
  num_clips         integer not null default 3,
  is_active         boolean not null default true,
  last_checked_at   timestamptz,
  last_error        text,
  created_at        timestamptz default now(),
  unique (user_id, channel_id)
);

alter table public.channel_watches enable row level security;
create policy "channel_watches_self" on public.channel_watches
  for all using (auth.uid() = user_id);

-- Histórico de vídeos já processados: a chave primária composta impede que o
-- mesmo vídeo vire dois projetos se o feed repetir ou o beat rodar em paralelo.
create table if not exists public.autopilot_processed (
  user_id    uuid references public.profiles(id) on delete cascade not null,
  video_id   text not null,
  watch_id   uuid references public.channel_watches(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now(),
  primary key (user_id, video_id)
);

alter table public.autopilot_processed enable row level security;
create policy "autopilot_processed_self" on public.autopilot_processed
  for all using (auth.uid() = user_id);

create index if not exists idx_channel_watches_ativos
  on public.channel_watches (is_active, last_checked_at);
