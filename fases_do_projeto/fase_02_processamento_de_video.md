# Contexto: Clip Pro - Fase 2 (Mineração e Transcrição Local)

A fundação do backend pesado. Você deve usar Python com FastAPI, filas assíncronas com Celery e Redis, hospedados no Fly.io.

**Regra Absoluta:** É expressamente proibido usar a API da OpenAI para transcrição. Utilize a biblioteca `faster-whisper` rodando localmente no servidor para zerar os custos de API.

## 1. Configuração do Worker (backend/workers/tasks.py)

Crie a task Celery `process_youtube_video(url: str, user_id: str)`.

Use a biblioteca `yt-dlp` para baixar o vídeo na melhor qualidade MP4.

Faça o upload do vídeo original para o Supabase Storage (bucket: `videos`).

## 2. Motor de Transcrição (backend/services/transcriber.py)

Extraia o áudio do vídeo original usando `ffmpeg-python`.

Rode o `faster-whisper` no arquivo de áudio para gerar um JSON detalhado com as palavras e timestamps (tempo de início e fim).

## 3. Endpoint REST (backend/api/routes/projects.py)

Crie o endpoint `POST /api/process-url` que recebe o link e dispara a task do Celery.

Ao final da transcrição, a task deve fazer um INSERT na tabela `projects` do Supabase contendo a URL pública do vídeo e o JSON da transcrição.

## Critério de Aprovação (Loop Gate)
O script Python deve iniciar sem erros de sintaxe (Status 0) e as importações do `faster-whisper`, `yt-dlp` e `ffmpeg` devem ser validadas no `requirements.txt`.

## STATUS
✅ CONCLUÍDA
