# Contexto: Clip Pro - Fase 3 (Curação de Vídeo IA e Ganchos Virais)

## 1. Agente Curador (Claude API)
- Serviço `ai_curator.py` enviando transcrição para Claude Haiku
- Prompt: ignorar introduções inúteis ("Oi galera..."), focar em perguntas+respostas diretas, polêmicas, ganchos
- Retorno JSON estrito: `start_time`, `end_time`, `viral_score`, `hook_title` (título magnético criado pela IA)
- Cortes classificados: 30s, 60s, ou duração lógica

## 2. Interface de Configuração (Frontend)
- Seletores no painel: "Cortes de 30s", "Cortes de 60s", "Automático (IA decide)"
- Enviado no payload do `/api/process-url`

## Critério de Aprovação (Loop Gate)
Backend consome Claude API, registra timestamps na tabela `clips` sem erros de JSON.

## STATUS
✅ CONCLUÍDA (Claude Haiku); 🔄 Seletor de duração no frontend pendente
