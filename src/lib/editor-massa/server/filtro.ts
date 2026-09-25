import { calcularLayout, trechoVideo, velocidadeEfeitos, type Canvas } from '../layout';
import type { ConfigGlobal, ConfigVideo } from '../types';
import type { ParametrosAntiDup } from './antidup';
import type { InfoMidia } from './ffmpeg';
import { expressaoTrechos, type Segmento } from './silencio';

// Monta o comando FFmpeg de um vídeo. Estrutura portada do log [FFMPEG-FILTER] do original:
//   entrada 0 = template em loop, 1 = vídeo, 2 = PNG de texto/marca, 3 = música
//   [1:v] crop → scale → [vid];  [0:v][vid] overlay → scale(qualidade) → [tmp];
//   [tmp][2:v] overlay → zoom do anti-dup → format=yuv420p [vout]

export interface EntradaFiltro {
  global: ConfigGlobal;
  video: ConfigVideo;
  info: InfoMidia;
  arquivoVideo: string;
  template: { arquivo: string; tamanho: Canvas } | null;
  overlayPng: string | null;
  musica: { arquivo: string; inicio: number } | null;
  antiDup: ParametrosAntiDup | null;
  saida: string;
  /** modo seguro = nova tentativa sem filtros "opcionais" (igual ao [RETRY] do original) */
  seguro?: boolean;
  /** Remover silêncios: trechos com fala (segundos relativos ao início do trecho) */
  manter?: Segmento[] | null;
}

const hex = (cor: string) => '0x' + cor.replace('#', '').slice(0, 6).padEnd(6, '0').toUpperCase();
const n = (v: number, casas = 4) => Number(v.toFixed(casas)).toString();

/** atempo só aceita 0.5–2.0 por instância: encadeia se precisar */
function cadeiaAtempo(vel: number): string[] {
  const partes: string[] = [];
  let v = vel;
  while (v > 2) {
    partes.push('atempo=2.0');
    v /= 2;
  }
  while (v < 0.5) {
    partes.push('atempo=0.5');
    v /= 0.5;
  }
  if (Math.abs(v - 1) > 0.0005) partes.push(`atempo=${n(v)}`);
  return partes;
}

