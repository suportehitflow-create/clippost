# Contexto: Clip Pro - Fase 6 (Monetização e Gateways)

O sistema gera e agenda os cortes automaticamente. Precisamos integrar o pagamento para o plano "Pro".

## 1. Banco de Dados (Supabase SQL)

```sql
CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  clips_used_this_month int NOT NULL DEFAULT 0,
  period_reset timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own plan" ON user_plans FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_clips_used(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_plans (user_id, clips_used_this_month)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET clips_used_this_month = user_plans.clips_used_this_month + 1,
        updated_at = now();
END;
$$;
```

## 2. Checkout e Webhooks (backend/services/stripe_service.py)

Integre a API do Stripe. Utilize estritamente a variável `STRIPE_SECRET_KEY`.

- `POST /api/billing/checkout` — gera Sessão de Checkout vinculada ao user_id
- `POST /api/billing/webhook` — escuta `checkout.session.completed` e `customer.subscription.updated`
- `GET /api/billing/status/{user_id}` — retorna plan, clips_used, clips_limit
- `GET /api/billing/portal/{user_id}` — URL do portal Stripe

## 3. Guard de uso (backend/tasks.py)

Antes de processar: verificar limite (free = 3 clipes/mês).
Após sucesso: chamar `increment_clips_used(user_id)`.

## 4. Interface (src/app/(dashboard)/billing/page.tsx)

- Badge do plano atual (free/pro)
- Barra de uso: "X de 3 clipes usados"
- Cards comparativos free vs pro
- Botão upgrade → Stripe Checkout
- Link portal Stripe (gerenciar/cancelar)

## Variáveis de ambiente necessárias
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Critério de Aprovação (Loop Gate)
O backend deve subir com as rotas do Stripe ativas e o `npm run build` do frontend deve passar sem erros de tipagem.

## STATUS
✅ CONCLUÍDA
