# Contexto: Clip Pro - Fase 6 (Overhaul Visual Pro Max e Monetização)

O site é funcional, mas esteticamente básico. O objetivo é aplicar a identidade de alta conversão (Silicon Valley) e plugar o gateway de pagamentos.

## 1. UI/UX Pro Max (Frontend)

* **Tipografia:** Importe a fonte `Inter Tight`. Aplique tracking negativo (`tracking-[-0.03em]`) nos títulos e `tracking-[0.02em]` no corpo do texto.
* **Glassmorphism:** Remova bordas sólidas (`border`). Use fundos translúcidos (`bg-white/5` ou `bg-zinc-900/40`), desfoque (`backdrop-blur-xl`) e box-shadows em múltiplas camadas nos cartões.
* **Botões:** Arredondamento suave (`rounded-full`) com destaque interno (inner shadow) para dar profundidade. Divisores devem ser imperceptíveis (`border-white/5`).

## 2. Checkout Seguro (Stripe)

* O endpoint `/api/checkout` deve ler a `STRIPE_SECRET_KEY` via variável de ambiente para gerar a sessão de pagamento.
* Crie o webhook para escutar a confirmação de pagamento e liberar o limite de processamento em massa do usuário no Supabase.

## Critério de Aprovação (Loop Gate)

O build do Next.js deve compilar sem classes Tailwind quebradas e o botão de assinatura deve gerar a URL do Stripe com sucesso.
