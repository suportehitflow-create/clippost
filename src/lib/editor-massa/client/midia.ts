import { detectarAreaVideo, instantesAmostra, type ResultadoDeteccao } from '../deteccao-core';

// Leitura de vídeos no navegador: metadados, quadro para miniatura e detecção do template antigo.

export interface MetaVideo {
  largura: number;
  altura: number;
  duracao: number;
}

function esperar(el: HTMLMediaElement, evento: string, timeoutMs = 15000) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(() => {
      limpar();
      rej(new Error(`timeout: ${evento}`));
    }, timeoutMs);
    const ok = () => {
      limpar();
      res();
    };
    const erro = () => {
      limpar();
      rej(new Error('O navegador não conseguiu abrir este vídeo'));
    };
    const limpar = () => {
      clearTimeout(t);
      el.removeEventListener(evento, ok);
      el.removeEventListener('error', erro);
    };
    el.addEventListener(evento, ok, { once: true });
    el.addEventListener('error', erro, { once: true });
  });
}

export async function abrirVideo(url: string): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.src = url;
  await esperar(v, 'loadeddata');
  return v;
}

export async function irPara(v: HTMLVideoElement, t: number) {
  const alvo = Math.min(Math.max(0, t), Math.max(0, (v.duration || 0) - 0.05));
  if (Math.abs(v.currentTime - alvo) < 0.01 && v.readyState >= 2) return;
  const p = esperar(v, 'seeked');
  v.currentTime = alvo;
  await p;
}

export async function lerMeta(v: HTMLVideoElement): Promise<MetaVideo> {
  return { largura: v.videoWidth, altura: v.videoHeight, duracao: Number.isFinite(v.duration) ? v.duration : 0 };
}

/** Quadro em ImageBitmap (reduzido) para miniaturas e preview parado */
export async function capturarQuadro(v: HTMLVideoElement, t: number, larguraMax = 720): Promise<ImageBitmap> {
  await irPara(v, t);
  const esc = Math.min(1, larguraMax / v.videoWidth);
  return createImageBitmap(v, { resizeWidth: Math.round(v.videoWidth * esc), resizeHeight: Math.round(v.videoHeight * esc), resizeQuality: 'medium' });
}

/** Detecção local (grátis) da área do vídeo dentro de um template antigo */
export async function detectarNoNavegador(v: HTMLVideoElement, meta: MetaVideo, cortarTexto = false): Promise<ResultadoDeteccao | null> {
  const w = 320;
  const h = Math.max(8, Math.round((w * meta.altura) / meta.largura / 2) * 2);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const frames: Uint8Array[] = [];
  for (const t of instantesAmostra(meta.duracao, 16)) {
    try {
      await irPara(v, t);
    } catch {
      continue;
    }
    ctx.drawImage(v, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    frames.push(g);
  }
  return detectarAreaVideo(frames, w, h, { cortarTexto });
}

export async function carregarImagem(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export async function duracaoAudio(url: string): Promise<number> {
  const a = document.createElement('audio');
  a.preload = 'metadata';
  a.src = url;
  try {
    await esperar(a, 'loadedmetadata');
    return Number.isFinite(a.duration) ? a.duration : 0;
  } catch {
    return 0;
  }
}
