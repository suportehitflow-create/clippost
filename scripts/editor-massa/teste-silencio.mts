// Gera um vÃ­deo 6s: tom 0-2s, silÃªncio 2-4s, tom 4-6s â†’ remove silÃªncio â†’ espera ~4.2s
import path from 'node:path';
import os from 'node:os';
import { configGlobalPadrao, novoVideo } from '../../src/lib/editor-massa/defaults';
import { executar, FFMPEG, sondar } from '../../src/lib/editor-massa/server/ffmpeg';
import { montarComando } from '../../src/lib/editor-massa/server/filtro';
import { trechosComFala } from '../../src/lib/editor-massa/server/silencio';

const dir = os.tmpdir();
const ent = path.join(dir, 'silencio-in.mp4');
const sai = path.join(dir, 'silencio-out.mp4');
let r = await executar(FFMPEG, [
  '-y', '-f', 'lavfi', '-i', 'testsrc=s=640x360:r=30:d=6',
  '-f', 'lavfi', '-i', "aevalsrc='if(between(t,2,4),0,0.5*sin(2*PI*440*t))':s=44100:d=6",
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', ent,
]);
if (r.codigo) throw new Error(r.stderr.slice(-500));
const info = await sondar(ent);
const manter = await trechosComFala(ent, 0, info.duracao);
console.log('trechos', manter);
const g = { ...configGlobalPadrao(), efeitos: { ...configGlobalPadrao().efeitos, removerSilencio: true } };
const v = novoVideo({ id: '1', nome: 'x', largura: info.largura, altura: info.altura, duracao: info.duracao });
const cmd = montarComando({ global: g, video: v, info, arquivoVideo: ent, template: null, overlayPng: null, musica: null, antiDup: null, saida: sai, manter });
console.log(cmd.resumo);
r = await executar(FFMPEG, cmd.args, { timeoutMs: 120000 });
if (r.codigo) throw new Error(r.stderr.slice(-800));
const out = await sondar(sai);
console.log('saÃ­da', out.duracao.toFixed(2), 's', out.largura + 'x' + out.altura, 'audio', out.temAudio);

