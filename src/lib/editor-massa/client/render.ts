import { calcularLayout, type Canvas } from '../layout';
import type { ConfigGlobal, ConfigVideo, EstiloTexto, MarcaDagua } from '../types';
import { MAX_MARCAS } from '../defaults';

// Desenho no navegador. O MESMO código faz:
//  - o preview (canvas na tela)
//  - as miniaturas dos cards
//  - o PNG transparente de texto + marca d'água enviado ao servidor (igual ao _txtoverlay_.png do original)

export interface FonteQuadro {
  imagem: CanvasImageSource;
  largura: number; // dimensões da imagem/quadro
  altura: number;
}

function rgba(hex: string, alfa: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

function fonteCss(fonte: string, px: number, negrito: boolean, italico: boolean) {
  return `${italico ? 'italic ' : ''}${negrito ? 'bold ' : ''}${Math.max(1, px).toFixed(1)}px "${fonte}", Arial, sans-serif`;
}

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/)) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) {
      linhas.push('');
      continue;
    }
    let atual = '';
    for (let p of palavras) {
      // palavra maior que a caixa: quebra por caractere
      while (ctx.measureText(p).width > larguraMax && p.length > 1) {
        let i = p.length - 1;
        while (i > 1 && ctx.measureText(p.slice(0, i)).width > larguraMax) i--;
        if (atual) {
          linhas.push(atual);
          atual = '';
        }
        linhas.push(p.slice(0, i));
        p = p.slice(i);
      }
      const teste = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(teste).width <= larguraMax || !atual) atual = teste;
      else {
        linhas.push(atual);
        atual = p;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** px "base 1080" → px no alvo */
function escalaBase(canvas: Canvas, alvo: Canvas) {
  const k = alvo.w / canvas.w;
  return (Math.min(canvas.w, canvas.h) / 1080) * k;
}

function desenharTexto(ctx: CanvasRenderingContext2D, texto: string, e: EstiloTexto, canvas: Canvas, alvo: Canvas) {
  if (!texto.trim()) return;
  const px = e.tamanho * escalaBase(canvas, alvo);
  const k = alvo.w / canvas.w;
  const caixa = {
    x: (e.posicao.x / 100) * alvo.w,
    y: (e.posicao.y / 100) * alvo.h,
    w: Math.max(10, (e.posicao.w / 100) * alvo.w),
    h: (e.posicao.h / 100) * alvo.h,
  };
  ctx.save();
  ctx.font = fonteCss(e.fonte, px, e.negrito, e.italico);
  ctx.textBaseline = 'middle';
  ctx.textAlign = e.alinhamento;
  ctx.globalAlpha = Math.max(0, Math.min(1, e.opacidade / 100));
  const linhas = quebrarLinhas(ctx, texto, caixa.w);
  const altLinha = px * 1.22;
  const altBloco = linhas.length * altLinha;
  const y0 = altBloco <= caixa.h ? caixa.y + (caixa.h - altBloco) / 2 : caixa.y;
  const xTexto = e.alinhamento === 'left' ? caixa.x : e.alinhamento === 'right' ? caixa.x + caixa.w : caixa.x + caixa.w / 2;

  if (e.fundo.ativo) {
    const pad = px * 0.28;
    ctx.fillStyle = e.fundo.cor;
    linhas.forEach((l, i) => {
      if (!l) return;
      const w = ctx.measureText(l).width;
      const x = e.alinhamento === 'left' ? xTexto : e.alinhamento === 'right' ? xTexto - w : xTexto - w / 2;
      caixaArredondada(ctx, x - pad, y0 + i * altLinha - pad * 0.3, w + pad * 2, altLinha + pad * 0.6, px * 0.2);
      ctx.fill();
    });
  }
  if (e.sombra.ativo) {
    ctx.shadowColor = rgba(e.sombra.cor, e.sombra.opacidade / 100);
    ctx.shadowOffsetX = e.sombra.distancia * k;
    ctx.shadowOffsetY = e.sombra.distancia * k;
    ctx.shadowBlur = e.sombra.blur * k;
  }
  linhas.forEach((l, i) => {
    const y = y0 + i * altLinha + altLinha / 2;
    if (e.contorno.ativo && e.contorno.largura > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = e.contorno.largura * 2 * escalaBase(canvas, alvo);
      ctx.strokeStyle = e.contorno.cor;
      ctx.strokeText(l, xTexto, y);
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = e.cor;
    ctx.fillText(l, xTexto, y);
  });
  ctx.restore();
}

function desenharMarca(ctx: CanvasRenderingContext2D, m: MarcaDagua, canvas: Canvas, alvo: Canvas) {
  if (!m.texto.trim()) return;
  const k = alvo.w / canvas.w;
  const px = m.tamanho * escalaBase(canvas, alvo);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, m.opacidade / 100));
  ctx.font = fonteCss(m.fonte, px, false, false);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const x = m.posX * k;
  const y = m.posY * k;
  if (m.fundoAtivo) {
    const w = ctx.measureText(m.texto).width;
    const pad = px * 0.25;
    ctx.fillStyle = m.corFundo;
    caixaArredondada(ctx, x - pad, y - pad, w + pad * 2, px * 1.15 + pad * 2, px * 0.2);
    ctx.fill();
  }
  ctx.fillStyle = m.cor;
  ctx.fillText(m.texto, x, y);
  ctx.restore();
}

