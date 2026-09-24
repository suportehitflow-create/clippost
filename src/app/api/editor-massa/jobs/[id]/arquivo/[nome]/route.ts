import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pastaJob } from '@/lib/editor-massa/server/armazenamento';
import { obterJob } from '@/lib/editor-massa/server/fila';
import { zipEmStream } from '@/lib/editor-massa/server/zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; nome: string }> };

// GET /api/editor-massa/jobs/:id/arquivo/1.mp4  → um vídeo (com suporte a Range para tocar no player)
// GET /api/editor-massa/jobs/:id/arquivo/todos.zip → todos os vídeos prontos
export async function GET(req: Request, { params }: Ctx) {
  const { id, nome } = await params;
  let pasta: string;
  try {
    pasta = pastaJob(id);
  } catch {
    return new Response('Não encontrado', { status: 404 });
  }

  if (nome === 'todos.zip') {
    const job = obterJob(id);
    const nomes = job
      ? job.itens.filter((i) => i.saida).map((i) => i.saida!)
      : (await fs.readdir(pasta).catch(() => [] as string[])).filter((n) => n.endsWith('.mp4'));
    if (!nomes.length) return new Response('Nenhum vídeo pronto', { status: 404 });
    const arquivos = nomes.map((n) => ({ nome: n, caminho: path.join(pasta, n) }));
    return new Response(zipEmStream(arquivos), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="videos_${id.slice(0, 8)}.zip"`,
      },
    });
  }

  if (!/^[\w.-]+\.(mp4|txt)$/.test(nome)) return new Response('Nome inválido', { status: 400 });
  const caminho = path.join(pasta, nome);
  const st = await fs.stat(caminho).catch(() => null);
  if (!st) return new Response('Não encontrado', { status: 404 });

  const tipo = nome.endsWith('.mp4') ? 'video/mp4' : 'text/plain; charset=utf-8';
  const baixar = new URL(req.url).searchParams.has('baixar');
  const base: Record<string, string> = {
    'Content-Type': tipo,
    'Accept-Ranges': 'bytes',
    ...(baixar ? { 'Content-Disposition': `attachment; filename="${nome}"` } : {}),
  };

  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const ini = m[1] ? Number(m[1]) : 0;
    const fim = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (ini >= st.size || ini > fim) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    const corpo = Readable.toWeb(createReadStream(caminho, { start: ini, end: fim })) as unknown as ReadableStream;
    return new Response(corpo, {
      status: 206,
      headers: { ...base, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': String(fim - ini + 1) },
    });
  }
  const corpo = Readable.toWeb(createReadStream(caminho)) as unknown as ReadableStream;
  return new Response(corpo, { headers: { ...base, 'Content-Length': String(st.size) } });
}
