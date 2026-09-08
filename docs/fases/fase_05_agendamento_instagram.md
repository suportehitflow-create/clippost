# Contexto: Clip Pro - Fase 5 (Integração Social e Postagem Automática)

Com os vídeos editados no bucket, o usuário deve conseguir distribuí-los automaticamente via Meta Graph API.

## 1. Conexão Meta e UI de Calendário

* Em `/dashboard/settings`, permita o cadastro e salvamento do `Page Access Token` e `Instagram Account ID` no banco de dados.
* Crie a tela de Agendamento listando os clipes disponíveis e permitindo definir data/hora e legenda (caption) para cada postagem.

## 2. Postagem (Celery Beat)

* Desenvolva o módulo para conversar com a Graph API (upload de Reels usando a URL pública do Supabase).
* Configure uma task agendada (Beat) rodando a cada minuto para varrer a tabela `scheduled_posts`. Publique os posts na hora exata e atualize o status no banco.

## Critério de Aprovação (Loop Gate)

A interface de agendamento não deve crachar (Erro 500) caso o usuário não tenha contas conectadas. O worker do Celery Beat deve inicializar sem erros de sintaxe no servidor.