export function marcasDoVideo(global: ConfigGlobal, v: ConfigVideo): MarcaDagua[] {
  return [...(global.marcaAtiva ? [global.marca] : []), ...v.marcasExtras].filter((m) => m.texto.trim()).slice(0, MAX_MARCAS);
}

export function temOverlay(global: ConfigGlobal, v: ConfigVideo) {
  return (global.textoAtivo && !!v.texto.trim()) || marcasDoVideo(global, v).length > 0;
}

/** Texto + marcas d'água, desenhados no tamanho `alvo` (o canvas de trabalho vira `alvo`) */
export function desenharOverlay(ctx: CanvasRenderingContext2D, global: ConfigGlobal, v: ConfigVideo, canvas: Canvas, alvo: Canvas) {
  if (global.textoAtivo) desenharTexto(ctx, v.texto, global.estiloTexto, canvas, alvo);
  marcasDoVideo(global, v).forEach((m) => desenharMarca(ctx, m, canvas, alvo));
}

/** Composição completa (template + vídeo + texto) no tamanho `alvo` — usado no preview e nas miniaturas */
export function desenharComposicao(
  ctx: CanvasRenderingContext2D,
  global: ConfigGlobal,
  v: ConfigVideo,
  template: HTMLImageElement | ImageBitmap | null,
  quadro: FonteQuadro | null,
  alvo: Canvas,
) {
  const tpl = template && !global.moldura.ativo ? { w: template.width, h: template.height } : null;
  const L = calcularLayout(global, v, tpl);
  const k = alvo.w / L.canvas.w;

  ctx.save();
  ctx.clearRect(0, 0, alvo.w, alvo.h);
  if (global.moldura.ativo) {
    ctx.fillStyle = global.moldura.cor;
    ctx.fillRect(0, 0, alvo.w, alvo.h);
  } else if (template) {
    ctx.drawImage(template, 0, 0, alvo.w, alvo.h);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, alvo.w, alvo.h);
  }
  if (L.preenchimento) {
    ctx.fillStyle = global.corBorda;
    ctx.fillRect(L.preenchimento.x * k, L.preenchimento.y * k, L.preenchimento.w * k, L.preenchimento.h * k);
  }
  if (quadro) {
    const ex = quadro.largura / v.largura;
    const ey = quadro.altura / v.altura;
    const o = L.origem;
    const d = L.destino;
    ctx.imageSmoothingQuality = 'high';
    if (L.espelhar) {
      ctx.save();
      ctx.translate((d.x + d.w) * k, d.y * k);
      ctx.scale(-1, 1);
      ctx.drawImage(quadro.imagem, o.x * ex, o.y * ey, o.w * ex, o.h * ey, 0, 0, d.w * k, d.h * k);
      ctx.restore();
    } else {
      ctx.drawImage(quadro.imagem, o.x * ex, o.y * ey, o.w * ex, o.h * ey, d.x * k, d.y * k, d.w * k, d.h * k);
    }
  }
  desenharOverlay(ctx, global, v, L.canvas, alvo);
  ctx.restore();
  return L;
}

/** Gera o PNG transparente (texto + marcas) no tamanho final de saída. null = nada a desenhar */
export async function gerarOverlayPng(global: ConfigGlobal, v: ConfigVideo, template: Canvas | null): Promise<Blob | null> {
  if (!temOverlay(global, v)) return null;
  const L = calcularLayout(global, v, global.moldura.ativo ? null : template);
  const c = document.createElement('canvas');
  c.width = L.saida.w;
  c.height = L.saida.h;
  const ctx = c.getContext('2d')!;
  desenharOverlay(ctx, global, v, L.canvas, L.saida);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
