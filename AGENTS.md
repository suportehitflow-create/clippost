<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Deploy do backend (Fly.io)

Mais de um agente trabalha neste repositório ao mesmo tempo. Um `fly deploy` reinicia a única máquina do backend e interrompe qualquer corte em andamento.

- Publique o backend **somente** com `powershell -ExecutionPolicy Bypass -File backend\deploy.ps1`. O script espera `GET /api/admin/active-jobs` retornar `active: 0` antes de rodar `fly deploy`.
- Não rode `fly deploy` direto nem `fly scale count` maior que 1: a região `gru` tem IPs bloqueados pelo YouTube e só a máquina atual baixa vídeos.
- Faça `git pull` antes de commitar e commite o que publicar, para o outro agente não sobrescrever sua versão com um deploy do código antigo.
