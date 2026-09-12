# Fase 06: Monetização e Stripe

## Objetivo
Integrar o gateway de pagamento Stripe para liberar o plano Pro.

## Backend
- Crie a rota de checkout (`/api/checkout`) no FastAPI.
- Crie o webhook (`/api/webhooks/stripe`) para atualizar a coluna de créditos do usuário no Supabase após a confirmação do pagamento.

## Frontend
- Crie a tela em `/dashboard/billing` com o botão de assinatura conectado ao checkout.

## Critério de Fim (Loop Green)
O código frontend deve compilar sem erros de sintaxe (Vercel) e o backend deve iniciar perfeitamente (Fly.io).
