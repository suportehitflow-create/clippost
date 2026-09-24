import { idValido } from '@/lib/editor-massa/server/armazenamento';
import { naoAutenticado, obterUsuario, verificarLimite } from '@/lib/editor-massa/server/autorizacao';
import { criarJob } from '@/lib/editor-massa/server/fila';
import type { CriarJobPayload } from '@/lib/editor-massa/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_VIDEOS = Number(process.env.EDITOR_MASSA_MAX_VIDEOS || 200);

// POST /api/editor-massa/jobs → cria o processamento de uma aba
export async function POST(req: Request) {
  const usuarioId = await obterUsuario(req);
  if (!usuarioId) return naoAutenticado();
  let payload: CriarJobPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const erro = validar(payload);
  if (erro) return Response.json({ erro }, { status: 400 });

  const limite = await verificarLimite(usuarioId, payload.videos.length);
  if (!limite.permitido) {
    return Response.json({ erro: limite.motivo ?? 'Limite de vídeos atingido', restantes: limite.restantes }, { status: 402 });
  }

  const job = criarJob(payload, usuarioId);
  return Response.json(job);
}

function validar(p: CriarJobPayload): string | null {
  if (!p || typeof p !== 'object' || !p.global || !Array.isArray(p.videos)) return 'Payload incompleto';
  if (!p.videos.length) return 'Nenhum vídeo na aba!';
  if (p.videos.length > MAX_VIDEOS) return `Máximo de ${MAX_VIDEOS} vídeos por vez`;
  if (p.templateArquivoId && !idValido(p.templateArquivoId)) return 'Template inválido';
  for (const v of p.videos) {
    if (!v.arquivoId || !idValido(v.arquivoId)) return `Vídeo sem upload: ${v.nome}`;
    if (v.overlayArquivoId && !idValido(v.overlayArquivoId)) return 'Overlay inválido';
  }
  for (const id of Object.values(p.musicas ?? {})) if (!idValido(id)) return 'Música inválida';
  return null;
}
