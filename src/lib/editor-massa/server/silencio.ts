import { executar, FFMPEG } from './ffmpeg';

// "Remover silêncios" (função do estúdio antigo): acha as pausas com o silencedetect do FFmpeg
// e devolve os trechos que ficam, em segundos RELATIVOS ao início do trecho usado do vídeo.

export interface Segmento {
  ini: number;
  fim: number;
}

const RUIDO = '-35dB';
const MIN_SILENCIO = 0.45; // pausas menores que isso ficam (fala natural)
const FOLGA = 0.12; // mantém um respiro antes/depois de cada fala

export async function trechosComFala(arquivo: string, inicio: number, duracao: number): Promise<Segmento[] | null> {
  const r = await executar(
    FFMPEG,
    ['-hide_banner', '-nostdin', '-ss', inicio.toFixed(3), '-t', duracao.toFixed(3), '-i', arquivo, '-vn', '-af', `silencedetect=noise=${RUIDO}:d=${MIN_SILENCIO}`, '-f', 'null', '-'],
    { timeoutMs: Math.max(60_000, duracao * 4000) },
  );
  if (r.codigo !== 0) return null;

  const silencios: Segmento[] = [];
  let aberto: number | null = null;
  for (const linha of r.stderr.split('\n')) {
    const a = /silence_start:\s*(-?[\d.]+)/.exec(linha);
    if (a) aberto = Math.max(0, Number(a[1]));
    const b = /silence_end:\s*([\d.]+)/.exec(linha);
    if (b && aberto !== null) {
      silencios.push({ ini: aberto, fim: Number(b[1]) });
      aberto = null;
    }
  }
  if (aberto !== null) silencios.push({ ini: aberto, fim: duracao });
  if (!silencios.length) return null;

  const manter: Segmento[] = [];
  let cursor = 0;
  for (const s of silencios) {
    const fim = Math.min(duracao, s.ini + FOLGA);
    if (fim - cursor > 0.15) manter.push({ ini: cursor, fim });
    cursor = Math.max(cursor, s.fim - FOLGA);
  }
  if (duracao - cursor > 0.15) manter.push({ ini: cursor, fim: duracao });

  const total = manter.reduce((t, s) => t + s.fim - s.ini, 0);
  // Quase tudo "silêncio" (música baixa, vídeo sem fala): não mexe
  if (!manter.length || total < duracao * 0.25 || total > duracao - 0.3) return null;
  return manter;
}

/** Expressão para select/aselect: between(t,a,b)+between(t,c,d)... */
export function expressaoTrechos(segs: Segmento[]): string {
  return segs.map((s) => `between(t\\,${s.ini.toFixed(3)}\\,${s.fim.toFixed(3)})`).join('+');
}
