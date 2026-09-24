// Teste do pipeline do servidor sem a interface.
// Uso: npx tsx scripts/teste-processar.ts <template.jpg|png> <pasta-saida> <video1> [video2...]
// Variáveis opcionais: MUSICA=arquivo.mp3  OVERLAY=overlay.png  ANTIDUP=leve|forte
import fs from 'node:fs/promises';
import path from 'node:path';
import { configGlobalPadrao, novoVideo } from '../../src/lib/editor-massa/defaults';
import { gerarAntiDup } from '../../src/lib/editor-massa/server/antidup';
import { detectarArea } from '../../src/lib/editor-massa/server/deteccao';
import { executar, FFMPEG, sondar } from '../../src/lib/editor-massa/server/ffmpeg';
import { montarComando } from '../../src/lib/editor-massa/server/filtro';

const [template, pastaSaida, ...videos] = process.argv.slice(2);
await fs.mkdir(pastaSaida, { recursive: true });
const tInfo = await sondar(template);

const global = configGlobalPadrao();
global.melhorarAudio = true;
if (process.env.ANTIDUP) {
  global.antiDup = true;
  global.antiDupNivel = process.env.ANTIDUP as 'leve' | 'forte';
}
if (process.env.MUSICA) global.musica = { ...global.musica, ativo: true, musicaId: 'm1', volumeMusica: 40 };
if (process.env.ALINHAR) global.alinhamentoVertical = process.env.ALINHAR as 'topo' | 'centro';
if (process.env.PREENCHER === '0') global.preencherArea = false;

for (const [i, arq] of videos.entries()) {
  const info = await sondar(arq);
  const det = await detectarArea(arq, info, 'auto');
  const v = { ...novoVideo({ id: 'v' + i, nome: path.basename(arq), largura: info.largura, altura: info.altura, duracao: info.duracao }), areaDetectada: det.area };
  const cmd = montarComando({
    global,
    video: v,
    info,
    arquivoVideo: arq,
    template: { arquivo: template, tamanho: { w: tInfo.largura, h: tInfo.altura } },
    overlayPng: process.env.OVERLAY ?? null,
    musica: process.env.MUSICA ? { arquivo: process.env.MUSICA, inicio: 0 } : null,
    antiDup: global.antiDup ? gerarAntiDup('teste' + i, global.antiDupNivel) : null,
    saida: path.join(pastaSaida, `${i + 1}.mp4`),
  });
  console.log(`\n${v.nome}: detecção=${det.origem} ${JSON.stringify(det.area)}\n  ${cmd.resumo}`);
  const t = Date.now();
  const r = await executar(FFMPEG, cmd.args, { aoProgresso: () => {} });
  console.log(r.codigo === 0 ? `  OK em ${Date.now() - t}ms` : `  ERRO ${r.codigo}\n${r.stderr.slice(-1500)}\nARGS: ${cmd.args.join(' ')}`);
}
