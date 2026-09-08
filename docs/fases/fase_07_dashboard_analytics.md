# Contexto: Clip Pro - Fase 7 (Dashboard de Resultados)

Fechar o sistema exibindo as métricas de sucesso para o clipador no painel principal, utilizando a mesma linguagem visual Pro Max.

## 1. Agregação de Dados

* Crie a rota `GET /api/analytics/{user_id}`. Ela deve retornar a contagem de Projetos Criados, Clipes Gerados, e Posts Publicados com sucesso.
* **Regra de Fallback:** Se a conta for nova e não houver dados, retorne zero para tudo, nunca um erro 500.

## 2. Gráficos Visuais

* Adicione os cartões de estatísticas no topo da tela inicial.
* Integre uma biblioteca visual (ex: Recharts) para mostrar a atividade de geração de vídeos e postagens dos últimos 7 dias.

## Critério de Aprovação (Loop Gate)

A tela inicial do dashboard deve carregar imediatamente, sem telas brancas, exibindo as estatísticas corretamente formatadas.