export function montarComando(e: EntradaFiltro): { args: string[]; duracaoSaida: number; resumo: string } {
  const { global: g, video: v, info, antiDup: ad } = e;
  const L = calcularLayout(g, { ...v, largura: info.largura, altura: info.altura, duracao: info.duracao }, e.template?.tamanho ?? null);
  const trecho = trechoVideo(g, { ...v, duracao: info.duracao });
  const vel = velocidadeEfeitos(g) * (ad ? ad.atempo : 1);
  // No modo seguro (retry) não corta silêncio: é o filtro mais sensível
  const manter = !e.seguro && e.manter?.length ? e.manter : null;
  const duracaoUtil = manter ? manter.reduce((t, s) => t + s.fim - s.ini, 0) : trecho.duracao;
  const duracaoSaida = duracaoUtil / vel;
  const fps = ad ? ad.fps : Math.min(60, Math.max(15, Math.round(info.fps || 30)));
  const fpsOrigem = Math.min(60, Math.max(10, Math.round(info.fps || 30)));
  const crf = ad ? ad.crf : 20;

  const args: string[] = ['-y', '-hide_banner', '-nostdin'];

  // 0: template / moldura
  if (e.template && !g.moldura.ativo) {
    args.push('-loop', '1', '-framerate', String(fps), '-t', n(duracaoSaida, 3), '-i', e.template.arquivo);
  } else {
    const cor = g.moldura.ativo ? g.moldura.cor : '#000000';
    args.push('-f', 'lavfi', '-i', `color=c=${hex(cor)}:s=${L.canvas.w}x${L.canvas.h}:r=${fps}:d=${n(duracaoSaida, 3)}`);
  }
  // 1: vídeo (com trim)
  if (trecho.inicio > 0) args.push('-ss', n(trecho.inicio, 3));
  args.push('-t', n(trecho.duracao, 3), '-i', e.arquivoVideo);
  // 2: PNG de texto/marca d'água
  let idxOverlay = -1;
  let prox = 2;
  if (e.overlayPng) {
    args.push('-i', e.overlayPng);
    idxOverlay = prox++;
  }
  // 3: música
  let idxMusica = -1;
  if (e.musica) {
    args.push('-stream_loop', '-1');
    if (e.musica.inicio > 0) args.push('-ss', n(e.musica.inicio, 3));
    args.push('-i', e.musica.arquivo);
    idxMusica = prox++;
  }

  // ---------- vídeo ----------
  const o = L.origem;
  const d = L.destino;
  const cadeiaVid = ['setpts=PTS-STARTPTS'];
  // tira as pausas: fica só o que tem fala e os quadros são renumerados em sequência
  if (manter) cadeiaVid.push(`fps=${fpsOrigem}`, `select=${expressaoTrechos(manter)}`, 'setpts=N/FRAME_RATE/TB');
  cadeiaVid.push(`crop=${o.w}:${o.h}:${o.x}:${o.y}`);
  if (L.espelhar) cadeiaVid.push('hflip');
  cadeiaVid.push(`scale=${d.w}:${d.h}:flags=bicubic`);
  if (g.efeitos.ajusteAutomatico && !e.seguro) cadeiaVid.push('eq=contrast=1.06:saturation=1.12:brightness=0.01:gamma=1.02');
  if (Math.abs(vel - 1) > 0.0005) cadeiaVid.push(`setpts=PTS/${n(vel)}`);
  cadeiaVid.push('setsar=1');

  const cadeiaBg = [`scale=${L.canvas.w}:${L.canvas.h}`, 'setsar=1'];
  if (L.preenchimento) {
    const p = L.preenchimento;
    cadeiaBg.push(`drawbox=x=${p.x}:y=${p.y}:w=${p.w}:h=${p.h}:color=${hex(g.corBorda)}@1:t=fill`);
  }

  const filtros: string[] = [
    `[1:v]${cadeiaVid.join(',')}[vid]`,
    `[0:v]${cadeiaBg.join(',')}[bg]`,
    `[bg][vid]overlay=${d.x}:${d.y}:shortest=1,scale=${L.saida.w}:${L.saida.h}:flags=bicubic[tmp]`,
  ];
  let atual = 'tmp';
  if (idxOverlay >= 0) {
    filtros.push(`[${atual}][${idxOverlay}:v]overlay=0:0[txt]`);
    atual = 'txt';
  }
  const fim: string[] = [];
  if (ad) {
    fim.push(
      `scale='trunc(iw*${ad.zoom}/2)*2':'trunc(ih*${ad.zoom}/2)*2'`,
      `crop=${L.saida.w}:${L.saida.h}:(iw-${L.saida.w})/2:(ih-${L.saida.h})/2`,
    );
    if (!e.seguro) {
      if (ad.eq) fim.push(`eq=brightness=${ad.eq.brilho}:contrast=${ad.eq.contraste}:saturation=${ad.eq.saturacao}:gamma=${ad.eq.gama}`);
      if (ad.matiz) fim.push(`hue=h=${ad.matiz}`);
      if (ad.nitidez) fim.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${ad.nitidez}`);
      if (ad.ruido) fim.push(`noise=alls=${ad.ruido}:allf=t`);
    }
  }
  fim.push(`fps=${fps}`, 'format=yuv420p');
  filtros.push(`[${atual}]${fim.join(',')}[vout]`);

  // ---------- áudio ----------
  // Volume do áudio original vale sempre (com ou sem música); 0% = sem o áudio original
  const volVideo = g.musica.mutarOriginal ? 0 : (g.musica.volumeVideo ?? 100) / 100;
  const usarOriginal = info.temAudio && !v.mudo && volVideo > 0.001;
  let mapaAudio: string | null = null;
  if (usarOriginal) {
    const a = ['asetpts=PTS-STARTPTS', ...(manter ? [`aselect=${expressaoTrechos(manter)}`, 'asetpts=N/SR/TB'] : []), ...cadeiaAtempo(vel)];
    if (g.melhorarAudio && !e.seguro) {
      a.push(
        'highpass=f=80',
        'lowpass=f=13000',
        'acompressor=threshold=-20dB:ratio=3:attack=5:release=50',
        'dynaudnorm=p=0.9:s=5',
      );
    }
    if (Math.abs(volVideo - 1) > 0.001) a.push(`volume=${n(volVideo, 3)}`);
    filtros.push(`[1:a]${a.join(',')}[va]`);
    mapaAudio = 'va';
  }
  if (idxMusica >= 0) {
    const fade = duracaoSaida > 2 ? `,afade=t=out:st=${n(duracaoSaida - 1, 3)}:d=1` : '';
    filtros.push(
      `[${idxMusica}:a]atrim=0:${n(duracaoSaida, 3)},asetpts=PTS-STARTPTS,volume=${n(g.musica.volumeMusica / 100, 3)}${fade}[ma]`,
    );
    if (mapaAudio) {
      filtros.push(`[va][ma]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`);
      mapaAudio = 'aout';
    } else {
      mapaAudio = 'ma';
    }
  }

  args.push('-filter_complex', filtros.join(';'), '-map', '[vout]');
  if (mapaAudio) args.push('-map', `[${mapaAudio}]`);
  else args.push('-an');

  args.push(
    '-c:v', 'libx264', '-preset', process.env.EDITOR_MASSA_PRESET || 'veryfast', '-crf', String(crf),
    '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
  );
  if (ad?.gop && !e.seguro) args.push('-g', String(ad.gop));
  if (mapaAudio) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2');
  args.push('-t', n(duracaoSaida, 3), '-movflags', '+faststart');
  if (g.removerMetadados || ad) {
    args.push('-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact');
  }
  args.push('-progress', 'pipe:1', '-nostats', e.saida);

  const resumo =
    `crop=${o.x},${o.y},${o.w},${o.h} → ${d.w}x${d.h}@${d.x},${d.y} saída=${L.saida.w}x${L.saida.h}` +
    ` vel=${n(vel, 3)} dur=${n(duracaoSaida, 2)}s` +
    (manter ? ` [SILÊNCIO] ${manter.length} trechos, ${n(trecho.duracao - duracaoUtil, 1)}s de pausa removidos` : '') +
    (ad ? ` [ANTI-DUP] zoom=${ad.zoom} atempo=${ad.atempo} crf=${ad.crf} fps=${ad.fps}` : '');
  return { args, duracaoSaida, resumo };
}
