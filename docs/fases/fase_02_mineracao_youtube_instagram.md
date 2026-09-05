# Contexto: Clip Pro - Fase 2 (Motores de Mineração Multiplataforma)

## 1. Motor YouTube (Backend)
- Task Celery com `yt-dlp` (melhor qualidade MP4) → Supabase Storage
- `faster-whisper` LOCAL para transcrição JSON com timestamps palavra por palavra
- PROIBIDO usar API da OpenAI para transcrição

## 2. Motor Instagram (Preparação de Scraping)
- Rota FastAPI aceita `@username` ou link do Instagram
- `yt-dlp` para listar/baixar vídeos do perfil público
- Ordenação por "Mais Recentes" ou "Mais Visualizações"
- Rota: `POST /api/process-url` com campo `platform: "instagram"|"youtube"`

## Critério de Aprovação (Loop Gate)
`/api/jobs` processa link YouTube, faz transcrição local, salva no banco → Status 200 sem falhas Celery.

## STATUS
✅ CONCLUÍDA (YouTube); 🔄 Instagram scraping pendente
