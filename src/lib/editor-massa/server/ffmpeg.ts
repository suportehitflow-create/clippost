import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// Caminho dos binários: variável de ambiente > pacotes ffmpeg-static / ffprobe-static > PATH
export const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || ffprobeStatic?.path || 'ffprobe';

export interface ResultadoExec {
  codigo: number;
  stdout: Buffer;
  stderr: string;
}

export function executar(
  bin: string,
  args: string[],
  opts: { timeoutMs?: number; aoProgresso?: (linha: string) => void; sinal?: AbortSignal } = {},
): Promise<ResultadoExec> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    const saida: Buffer[] = [];
    let erro = '';
    let resto = '';
    const timer = opts.timeoutMs ? setTimeout(() => proc.kill('SIGKILL'), opts.timeoutMs) : null;
    const abortar = () => proc.kill('SIGKILL');
    opts.sinal?.addEventListener('abort', abortar, { once: true });

    proc.stdout.on('data', (d: Buffer) => {
      if (opts.aoProgresso) {
        resto += d.toString();
        const linhas = resto.split('\n');
        resto = linhas.pop() ?? '';
        linhas.forEach((l) => opts.aoProgresso!(l.trim()));
      } else {
        saida.push(d);
      }
    });
    proc.stderr.on('data', (d: Buffer) => {
      erro += d.toString();
      if (erro.length > 20000) erro = erro.slice(-20000);
    });
    proc.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (codigo) => {
      if (timer) clearTimeout(timer);
      opts.sinal?.removeEventListener('abort', abortar);
      resolve({ codigo: codigo ?? -1, stdout: Buffer.concat(saida), stderr: erro });
    });
  });
}

export interface InfoMidia {
  largura: number;
  altura: number;
  duracao: number;
  fps: number;
  temAudio: boolean;
  rotacao: number;
}

export async function sondar(arquivo: string): Promise<InfoMidia> {
  const r = await executar(FFPROBE, [
    '-v', 'error',
    '-show_streams', '-show_format',
    '-of', 'json',
    arquivo,
  ], { timeoutMs: 30000 });
  if (r.codigo !== 0) throw new Error(`ffprobe falhou: ${r.stderr.slice(-300)}`);
  const j = JSON.parse(r.stdout.toString() || '{}');
  const streams: any[] = j.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const [num, den] = String(video?.r_frame_rate ?? '30/1').split('/').map(Number);
  const rot = Number(video?.tags?.rotate ?? video?.side_data_list?.find((s: any) => s.rotation != null)?.rotation ?? 0);
  let largura = Number(video?.width ?? 0);
  let altura = Number(video?.height ?? 0);
  // vídeos de celular gravados "em pé" vêm com rotação; o FFmpeg já aplica autorotate
  if (Math.abs(rot) === 90 || Math.abs(rot) === 270) [largura, altura] = [altura, largura];
  return {
    largura,
    altura,
    duracao: Number(j.format?.duration ?? 0),
    fps: den ? num / den : 30,
    temAudio: streams.some((s) => s.codec_type === 'audio'),
    rotacao: rot,
  };
}
