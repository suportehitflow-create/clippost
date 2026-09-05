# Contexto: Clip Pro - Fase 6 (Design UI/UX Pro Max e Monetização)

## 1. UI/UX Pro Max (Frontend)
- Fonte: `Inter Tight` (Google Fonts)
- Tipografia: `tracking-[-0.03em]` em cabeçalhos Semi Bold; `tracking-[0.02em]` no corpo
- Glassmorphism nos cards: `bg-white/5` ou `bg-zinc-900/40`, `backdrop-blur-xl`, sombras multicamada
- Botões: bordas arredondadas com destaques internos (profundidade)
- Divisores: `border-white/5` (linhas finas quase invisíveis)
- Cards de vídeo e analytics com glassmorphism

## 2. Checkout Seguro (Stripe)
- `POST /api/billing/checkout`: lê `STRIPE_SECRET_KEY` de variável de ambiente → URL de pagamento
- Webhook: evento `checkout.session.completed` libera "Fila de Processamento em Massa" para Pro
- Fila de Massa: usuários Pro podem enfileirar múltiplos vídeos de uma vez

## Critério de Aprovação (Loop Gate)
Build Next.js na Vercel sem erros. Botão checkout redireciona corretamente.

## STATUS
🔄 UI Glassmorphism pendente; Stripe pendente (aguarda chaves)
