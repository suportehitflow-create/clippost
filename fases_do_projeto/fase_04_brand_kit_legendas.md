# Contexto: Clip Pro - Fase 4 (Identidade Visual e Edição em Massa)

Os clipes 9:16 brutos já existem. Agora vamos aplicar a identidade do usuário (Brand Kit) e queimar legendas dinâmicas no vídeo, automatizando o trabalho braçal da edição.

## 1. Banco e Dashboard (src/app/(dashboard)/brand-kit/page.tsx)

Crie a tabela `brand_kits` (com SQL incluído nas instruções) contendo `user_id`, `avatar_url`, `username` e `layout_config` (coordenadas X e Y em JSONB).

Crie a interface no Next.js permitindo ao usuário fazer upload de um avatar (salvo no bucket `avatars` do Supabase) e definir o `@username`.

## 2. Gerador de Legendas (backend/services/subtitle_generator.py)

Crie uma função que converta os timestamps do `faster-whisper` em um arquivo temporário `.ass`, formatado com 3 palavras por linha, fonte grande amarela e bordas pretas (estilo viral).

## 3. Motor FFmpeg Avançado (backend/services/ffmpeg_engine.py)

Modifique o pipeline do `ffmpeg-python` para usar `filter_complex`.

Ele deve aplicar o Crop 9:16, sobrepor o Avatar na coordenada X/Y, escrever o `@username` e o Título do Gancho usando `drawtext`, e queimar a legenda (`subtitles=arquivo.ass`).

## Critério de Aprovação (Loop Gate)
O compilador do Next.js deve aprovar o build (`npm run build`) e as chamadas ao FFmpeg não podem conter erros de sintaxe nos filtros de overlay.

## STATUS
✅ CONCLUÍDA
