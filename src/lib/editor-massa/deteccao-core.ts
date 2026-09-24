import type { Rect } from './types';

// Detecção da área do vídeo "de verdade" dentro de um vídeo que já tem template.
//
// Ideia: o template antigo é uma imagem PARADA (fundo, nome do perfil, bordas),
// enquanto o vídeo dentro dele se MEXE. Pegamos ~16 frames espalhados pelo vídeo,
// em escala de cinza e pequenos, e medimos quanto cada pixel varia no tempo.
// A maior faixa retangular que varia é o vídeo. Depois as bordas são "encaixadas"
// na linha de contraste mais forte (a borda entre template e vídeo).
//
// Função pura: roda igual no navegador (canvas) e no servidor (frames do FFmpeg).

export interface ResultadoDeteccao {
  /** Retângulo normalizado (0-1) */
  rect: Rect;
  /** Fração da área com movimento (0-1) — confiança */
  atividade: number;
}

export function detectarAreaVideo(frames: Uint8Array[], w: number, h: number): ResultadoDeteccao | null {
  const n = frames.length;
  if (n < 3 || w < 8 || h < 8) return null;
  const total = w * h;

  // 1) variação temporal (max - min) e frame médio
  const faixa = new Uint8Array(total);
  const media = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let mn = 255;
    let mx = 0;
    let soma = 0;
    for (let f = 0; f < n; f++) {
      const p = frames[f][i];
      if (p < mn) mn = p;
      if (p > mx) mx = p;
      soma += p;
    }
    faixa[i] = mx - mn;
    media[i] = soma / n;
  }

  // 2) limiar adaptativo: o template parado fica nos percentis baixos
  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i++) hist[faixa[i]]++;
  const p20 = percentil(hist, total, 0.2);
  const limiar = Math.max(8, Math.min(40, p20 * 2.5 + 4));
  const mascara = new Uint8Array(total);
  let ativos = 0;
  for (let i = 0; i < total; i++) {
    if (faixa[i] > limiar) {
      mascara[i] = 1;
      ativos++;
    }
  }
  if (ativos < total * 0.01) return null;

  const atividadeLinha = (y: number, x0: number, x1: number) => {
    let c = 0;
    const o = y * w;
    for (let x = x0; x <= x1; x++) c += mascara[o + x];
    return c / (x1 - x0 + 1);
  };
  const atividadeColuna = (x: number, y0: number, y1: number) => {
    let c = 0;
    for (let y = y0; y <= y1; y++) c += mascara[y * w + x];
    return c / (y1 - y0 + 1);
  };

  // 3) maior faixa de linhas ativas, depois colunas dentro dela
  let [y0, y1] = maiorFaixa(h, (y) => atividadeLinha(y, 0, w - 1), 0.02, Math.ceil(h * 0.04));
  let [x0, x1] = maiorFaixa(w, (x) => atividadeColuna(x, y0, y1), 0.02, Math.ceil(w * 0.04));
  [y0, y1] = maiorFaixa(h, (y) => atividadeLinha(y, x0, x1), 0.02, Math.ceil(h * 0.04));
  if (y1 - y0 < h * 0.08 || x1 - x0 < w * 0.08) return null;

  // 4) expande enquanto ainda houver um pouco de movimento (partes quase paradas do vídeo)
  for (let passo = 0; passo < 2; passo++) {
    while (y0 > 0 && atividadeLinha(y0 - 1, x0, x1) > 0.006) y0--;
    while (y1 < h - 1 && atividadeLinha(y1 + 1, x0, x1) > 0.006) y1++;
    while (x0 > 0 && atividadeColuna(x0 - 1, y0, y1) > 0.006) x0--;
    while (x1 < w - 1 && atividadeColuna(x1 + 1, y0, y1) > 0.006) x1++;
  }

  // 5) encaixa cada borda na linha de maior contraste do frame médio (borda template/vídeo)
  const janelaY = Math.max(2, Math.round(h * 0.03));
  const janelaX = Math.max(2, Math.round(w * 0.03));
  const gradH = (y: number) => {
    // diferença entre a linha y e y-1 (borda horizontal), ao longo de x0..x1
    if (y <= 0 || y >= h) return 0;
    let s = 0;
    for (let x = x0; x <= x1; x++) s += Math.abs(media[y * w + x] - media[(y - 1) * w + x]);
    return s / (x1 - x0 + 1);
  };
  const gradV = (x: number) => {
    if (x <= 0 || x >= w) return 0;
    let s = 0;
    for (let y = y0; y <= y1; y++) s += Math.abs(media[y * w + x] - media[y * w + x - 1]);
    return s / (y1 - y0 + 1);
  };
  const topo = encaixar(y0, janelaY, 1, h - 1, gradH);
  const base = encaixar(y1 + 1, janelaY, 1, h - 1, gradH) - 1;
  const esq = encaixar(x0, janelaX, 1, w - 1, gradV);
  const dir = encaixar(x1 + 1, janelaX, 1, w - 1, gradV) - 1;
  if (base > topo + h * 0.08) {
    y0 = topo;
    y1 = base;
  }
  if (dir > esq + w * 0.08) {
    x0 = esq;
    x1 = dir;
  }
  if (y0 <= 1) y0 = 0;
  if (x0 <= 1) x0 = 0;
  if (y1 >= h - 2) y1 = h - 1;
  if (x1 >= w - 2) x1 = w - 1;

  return {
    rect: { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h },
    atividade: ativos / total,
  };
}

