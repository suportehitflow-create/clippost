// Uso: npx tsx scripts/teste-deteccao.ts video1.mp4 video2.mp4 ...
import { detectarArea } from '../../src/lib/editor-massa/server/deteccao';
import { sondar } from '../../src/lib/editor-massa/server/ffmpeg';

for (const arq of process.argv.slice(2)) {
  const info = await sondar(arq);
  const t = Date.now();
  const r = await detectarArea(arq, info, 'auto');
  console.log(`${arq}\n  ${info.largura}x${info.altura} ${info.duracao.toFixed(1)}s → ${r.origem} ${JSON.stringify(r.area)} (${Date.now() - t}ms)`);
}
