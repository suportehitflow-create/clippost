-- ==========================================
-- ClipPost Schema
-- ==========================================

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free',
  clips_used_month integer default 0,
  stripe_customer_id text,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles for all using (auth.uid() = id);

-- trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- subscriptions
create table if not exists public.subscriptions (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null,
  plan text not null default 'free',
  billing_interval text check (billing_interval in ('month','year')),
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "subs_self" on public.subscriptions for select using (auth.uid() = user_id);

-- projects (each video import)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  source_type text not null default 'url' check (source_type in ('url','file')),
  source_url text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  error_message text,
  duration_seconds integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
create policy "projects_self" on public.projects for all using (auth.uid() = user_id);

-- clips (generated from a project)
create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  hook text,
  start_time float not null,
  end_time float not null,
  score float default 0,
  storage_url text,
  storage_path text,
  transcript text,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz default now()
);
alter table public.clips enable row level security;
create policy "clips_self" on public.clips for all using (auth.uid() = user_id);

-- scheduled_posts
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  clip_id uuid references public.clips(id) on delete cascade not null,
  platform text not null check (platform in ('tiktok','instagram','youtube_shorts','twitter')),
  scheduled_at timestamptz not null,
  published_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','published','failed')),
  error_message text,
  created_at timestamptz default now()
);
alter table public.scheduled_posts enable row level security;
create policy "schedule_self" on public.scheduled_posts for all using (auth.uid() = user_id);

-- indexes
create index if not exists idx_projects_user on public.projects(user_id);
create index if not exists idx_clips_project on public.clips(project_id);
create index if not exists idx_clips_user on public.clips(user_id);
create index if not exists idx_schedule_user on public.scheduled_posts(user_id);
create index if not exists idx_schedule_at on public.scheduled_posts(scheduled_at);
