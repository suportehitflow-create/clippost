# Contexto: Clip Pro - Fase 4 (Motor de Edição em Massa e Brand Kit)

Os tempos de corte já são gerados pela IA. Agora, o sistema deve renderizar os clipes com a identidade visual completa do usuário e truques de retenção.

## 1. O Brand Kit (Frontend)

* Crie a interface onde o usuário define: Foto de perfil, `@username` e faz o upload de um Template de Fundo personalizado.
* O usuário deve poder escolher a posição (coordenadas X e Y) do vídeo dentro do canvas 9:16.

## 2. O Motor de Renderização (FFmpeg no Backend)

Atualize a engine no Python para usar `filter_complex`. A renderização de cada clipe deve aplicar sequencialmente:

* **Crop e Posicionamento:** Recortar o vídeo para 9:16 e inseri-lo sobre o Template de Fundo nas coordenadas salvas no Supabase.
* **Overlays:** Adicionar o Avatar e o Username via `drawtext`. Adicionar o `hook_title` gerado pela IA no topo.
* **Retenção:** Espelhamento horizontal do vídeo base (`hflip`) e remoção de silêncios do áudio (`silenceremove`).
* **Legendas Dinâmicas:** Converter o JSON da transcrição em um arquivo `.ass` temporário. Queimar a legenda no centro do vídeo (fonte impactante, amarela, borda preta grossa).

## Critério de Aprovação (Loop Gate)

O Celery deve conseguir rodar o comando complexo do FFmpeg para um clipe e fazer o upload do `.mp4` final para o Supabase Storage sem estourar a memória.
