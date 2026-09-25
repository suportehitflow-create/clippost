// Queima um .ass no estilo do backend num vídeo de teste: npx tsx scripts/editor-massa/teste-legenda.mts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configGlobalPadrao, novoVideo } from '../../src/lib/editor-massa/defaults';
import { executar, FFMPEG, sondar } from '../../src/lib/editor-massa/server/ffmpeg';
import { montarComando } from '../../src/lib/editor-massa/server/filtro';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'leg-'));
const ent = path.join(dir, 'in.mp4');
const ass = path.join(dir, 'x.ass');
const sai = path.join(dir, 'out.mp4');
let r = await executar(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=s=640x360:r=30:d=3', '-f', 'lavfi', '-i', 'sine=d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', ent]);
if (r.codigo) throw new Error(r.stderr.slice(-400));
await fs.writeFile(ass, `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,DejaVu Sans,54,&H00000000,&H000000FF,&H0015CCFA,&H0015CCFA,-1,0,0,0,100,100,0,0,3,7,0,2,54,54,290,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.20,0:00:02.50,Viral,,0,0,0,,TESTE DE LEGENDA
`);
const info = await sondar(ent);
const cmd = montarComando({
  global: configGlobalPadrao(), video: novoVideo({ id: '1', nome: 'x', largura: info.largura, altura: info.altura, duracao: info.duracao }),
  info, arquivoVideo: ent, template: null, overlayPng: null, musica: null, antiDup: null, saida: sai, legendas: ass,
});
r = await executar(FFMPEG, cmd.args, { timeoutMs: 120000 });
if (r.codigo) throw new Error(r.stderr.slice(-800));
await executar(FFMPEG, ['-y', '-ss', '1', '-i', sai, '-frames:v', '1', path.join(dir, 'quadro.png')]);
console.log('ok', path.join(dir, 'quadro.png'));
