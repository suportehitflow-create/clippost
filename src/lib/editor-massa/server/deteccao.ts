import { detectarAreaVideo, finalizarArea, instantesAmostra } from '../deteccao-core';
import type { Rect } from '../types';
import { executar, FFMPEG, type InfoMidia } from './ffmpeg';

// DetecÃ§Ã£o no servidor (usada quando o navegador nÃ£o mandou a Ã¡rea pronta).
// 1) Roboflow, se configurado (ROBOFLOW_API_KEY + ROBOFLOW_MODEL_ID) â€” igual ao original
// 2) DetecÃ§Ã£o local por movimento (grÃ¡tis, sem API)
// 3) Fallback do original: recorte centralizado com margem de 5%

const LARGURA_AMOSTRA = 320;

async function frameCinza(arquivo: string, t: number, w: number, h: number): Promise<Uint8Array | null> {
  const r = await executar(FFMPEG, [
    '-v', 'error', '-ss', t.toFixed(3), '-i', arquivo,
    '-frames:v', '1', '-vf', `scale=${w}:${h}:flags=area,format=gray`,
    '-f', 'rawvideo', 'pipe:1',
  ], { timeoutMs: 20000 });
  if (r.codigo !== 0 || r.stdout.length < w * h) return null;
  return new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, w * h);
}

export async function detectarLocal(arquivo: string, info: InfoMidia) {
  const w = LARGURA_AMOSTRA;
  const h = Math.max(8, Math.round((LARGURA_AMOSTRA * info.altura) / info.largura / 2) * 2);
  const tempos = instantesAmostra(info.duracao, 16);
  const frames: Uint8Array[] = [];
  // 4 extraÃ§Ãµes em paralelo
  for (let i = 0; i < tempos.length; i += 4) {
    const lote = await Promise.all(tempos.slice(i, i + 4).map((t) => frameCinza(arquivo, t, w, h)));
    lote.forEach((f) => f && frames.push(f));
  }
  return detectarAreaVideo(frames, w, h);
}

export async function detectarRoboflow(arquivo: string, info: InfoMidia): Promise<Rect | null> {
  const chave = process.env.ROBOFLOW_API_KEY;
  const modelo = process.env.ROBOFLOW_MODEL_ID;
  if (!chave || !modelo) return null;
  const url = process.env.ROBOFLOW_API_URL || 'https://detect.roboflow.com';

  const r = await executar(FFMPEG, [
    '-v', 'error', '-ss', (info.duracao * 0.3).toFixed(2), '-i', arquivo,
    '-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg', '-q:v', '3', 'pipe:1',
  ], { timeoutMs: 20000 });
  if (r.codigo !== 0 || !r.stdout.length) return null;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(r.stdout)], { type: 'image/jpeg' }), 'frame.jpg');
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const resp = await fetch(`${url}/${modelo}?api_key=${encodeURIComponent(chave)}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) return null; // 402 = sem crÃ©ditos â†’ cai para a detecÃ§Ã£o local
      const j: any = await resp.json();
      const preds: any[] = j?.predictions ?? [];
      if (!preds.length) return null;
      const p = preds.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      // Roboflow devolve o CENTRO (x, y) + largura/altura, na resoluÃ§Ã£o do frame
      const escX = info.largura / (j.image?.width || info.largura);
      const escY = info.altura / (j.image?.height || info.altura);
      return {
        x: (p.x - p.width / 2) * escX,
        y: (p.y - p.height / 2) * escY,
        w: p.width * escX,
        h: p.height * escY,
      };
    } catch {
      // tenta de novo
    }
  }
  return null;
}

export async function detectarArea(
  arquivo: string,
  info: InfoMidia,
  modo: 'auto' | 'margem' | 'nenhuma',
): Promise<{ area: Rect; origem: 'local' | 'roboflow' | 'margem' | 'completo' }> {
  if (modo === 'nenhuma') return { area: { x: 0, y: 0, w: info.largura, h: info.altura }, origem: 'completo' };
  if (modo === 'margem') return finalizarArea(null, info.largura, info.altura);

  const rf = await detectarRoboflow(arquivo, info).catch(() => null);
  if (rf) {
    const norm = { rect: { x: rf.x / info.largura, y: rf.y / info.altura, w: rf.w / info.largura, h: rf.h / info.altura }, atividade: 1 };
    const f = finalizarArea(norm, info.largura, info.altura);
    return { area: f.area, origem: f.origem === 'local' ? 'roboflow' : f.origem };
  }
  const local = await detectarLocal(arquivo, info).catch(() => null);
  return finalizarArea(local, info.largura, info.altura);
}
