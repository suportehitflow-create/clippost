# Contexto: Clip Pro - Fase 3 (Curadoria de Ganchos e Recorte Vertical)

Agora conectaremos a inteligência semântica e o corte automático. O backend deve isolar os momentos de alto engajamento da transcrição e gerar vídeos no formato 9:16.

## 1. Curadoria IA (backend/services/ai_curator.py)

Crie a função `get_viral_clips(transcript_data)` usando a API da Anthropic (claude-haiku-4-5-20251001).

Envie um prompt que exija a identificação de 3 cortes entre 30s e 60s, focados em ganchos fortes, conflito ou curiosidade. O retorno DEVE ser um JSON estrito com `start_time`, `end_time`, `hook_title` e `ai_score`.

## 2. Motor FFmpeg (backend/services/ffmpeg_engine.py)

Crie a função `create_vertical_clip()` usando `ffmpeg-python`.

Corte o vídeo original nos tempos definidos pela IA.

Aplique um filtro de crop centralizado para 9:16 (`crop=ih*9/16:ih`).

## 3. Atualização do Worker (backend/workers/tasks.py)

Após salvar o projeto (Fase 2), passe a transcrição para o `ai_curator.py`.

Itere sobre os cortes, aplique o `create_vertical_clip()` em cada um, faça upload para o Supabase Storage e salve os registros na tabela `clips`.

## Critério de Aprovação (Loop Gate)
Sem chaves hardcoded. O backend deve reiniciar no Fly.io sem falhas de importação ou execução.

## STATUS
✅ CONCLUÍDA
