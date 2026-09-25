import fs from 'node:fs/promises';
import path from 'node:path';
import { executar, FFMPEG } from './ffmpeg';
import { expressaoTrechos, type Segmento } from './silencio';

// Legendas automáticas do editor: o áudio sai JÁ no tempo final do vídeo (trecho cortado,
// sem as pausas e com a velocidade aplicada), vai para o backend (Groq Whisper) e volta como
// um .ass no preset escolhido, pronto para o filtro "ass" do FFmpeg.

const BACKEND = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev').replace(/\/$/, '');

/** atempo aceita 0.5–2.0 por instância */
function atempo(vel: number): string[] {
  const r: string[] = [];
  let v = vel;
  while (v > 2) (r.push('atempo=2.0'), (v /= 2));
  while (v < 0.5) (r.push('atempo=0.5'), (v /= 0.5));
  if (Math.abs(v - 1) > 0.0005) r.push(`atempo=${v.toFixed(4)}`);
  return r;
}

export async function gerarLegendas(p: {
  arquivo: string;
  inicio: number;
  duracao: number;
  manter: Segmento[] | null;
  velocidade: number;
  preset: string;
  posicaoY: number; // % da altura onde fica o centro da legenda
  fonte?: string;
  token: string;
  pasta: string;
  nome: string;
}): Promise<{ arquivo: string; palavras: number } | null> {
  const audio = path.join(p.pasta, `${p.nome}.legenda.mp3`);
  const filtros = [
    'asetpts=PTS-STARTPTS',
    ...(p.manter?.length ? [`aselect=${expressaoTrechos(p.manter)}`, 'asetpts=N/SR/TB'] : []),
    ...atempo(p.velocidade),
  ];
  const r = await executar(
    FFMPEG,
    ['-y', '-hide_banner', '-nostdin', '-ss', p.inicio.toFixed(3), '-t', p.duracao.toFixed(3), '-i', p.arquivo,
      '-vn', '-af', filtros.join(','), '-ac', '1', '-ar', '16000', '-b:a', '64k', '-f', 'mp3', audio],
    { timeoutMs: Math.max(60_000, p.duracao * 3000) },
  );
  if (r.codigo !== 0) throw new Error('não consegui extrair o áudio para a legenda');

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(await fs.readFile(audio))], { type: 'audio/mpeg' }), 'audio.mp3');
    form.append('preset', p.preset);
    // No .ass (1280 de altura, alinhado embaixo) a margem é a distância da base até a legenda
    form.append('margin_v', String(Math.round(1280 * (1 - p.posicaoY / 100) - 30)));
    if (p.fonte) form.append('font_family', p.fonte);
    const resp = await fetch(`${BACKEND}/api/subtitles/ass`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.token}` },
      body: form,
      signal: AbortSignal.timeout(240_000),
    });
    const j: any = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(j?.detail || `backend respondeu ${resp.status}`);
    if (!j.palavras || !j.ass) return null; // vídeo sem fala
    const ass = path.join(p.pasta, `${p.nome}.ass`);
    await fs.writeFile(ass, j.ass, 'utf8');
    return { arquivo: ass, palavras: j.palavras };
  } finally {
    fs.rm(audio, { force: true }).catch(() => {});
  }
}

/**
 * Caminho do .ass dentro do filtro do FFmpeg, para usar entre aspas simples.
 * As aspas protegem do nível do filtergraph; o "\:" protege do nível das opções (C:\ no Windows).
 */
export function caminhoFiltro(arquivo: string) {
  return arquivo.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, '');
}
