-- 0009_test_user_seed.sql
-- Criação ou confirmação imediata da conta de teste (sem requerer confirmação de e-mail)

-- 1. Insere ou confirma o usuário no schema interno auth.users
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
)
VALUES (
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
)
ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('TestePassword123!', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now();

-- 2. Garante perfil correspondente na tabela profiles
INSERT INTO public.profiles (id, email, full_name, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'teste@clippost.com', 'Usuário de Teste', 'pro')
ON CONFLICT (id) DO UPDATE SET plan = 'pro';

-- 3. Garante user_plans como pro com limite alto de clipes
INSERT INTO public.user_plans (user_id, plan, clips_used_this_month, clips_limit)
VALUES ('a0000000-0000-0000-0000-000000000001', 'pro', 0, 9999)
ON CONFLICT (user_id) DO UPDATE SET plan = 'pro', clips_limit = 9999;
