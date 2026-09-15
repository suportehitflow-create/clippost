# MISSÃO: REORGANIZAÇÃO UI/UX E DESIGN MINIMALISTA

Objetivo: Reescrever estritamente a camada visual (Next.js) para criar uma interface minimalista, fácil de operar e focada em vídeos em massa.

## Escopo: FRONTEND APENAS (Controle de Raio de Explosão)

É EXPRESSAMENTE PROIBIDO:
- Alterar a lógica de conexão com o Supabase
- Alterar rotas ou payloads de chamadas ao FastAPI
- Alterar qualquer arquivo em `backend/`
- Renomear estados, props ou funções existentes

Altere APENAS marcação e estilo em `src/app/` e `src/components/`.

## Estética

- Limpe a poluição visual
- Dashboard com espaçamento adequado (padding/margin), tipografia legível e cards bem definidos para vídeos importados e clipes gerados

## Fluxo do Usuário

- A tela de importação deve deixar evidentes os botões de duração (30s, 60s, Auto) e o campo para colar link do YouTube ou @ do Instagram
- A tela do Brand Kit (nome de usuário, foto de perfil e legendas) deve ser intuitiva

## Marca

O nome da plataforma é `clipost`, todo em minúsculas. O logo usa duas cores: `clip` na cor padrão e `ost` em `var(--accent)`.

## Restrições Técnicas

- NUNCA importe de `@/components/ui/*` (shadcn/ui não está instalado)
- NUNCA importe bibliotecas fora do `package.json`
- Em arquivos CSS, `@import` deve ser sempre a primeira linha

## Critério de Sucesso (Portão Final)

- `npm run build` deve concluir sem erros
- Nenhuma classe quebrada e nenhum erro de renderização