function percentil(hist: Uint32Array, total: number, p: number) {
  const alvo = total * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= alvo) return i;
  }
  return 255;
}

/** Maior sequência de índices com valor >= min, tolerando buracos de até `buraco` */
function maiorFaixa(tam: number, valor: (i: number) => number, min: number, buraco: number): [number, number] {
  let melhor: [number, number] = [0, tam - 1];
  let melhorPeso = -1;
  let ini = -1;
  let fim = -1;
  let peso = 0;
  let vazio = 0;
  for (let i = 0; i <= tam; i++) {
    const v = i < tam ? valor(i) : 0;
    if (i < tam && v >= min) {
      if (ini < 0) {
        ini = i;
        peso = 0;
      }
      fim = i;
      peso += v;
      vazio = 0;
    } else if (ini >= 0) {
      vazio++;
      if (vazio > buraco || i === tam) {
        if (peso > melhorPeso) {
          melhorPeso = peso;
          melhor = [ini, fim];
        }
        ini = -1;
        vazio = 0;
      }
    }
  }
  return melhor;
}

/** Procura, perto de `pos`, a posição com o maior gradiente; só troca se a borda for nítida */
function encaixar(pos: number, janela: number, min: number, max: number, grad: (i: number) => number) {
  let melhor = pos;
  let melhorG = 0;
  const valores: number[] = [];
  for (let i = Math.max(min, pos - janela); i <= Math.min(max, pos + janela); i++) {
    const g = grad(i);
    valores.push(g);
    if (g > melhorG) {
      melhorG = g;
      melhor = i;
    }
  }
  valores.sort((a, b) => a - b);
  const mediana = valores[Math.floor(valores.length / 2)] ?? 0;
  return melhorG > 6 && melhorG > mediana * 2 ? melhor : pos;
}

/**
 * Converte o resultado normalizado em px do vídeo e aplica as regras do original:
 * - sem detecção → recorte centralizado com margem de 5%  (FALLBACK)
 * - área > 90% do vídeo → usa o vídeo completo (não tem template)
 */
export function finalizarArea(
  r: ResultadoDeteccao | null,
  largura: number,
  altura: number,
): { area: Rect; origem: 'local' | 'margem' | 'completo' } {
  if (!r) {
    const mx = Math.round((largura * 0.05) / 2) * 2;
    const my = Math.round((altura * 0.05) / 2) * 2;
    return { area: { x: mx, y: my, w: largura - 2 * mx, h: altura - 2 * my }, origem: 'margem' };
  }
  let x = Math.round((r.rect.x * largura) / 2) * 2;
  let y = Math.round((r.rect.y * altura) / 2) * 2;
  let w = Math.round((r.rect.w * largura) / 2) * 2;
  let h = Math.round((r.rect.h * altura) / 2) * 2;
  x = Math.min(Math.max(0, x), largura - 16);
  y = Math.min(Math.max(0, y), altura - 16);
  w = Math.min(w, largura - x);
  h = Math.min(h, altura - y);
  if (w * h > largura * altura * 0.9) return { area: { x: 0, y: 0, w: largura, h: altura }, origem: 'completo' };
  return { area: { x, y, w, h }, origem: 'local' };
}

/** Instantes (s) dos frames amostrados — evita o começo/fim (vinhetas, telas pretas) */
export function instantesAmostra(duracao: number, n = 16): number[] {
  const d = Math.max(0.2, duracao);
  const ini = d * 0.05;
  const fim = d * 0.95;
  return Array.from({ length: n }, (_, i) => ini + ((fim - ini) * i) / (n - 1));
}
