# MISSÃO: POLIMENTO UI/UX (TAILWIND)

Objetivo: O sistema funciona, mas o visual do painel e dos cards de vídeo está desorganizado. Faça um polimento visual estrito.

## Regras de Execução

- Ajuste o espaçamento (padding, margin), o alinhamento de textos e a centralização de loaders nas telas do Dashboard
- Refine os cards de "Vídeos Importados" para um design limpo e estruturado com Tailwind CSS

## Raio de Explosão

É EXPRESSAMENTE PROIBIDO:

- Alterar qualquer arquivo do backend (Python)
- Alterar chamadas de API, URLs, nomes de campos do payload ou schemas
- Alterar a lógica do botão de upload corrigido anteriormente (`src/app/(dashboard)/upload/page.tsx` envia `url`, `user_id` e `clip_duration` — esse payload não pode mudar)
- Renomear estados, props ou funções existentes
- Remover funcionalidade existente para "simplificar" o layout

Modifique APENAS classes de estilo e marcação visual em `src/app/` e `src/components/`.

## Restrições Técnicas

- NUNCA importe de `@/components/ui/*` — shadcn/ui não está instalado
- NUNCA importe bibliotecas fora do `package.json`
- O nome da marca é `clipost`, minúsculo. O logo usa duas cores: `clip` na cor padrão e `ost` em `var(--accent)`

## Critério de Sucesso

`npm run build` deve compilar sem erros de classes inexistentes, e o site deve renderizar com o layout alinhado.
