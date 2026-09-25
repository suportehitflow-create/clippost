import type { ConfigGlobal, ConfigVideo, Rect } from './types';

// Geometria única usada pelo preview (canvas no navegador) e pelo FFmpeg (servidor).
// Assim o que aparece no preview é exatamente o que sai no vídeo final.

export interface Canvas {
  w: number;
  h: number;
}

export interface Layout {
  /** Tamanho do canvas de trabalho (tamanho do template ou da moldura) */
  canvas: Canvas;
  /** Tamanho final do arquivo exportado (qualidade 480/720/1080) */
  saida: Canvas;
  /** Área abaixo de "pixels para descer" onde o vídeo é encaixado */
  area: Rect;
  /** Área preenchida com a cor da borda (null = template aparece) */
  preenchimento: Rect | null;
  /** Retângulo do vídeo de ORIGEM que aparece (px do vídeo original) */
  origem: Rect;
  /** Onde esse retângulo é desenhado no canvas (px do canvas) */
  destino: Rect;
  espelhar: boolean;
}

const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function tamanhoCanvas(global: ConfigGlobal, template: Canvas | null): Canvas {
  if (global.moldura.ativo) return { w: par(global.moldura.largura), h: par(global.moldura.altura) };
  if (template) return { w: par(template.w), h: par(template.h) };
  return { w: 1080, h: 1920 };
}

export function tamanhoSaida(canvas: Canvas, qualidade: number): Canvas {
  // Qualidade = lado menor (480p → 480x854, 1080p → 1080x1920), igual ao original
  if (canvas.w <= canvas.h) return { w: par(qualidade), h: par((qualidade * canvas.h) / canvas.w) };
  return { w: par((qualidade * canvas.w) / canvas.h), h: par(qualidade) };
}

/** Área útil do vídeo de origem: detecção (sem template antigo) + recortes manuais */
export function areaOrigem(v: ConfigVideo): Rect {
  const a = v.areaDetectada ?? { x: 0, y: 0, w: v.largura, h: v.altura };
  let x = a.x + v.recorte.esq;
  let y = a.y + v.recorte.topo;
  let w = a.w - v.recorte.esq - v.recorte.dir;
  let h = a.h - v.recorte.topo - v.recorte.base;
  w = Math.max(16, Math.min(w, v.largura - x));
  h = Math.max(16, Math.min(h, v.altura - y));
  x = Math.max(0, Math.min(x, v.largura - 16));
  y = Math.max(0, Math.min(y, v.altura - 16));
  return { x, y, w, h };
}

