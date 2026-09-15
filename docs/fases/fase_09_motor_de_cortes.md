# MISSÃO: RESTAURAÇÃO DO MOTOR DE CORTES (BACKEND)

Objetivo: Restaurar a lógica do backend (FastAPI/Celery) para que execute o fluxo completo de um "clipador profissional".

## Escopo: BACKEND APENAS

É EXPRESSAMENTE PROIBIDO alterar arquivos em `src/` nesta fase. O visual será tratado na fase 10.

## Regras de Execução

### Captura de Vídeo
- Aceitar links do YouTube de qualquer duração, usando `yt-dlp`
- Buscar vídeos de perfis do Instagram, com filtro por mais recentes, mais visualizados ou mais curtidos

### Inteligência de Corte
- Usar `faster-whisper` **localmente** para extrair a transcrição com timestamp exato de cada fala
- É EXPRESSAMENTE PROIBIDO usar a API da OpenAI para transcrição
- A IA deve ler a transcrição para identificar pontos altos, criar ganchos escritos chamativos e descartar introduções inúteis (ex: "Oi galera, tudo bem?")

### Opções de Duração
Cortes de 30 segundos, 1 minuto ou Automático (a IA corta pelo contexto de perguntas e respostas).

### Motor de Edição em Massa (FFmpeg)
- Inserir legenda automática no vídeo
- Aplicar o template de fundo (Brand Kit com foto e @ do perfil)
- Remover silêncios
- Melhorar a cor
- Espelhar o vídeo
- Ajustar a velocidade

### Agendamento
Preparar a lógica para postagem programada em massa.

## Segurança

Nenhuma chave, senha ou token pode aparecer no código. Use exclusivamente variáveis de ambiente (`os.environ.get`).

## Preservação

- Não altere a lista `FRONTEND_ORIGINS` em `backend/main.py` nem o valor padrão de `FRONTEND_URL`
- Não renomeie tabelas ou colunas existentes no Supabase
- Preserve as assinaturas das rotas já existentes que o frontend consome

## Critério de Sucesso (Portão Final)

- `python -m compileall backend` deve passar sem erros
- O envio de um link de teste do YouTube deve baixar o vídeo, gerar a transcrição e processar o corte via FFmpeg sem retornar Erro 500
