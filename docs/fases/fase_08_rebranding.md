# MISSÃO: REBRANDING GLOBAL (ClipPost ➔ clipost)

Objetivo: O nome oficial da plataforma mudou. Faça uma varredura no repositório e substitua todas as menções **visuais e textuais** da marca pelo novo nome oficial: `clipost`.

> Nota de precisão: uma varredura no código confirmou que as grafias "Clip Pro" e "ClipPro" **não existem** neste repositório. O nome atualmente presente é `ClipPost` (7 ocorrências). A substituição correta é `ClipPost` ➔ `clipost`.

## Regras de Execução (Controle de Raio de Explosão)

### Frontend (Next.js) — textos visíveis ao usuário
Atualize apenas strings de interface em `src/app/` e `src/components/`:
- `<title>` e metadados de SEO
- Cabeçalhos, rodapés, botões e textos das telas do painel

Ocorrências conhecidas:
- `src/app/layout.tsx` — metadata `title`
- `src/app/page.tsx` — rodapé de copyright
- `src/app/(auth)/login/page.tsx` — texto de boas-vindas
- `src/app/(dashboard)/dashboard/page.tsx` — nome no cabeçalho

### Backend (FastAPI) — textos visíveis
- `backend/main.py` — `FastAPI(title=...)`, que aparece na página `/docs`
- Docstrings de módulo em `backend/main.py` e `backend/tasks.py`
- Mensagens de retorno de API e logs visíveis ao usuário final

## Preservação Estrutural Absoluta

É EXPRESSAMENTE PROIBIDO alterar:
- Nomes de variáveis, funções ou classes
- Chaves de variáveis de ambiente
- Nomes de tabelas ou colunas no Supabase
- Nomes de arquivos e diretórios
- O identificador do app no Fly.io (`clippost-backend`) e o domínio Vercel (`clippost-three.vercel.app`)
- Qualquer ocorrência de `clippost` em minúsculas que faça parte de URL, path, nome de app ou identificador técnico

A alteração é **puramente cosmética**. Nenhum código funcional deve ser reestruturado.

## Case Sensitive

Respeite a grafia exata: `clipost` — todas as letras minúsculas.

## Critério de Sucesso (Portão Final)

- A substituição não pode quebrar a sintaxe de nenhum arquivo
- `npm run build` no frontend deve concluir sem erros
- `python -m compileall backend` deve passar sem erros
