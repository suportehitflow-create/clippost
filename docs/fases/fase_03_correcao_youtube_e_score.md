# Fase 3 — Correção YouTube e Score de Viralização

**Objetivo:** Resolver o carregamento infinito do YouTube trazendo feedback visual e implementar o sistema de notas (Viral Score) nos cortes.

## 1. Feedback Visual e Fila (Backend/Frontend)

* O endpoint de processamento não pode deixar o frontend esperando a renderização inteira terminar. O backend no Fly.io deve retornar um `job_id` imediatamente com Status 200.
* Crie uma rota de status (`/api/jobs/{job_id}`) que o frontend na Vercel possa consultar para mostrar em qual etapa o vídeo está (Baixando, Transcrevendo, Analisando IA, Renderizando).

## 2. Inteligência de Viralização (Claude API)

* Após o `faster-whisper` transcrever o vídeo localmente, envie o texto para a API do Claude.
* O prompt da IA deve exigir que ela avalie a transcrição, ignore introduções inúteis e foque em ganchos fortes.
* A IA deve retornar um JSON estrito contendo os cortes. Cada corte deve ter `start_time`, `end_time`, `hook_title` e um `viral_score` (ex: 1 a 100 qualificando o potencial do vídeo).

## Critério de Sucesso (Portão)

O frontend deve compilar sem erros, e ao enviar um link do YouTube, a tela deve mostrar o status do processamento mudando até exibir os clipes gerados com suas respectivas notas de viralização.
