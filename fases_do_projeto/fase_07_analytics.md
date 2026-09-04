# Contexto: Clip Pro - Fase 7 (Painel de Analytics)

Fase final para o usuário acompanhar a performance. O dashboard visual exibirá os dados e o status das publicações.

## 1. Rota de Dados (backend/api/routes/analytics.py → backend/main.py)

Crie o endpoint `GET /api/analytics/{user_id}`.

Ele deve consultar o Supabase e agregar dados:
- Total de vídeos minerados (da tabela `projects`)
- Total de clipes gerados (`clips`)
- Histórico de posts com sucesso/falha (`scheduled_posts`)
- Atividade dos últimos 7 dias (contagem por dia)

## 2. Dashboard Visual (src/app/(dashboard)/dashboard/page.tsx)

Enriqueça o dashboard com cards de estatísticas:
- "Clipes Gerados" (total)
- "Agendamentos Pendentes" (scheduled_posts WHERE status='pending')
- "Taxa de Sucesso" (published / (published + failed) * 100)
- Tabela ou gráfico de barras com a atividade dos últimos 7 dias

Use os componentes shadcn/ui disponíveis (Card, Badge, Table).

## Critério de Aprovação (Loop Gate)
O frontend deve passar no Preview Deploy da Vercel sem telas brancas ou erros de servidor (Status 200).

## STATUS
🔄 PENDENTE
