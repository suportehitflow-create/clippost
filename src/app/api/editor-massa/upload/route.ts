import { salvarUpload } from '@/lib/editor-massa/server/armazenamento';
import { naoAutenticado, obterUsuario } from '@/lib/editor-massa/server/autorizacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_MB = Number(process.env.EDITOR_MASSA_MAX_MB || 1024);

// POST /api/editor-massa/upload   (corpo = arquivo bruto, header x-nome-arquivo)
// Grava em disco em streaming (sem carregar o vídeo inteiro na memória).
export async function POST(req: Request) {
  if (!(await obterUsuario(req))) return naoAutenticado();
  const nome = decodeURIComponent(req.headers.get('x-nome-arquivo') || '');
  if (!nome || !req.body) return Response.json({ erro: 'Arquivo ausente' }, { status: 400 });
  try {
    const meta = await salvarUpload(req.body, nome, LIMITE_MB * 1024 * 1024);
    return Response.json({ arquivoId: meta.id, nome: meta.nome, tamanho: meta.tamanho });
  } catch (e: any) {
    return Response.json({ erro: String(e?.message ?? e) }, { status: 400 });
  }
}
