-- 0009_test_user_seed.sql
-- Garante a extensão de criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Cria o usuário de teste na autenticação oficial com e-mail já confirmado
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'teste@clippost.com',
  crypt('TestePassword123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Usuário de Teste"}'
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('TestePassword123!', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now();

-- 2. Garante o perfil associado
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  plan TEXT DEFAULT 'pro',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.profiles (id, email, full_name, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'teste@clippost.com', 'Usuário de Teste', 'pro')
ON CONFLICT (id) DO UPDATE SET plan = 'pro';

-- 3. Garante o plano com créditos liberados
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'pro',
  clips_used_this_month INT DEFAULT 0,
  clips_limit INT DEFAULT 9999,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.user_plans (user_id, plan, clips_used_this_month, clips_limit)
VALUES ('a0000000-0000-0000-0000-000000000001', 'pro', 0, 9999)
ON CONFLICT (user_id) DO UPDATE SET plan = 'pro', clips_limit = 9999;
