import { naoAutenticado, obterUsuario } from '@/lib/editor-massa/server/autorizacao';
import { apagarSaidas, controlarJob, ehDonoDoJob, obterJob } from '@/lib/editor-massa/server/fila';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const naoEncontrado = () => Response.json({ erro: 'Job não encontrado' }, { status: 404 });

// GET → status + progresso + log (a UI consulta a cada ~1s)
export async function GET(req: Request, { params }: Ctx) {
  const usuarioId = await obterUsuario(req);
  if (!usuarioId) return naoAutenticado();
  const { id } = await params;
  const job = obterJob(id);
  if (!job || !ehDonoDoJob(id, usuarioId)) return naoEncontrado();
  const desde = Number(new URL(req.url).searchParams.get('log') || 0);
  return Response.json({ ...job, log: job.log.slice(desde), totalLog: job.log.length });
}

// PATCH { acao: 'pausar' | 'continuar' | 'cancelar' }
export async function PATCH(req: Request, { params }: Ctx) {
  const usuarioId = await obterUsuario(req);
  if (!usuarioId) return naoAutenticado();
  const { id } = await params;
  if (!ehDonoDoJob(id, usuarioId)) return naoEncontrado();
  const { acao } = await req.json().catch(() => ({}));
  if (!['pausar', 'continuar', 'cancelar'].includes(acao)) return Response.json({ erro: 'Ação inválida' }, { status: 400 });
  const job = controlarJob(id, acao);
  if (!job) return naoEncontrado();
  return Response.json({ status: job.status });
}

// DELETE → apaga os vídeos já gerados ("Deseja apagar os vídeos que já foram processados?")
export async function DELETE(req: Request, { params }: Ctx) {
  const usuarioId = await obterUsuario(req);
  if (!usuarioId) return naoAutenticado();
  const { id } = await params;
  if (!ehDonoDoJob(id, usuarioId)) return naoEncontrado();
  controlarJob(id, 'cancelar');
  await apagarSaidas(id);
  return Response.json({ ok: true });
}
