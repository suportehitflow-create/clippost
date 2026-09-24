import { executar, FFMPEG } from '@/lib/editor-massa/server/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/editor-massa/saude → health check do servidor do editor (confere o FFmpeg)
export async function GET() {
  try {
    const r = await executar(FFMPEG, ['-version'], { timeoutMs: 10_000 });
    if (r.codigo !== 0) throw new Error('ffmpeg retornou erro');
    return Response.json({ ok: true, ffmpeg: r.stdout.toString().split('\n')[0] });
  } catch (e: any) {
    return Response.json({ ok: false, erro: String(e?.message ?? e) }, { status: 503 });
  }
}
