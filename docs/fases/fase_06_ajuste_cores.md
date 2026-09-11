# Fase 06 — Ajuste de Cores: Roxo → Laranja

## Objetivo
Refatorar a identidade visual do painel substituindo toda a paleta roxa pela paleta laranja, mantendo a estética "Pro Max" de alta conversão.

## Escopo EXCLUSIVO
APENAS src/app/globals.css e src/app/(dashboard)/dashboard/page.tsx.
NÃO modifique backend/, NÃO modifique layout.tsx, NÃO modifique outros arquivos.

## Ações obrigatórias

### 1. src/app/globals.css
Substitua os tokens de cor roxo por laranja:

- `--accent: #7c3aed` → `--accent: #ea580c`
- `--accent-hover: #6d28d9` → `--accent-hover: #c2410c`
- `--accent-glow: rgba(124, 58, 237, 0.25)` → `--accent-glow: rgba(234, 88, 12, 0.25)`
- `.glass-accent background: rgba(124,58,237,0.12)` → `rgba(234,88,12,0.12)`
- `.glass-accent border: rgba(124,58,237,0.25)` → `rgba(234,88,12,0.25)`

### 2. src/app/(dashboard)/dashboard/page.tsx
Substitua qualquer literal de cor `#7c3aed` por `#ea580c` em estilos inline.
A barra de atividade usa `background: '#7c3aed'` — troque por `#ea580c`.

## Critério de Sucesso
`npm run build` deve compilar sem erros. Nenhum outro arquivo pode ser alterado.