function intersecao(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

export function calcularLayout(global: ConfigGlobal, v: ConfigVideo, template: Canvas | null): Layout {
  const canvas = tamanhoCanvas(global, template);
  const saida = tamanhoSaida(canvas, global.qualidade);

  const semBordas = v.semBordas ?? global.semBordas;
  const c = areaOrigem(v);
  const quadro = !global.moldura.ativo && global.areaTemplate ? quadroTemplate(global.areaTemplate, global.espacoTopo, canvas) : null;

  let area: Rect;
  let alinhamento: 'topo' | 'centro';
  let base: number;
  if (quadro && global.encaixe === 'template') {
    // Dentro do quadro de vídeo do template (Sem bordas = preenche o quadro cortando o excesso)
    area = quadro;
    alinhamento = 'centro';
    base = semBordas ? Math.max(area.w / c.w, area.h / c.h) : Math.min(area.w / c.w, area.h / c.h);
  } else if (quadro) {
    // Solto: no formato do próprio vídeo, começando no topo do quadro (Sem bordas = de ponta a ponta)
    area = semBordas
      ? { x: 0, y: quadro.y, w: canvas.w, h: canvas.h - quadro.y }
      : { x: quadro.x, y: quadro.y, w: quadro.w, h: canvas.h - quadro.y };
    alinhamento = 'topo';
    base = Math.min(area.w / c.w, area.h / c.h);
  } else {
    const descer = global.moldura.ativo ? 0 : Math.max(0, Math.min(global.pixelsParaDescer, canvas.h - 32));
    area = { x: 0, y: descer, w: canvas.w, h: canvas.h - descer };
    alinhamento = global.moldura.ativo ? 'centro' : global.alinhamentoVertical;
    base = semBordas ? Math.max(area.w / c.w, area.h / c.h) : Math.min(area.w / c.w, area.h / c.h);
  }
  const soltoSemBordas = !!quadro && global.encaixe !== 'template';
  const cortaExcesso = semBordas && !soltoSemBordas;
  const s = base * (Math.max(10, v.posicao.escala) / 100);
  const dw = c.w * s;
  const dh = c.h * s;
  const dx = area.x + (area.w - dw) / 2 + v.posicao.x;
  const dy = (alinhamento === 'topo' && !cortaExcesso ? area.y : area.y + (area.h - dh) / 2) + v.posicao.y;
  const inteiro: Rect = { x: dx, y: dy, w: dw, h: dh };

  // Sem Bordas corta o que passa da área; depois aplica VCrop e limita ao canvas
  let vis = cortaExcesso ? intersecao(inteiro, area) : inteiro;
  vis = {
    x: vis.x + v.vcrop.esq,
    y: vis.y + v.vcrop.topo,
    w: vis.w - v.vcrop.esq - v.vcrop.dir,
    h: vis.h - v.vcrop.topo - v.vcrop.base,
  };
  vis = intersecao(vis, { x: 0, y: 0, w: canvas.w, h: canvas.h });
  if (vis.w < 4 || vis.h < 4) vis = { x: Math.max(0, dx), y: Math.max(0, dy), w: 4, h: 4 };

  // Arredonda o destino para números pares (exigência do libx264) e recalcula a origem a partir dele
  const destino: Rect = { x: Math.round(vis.x), y: Math.round(vis.y), w: par(vis.w), h: par(vis.h) };
  while (destino.w > 2 && destino.x + destino.w > canvas.w) destino.w -= 2;
  while (destino.h > 2 && destino.y + destino.h > canvas.h) destino.h -= 2;

  const espelhar = global.efeitos.espelhar !== v.espelhar;
  const ox = espelhar ? c.x + (dx + dw - (vis.x + vis.w)) / s : c.x + (vis.x - dx) / s;
  const origem: Rect = {
    x: Math.max(0, Math.round(ox)),
    y: Math.max(0, Math.round(c.y + (vis.y - dy) / s)),
    w: Math.max(2, Math.round(vis.w / s)),
    h: Math.max(2, Math.round(vis.h / s)),
  };
  origem.w = Math.min(origem.w, v.largura - origem.x);
  origem.h = Math.min(origem.h, v.altura - origem.y);

  const preenchimento = global.moldura.ativo || quadro || !global.preencherArea ? null : area;

  return { canvas, saida, area, preenchimento, origem, destino, espelhar };
}

/** Quadro de vídeo do template, com o "Espaço no topo" aplicado (a base do quadro fica fixa) */
function quadroTemplate(a: Rect, espacoTopo: number, canvas: Canvas): Rect {
  const topo = Math.max(0, Math.min(a.y + a.h - 32, a.y + (espacoTopo || 0)));
  const r = { x: a.x, y: topo, w: a.w, h: a.y + a.h - topo };
  return intersecao(r, { x: 0, y: 0, w: canvas.w, h: canvas.h });
}

/** Velocidade final do vídeo (efeitos). O Anti-Dup multiplica por um fator extra no servidor. */
export function velocidadeEfeitos(global: ConfigGlobal): number {
  let v = 1;
  if (global.efeitos.velocidadePersonalizada) v = global.efeitos.velocidade;
  else if (global.efeitos.velocidade105) v = 1.05;
  return Math.min(2, Math.max(0.5, v || 1));
}

/** Trecho usado do vídeo: corte manual (timeline) + "Cortar início/fim (0.5s)" */
export function trechoVideo(global: ConfigGlobal, v: ConfigVideo): { inicio: number; duracao: number } {
  let inicio = v.corte?.inicio ?? 0;
  let fim = v.corte?.fim ?? v.duracao;
  if (global.efeitos.cortarInicioFim && fim - inicio > 1.5) {
    inicio += 0.5;
    fim -= 0.5;
  }
  inicio = Math.max(0, inicio);
  fim = Math.min(v.duracao || fim, fim);
  return { inicio, duracao: Math.max(0.1, fim - inicio) };
}
