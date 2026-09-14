# MISSÃO: CONSTRUÇÃO DO AGENTE DE CONTEÚDO (CLIP PRO)

Objetivo: Desenvolver um pipeline de backend para criação de conteúdo automatizado. A regra de ouro é inverter a ordem: o sistema deve primeiro coletar evidências atuais do que está funcionando nas plataformas, e só então deixar o agente escrever com base nessas evidências. A IA apenas coleta e rascunha; a publicação final exige aprovação humana.

## 1. Regras Absolutas de Engenharia (O Freio)

- **Stack Obrigatória:** Backend em Python FastAPI, orquestrado com Celery e Redis para tarefas assíncronas.
- **Processamento de Mídia:** Utilize estritamente FFmpeg, yt-dlp e faster-whisper rodando localmente. É expressamente PROIBIDO sugerir ou utilizar a API da OpenAI para transcrições.
- **Segurança Cega:** Em nenhuma hipótese deixe chaves de API, senhas ou tokens expostos no código. Utilize obrigatoriamente variáveis de ambiente (ex: `os.environ.get('APIFY_TOKEN')`).

## 2. O Grafo do Sistema (Fatiamento das Tarefas Celery/FastAPI)

### Nó 1: Descoberta (Discovery)
Integre ferramentas como o Last30Days para rastrear YouTube, Instagram Reels e TikTok. Extrair links e métricas do que está vencendo nas plataformas no último mês.

Arquivo: `backend/app/tasks/discovery.py`

### Nó 2: Camada de Expansão (Scrapers)
Rotas que enviem os perfis vencedores para scrapers de plataforma (Apify Actors). Output: dados estruturados com perfil completo, publicações, engajamento (curtidas/comentários) e mídia.

Arquivo: `backend/app/tasks/scraper.py`

### Nó 3: Extração de Evidências (Fallback de Transcrição)
Cadeia lógica rigorosa para obter o texto do vídeo:
1. Tente baixar legendas manuais
2. Se falhar, busque legendas automáticas
3. Apenas quando não houver legendas: use yt-dlp para puxar o áudio e acione faster-whisper para transcrever

Arquivo: `backend/app/tasks/transcription.py`

### Nó 4: Análise de Vídeo (Integração Gemini)
Configure a API do Google Gemini para analisar os vídeos. O prompt interno deve mapear: hook, ritmo, mudanças de cena, provas mostradas na tela e CTA — gerando timestamps exatos para cada evento.

Arquivo: `backend/app/tasks/video_analysis.py`

### Nó 5: O Rascunho com Recibos
Lógica final de IA: cruzar informações do mercado coletadas com o contexto do Clip Pro (oferta, público e tom de voz). Gerar rascunhos onde cada afirmação contenha "recibos" em anexo (links das postagens originais, falas transcritas e timestamps do Gemini).

Arquivo: `backend/app/tasks/draft_generator.py`

### Rotas FastAPI
Arquivo: `backend/app/routers/content_agent.py`

Endpoints:
- `POST /api/content-agent/discover` — dispara Nó 1
- `POST /api/content-agent/scrape` — dispara Nó 2
- `POST /api/content-agent/transcribe` — dispara Nó 3
- `POST /api/content-agent/analyze` — dispara Nó 4
- `POST /api/content-agent/draft` — dispara Nó 5
- `GET /api/content-agent/status/{task_id}` — status de qualquer tarefa Celery

### Celery Worker
Arquivo: `backend/celery_worker.py`

### Frontend: Painel do Agente
Arquivo: `src/app/dashboard/content-agent/page.tsx`

Interface simples com Tailwind: botão "Iniciar Pipeline", lista de tarefas com status (pendente/rodando/concluído/erro), área de rascunhos gerados aguardando aprovação humana.

## 3. Critério de Fim (Sinal Verde para o Loop)

O código escrito deve:
- Iniciar o servidor FastAPI sem erros de sintaxe ou dependências quebradas
- Workers do Celery configurados corretamente
- Todas as rotas retornando Status 200 nos testes locais
- `npm run build` do frontend sem erros de TypeScript
