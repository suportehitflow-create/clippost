# Contexto: Clip Pro - Fase 5 (Integração Social e Postagem em Massa)

## 1. Conexão Meta e UI de Calendário
- `/dashboard/settings`: cadastrar Page Access Token e Instagram Account ID
- Painel de Agendamento em Massa: lista clipes processados, define data/hora e caption para cada

## 2. Postagem e Worker (Celery Beat)
- `social_publisher.py`: Instagram Graph API para Reels (upload URL pública Supabase)
- Celery Beat: varre `scheduled_posts` por pendentes, publica, grava logs de erro
- UI não quebra caso usuário sem contas configuradas

## Critério de Aprovação (Loop Gate)
UI de agendamento não quebra sem contas configuradas. Celery Beat inicia no Fly.io sem erros de sintaxe.

## STATUS
✅ CONCLUÍDA
