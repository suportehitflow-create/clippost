import { caminhoUpload, idValido } from '@/lib/editor-massa/server/armazenamento';
import { executar, FFMPEG } from '@/lib/editor-massa/server/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/editor-massa/frame?arquivoId=...&t=1.5&w=720 → JPEG de um frame
// (miniatura/preview para formatos que o navegador não toca)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('arquivoId') || '';
  const t = Math.max(0, Number(url.searchParams.get('t') || 0));
  const w = Math.min(1920, Math.max(64, Number(url.searchParams.get('w') || 720)));
  if (!idValido(id)) return new Response('id inválido', { status: 400 });
  try {
    const arq = await caminhoUpload(id);
    const r = await executar(FFMPEG, [
      '-v', 'error', '-ss', t.toFixed(3), '-i', arq, '-frames:v', '1',
      '-vf', `scale=${w}:-2`, '-f', 'image2', '-c:v', 'mjpeg', '-q:v', '4', 'pipe:1',
    ], { timeoutMs: 20000 });
    if (r.codigo !== 0 || !r.stdout.length) return new Response('Falha ao extrair frame', { status: 500 });
    return new Response(new Uint8Array(r.stdout), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return new Response('Não encontrado', { status: 404 });
  }
}
