# Contexto: Clip Pro - Fase 4 (Motor de Edição em Massa e Brand Kit)

## 1. Brand Kit (Frontend)
- Foto de perfil, `@username`, Template de Fundo personalizado
- Posição X/Y do vídeo no canvas 9:16

## 2. Motor de Renderização (FFmpeg com filter_complex)
Cada clipe deve obrigatoriamente aplicar:

### Corte e Posicionamento
- Inserir vídeo redimensionado sobre Template de Fundo 9:16

### Truques de Retenção
- `hflip`: espelhamento horizontal para despistar algoritmo Instagram/TikTok
- `silenceremove`: remoção de silêncios do áudio
- Opção de aceleração leve (1.1x via `setpts=0.909*PTS,atempo=1.1`)

### Overlays
- Avatar e Username via `drawtext`

### Legendas Dinâmicas
- Segmento de transcrição → arquivo `.ass` (fonte grande estilo Hormozi)
- Queimar legenda animada no centro

## Critério de Aprovação (Loop Gate)
Celery roda FFmpeg para múltiplos clipes sequencialmente, faz upload para Supabase sem estourar memória.

## STATUS
✅ CONCLUÍDA (base); 🔄 hflip + silenceremove + speed pendentes
