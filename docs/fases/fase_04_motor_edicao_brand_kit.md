# Fase 4 — Motor de Edição e Brand Kit

**Objetivo:** Renderizar os vídeos em massa aplicando a identidade visual do usuário (Brand Kit) e queimar legendas dinâmicas estilo viral.

## 1. O Brand Kit (Frontend)

* Crie a interface no Next.js onde o usuário faz o upload de uma Foto de Perfil, digita o @username e escolhe as coordenadas (X, Y) de onde esses elementos devem aparecer no vídeo vertical.
* Salve as configurações do layout na tabela `brand_kits` do Supabase.

## 2. O Motor de Renderização (FFmpeg Backend)

Atualize a lógica do Python no Fly.io para utilizar o `filter_complex` do FFmpeg.

A renderização deve aplicar as seguintes camadas sequenciais:

1. **Recorte inteligente para 9:16** (centralizado na tela).
2. **Sobreposição da imagem do Avatar** e do texto do Username nas coordenadas exatas salvas no Supabase.
3. **Inserção do hook_title** (o título chamativo do gancho gerado pela IA) no topo do vídeo.
4. **Legendas Dinâmicas:** Pegue a transcrição local do `faster-whisper`, gere um arquivo temporário `.ass` e queime a legenda no centro do vídeo usando fonte grande, amarela e com borda preta grossa.

## Critério de Sucesso (Portão)

O comando de compilação da Vercel deve passar sem erros, e o script FFmpeg no Fly.io deve renderizar um vídeo final (`.mp4`) esteticamente pronto com as legendas e o Brand Kit sem apresentar erros de sintaxe no parâmetro `filter_complex`.
