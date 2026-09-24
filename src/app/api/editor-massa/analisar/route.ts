import { caminhoUpload, idValido } from '@/lib/editor-massa/server/armazenamento';
import { detectarArea } from '@/lib/editor-massa/server/deteccao';
import { sondar } from '@/lib/editor-massa/server/ffmpeg';
import { naoAutenticado, obterUsuario } from '@/lib/editor-massa/server/autorizacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { arquivoId, detectar?: 'auto'|'margem'|'nenhuma' }
// Usado quando o navegador não consegue abrir o vídeo (AVI, MKV, HEVC...) ou quando
// a Roboflow está configurada no servidor: devolve dimensões, duração e a área detectada.
export async function POST(req: Request) {
  if (!(await obterUsuario(req))) return naoAutenticado();
  const { arquivoId, detectar } = await req.json().catch(() => ({}));
  if (!arquivoId || !idValido(arquivoId)) return Response.json({ erro: 'arquivoId inválido' }, { status: 400 });
  try {
    const arq = await caminhoUpload(arquivoId);
    const info = await sondar(arq);
    const det = detectar ? await detectarArea(arq, info, detectar) : null;
    return Response.json({ ...info, area: det?.area ?? null, origem: det?.origem ?? null });
  } catch (e: any) {
    return Response.json({ erro: String(e?.message ?? e) }, { status: 500 });
  }
}
