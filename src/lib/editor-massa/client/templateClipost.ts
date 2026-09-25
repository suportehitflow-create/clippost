import type { EstiloTexto, MarcaTemplate, Rect } from '../types';
import { registrarImagem } from './render';

// Template Clipost (o mesmo do editor de Templates / brand kit) desenhado no navegador.
// Segue as mesmas regras do backend (backend/services/template_overlay.py): o celular do
// editor tem 324px de largura, então px do editor × (1080 / 324); posições em % do canvas.
//
// - Imagem de fundo 1080×1920: cor/imagem de fundo + perfil (foto, nome, selo, @)
// - O título vira o estilo do texto em massa; a marca d'água vira a pílula dentro do vídeo

export const LARGURA = 1080;
export const ALTURA = 1920;
const S = LARGURA / 324;

export type FundoTemplate = 'dark' | 'white' | 'gray';

export interface TemplateClipost {
  /** layout_config do brand kit */
  config: Record<string, any>;
  avatarUrl: string | null;
  username: string | null;
}

/** Mesmos padrões do editor de Templates (modelo "Corte padrão") */
const PADRAO: Record<string, any> = {
  templateBg: 'dark',
  brandName: 'Nome da Página',
  brandHandle: '@nomedapagina',
  showVerifiedBadge: true,
  brandScale: 14,
  brandAlign: 'center',
  brandLayout: 'inline',
  headerPos: { x: 50, y: 16 },
  titlePos: { x: 50, y: 24 },
  videoPos: { x: 50, y: 52 },
  videoWidth: 92,
  videoHeight: 48,
  videoRounded: true,
  fontFamily: "'Instagram Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif",
  fontSize: 14,
  textAlign: 'center',
  titleColor: '#ffffff',
  titleStroke: 'none',
  titleStrokeColor: '#000000',
  titleCapsLock: true,
  showWatermark: true,
  watermarkOpacity: 45,
  watermarkPosition: 'bottom_center',
  watermarkType: 'text',
};

const cfg = (t: TemplateClipost) => ({ ...PADRAO, ...(t.config || {}) });

export async function carregarTemplateClipost(): Promise<TemplateClipost> {
  try {
    const r = await fetch('/api/brand-kit', { cache: 'no-store' });
    if (r.ok) {
      const { brand_kit: bk } = await r.json();
      if (bk?.layout_config && Object.keys(bk.layout_config).length) {
        return { config: bk.layout_config, avatarUrl: bk.avatar_url ?? null, username: bk.username ?? null };
      }
    }
  } catch {
    // sem rede / sem login → tenta o que o editor de Templates deixou no navegador
  }
  try {
    const p = JSON.parse(localStorage.getItem('clippost_active_template') || 'null');
    if (p?.config) return { config: p.config, avatarUrl: p.avatar_url ?? null, username: null };
  } catch {
    // ignora
  }
  return { config: {}, avatarUrl: null, username: null };
}

/** Salva o template (edições rápidas feitas dentro do editor em massa) no brand kit */
export async function salvarTemplateClipost(t: TemplateClipost): Promise<boolean> {
  const c = cfg(t);
  try {
    localStorage.setItem('clippost_template_config', JSON.stringify(t.config));
    const atual = JSON.parse(localStorage.getItem('clippost_active_template') || 'null');
    if (atual) localStorage.setItem('clippost_active_template', JSON.stringify({ ...atual, config: t.config, template_bg: c.templateBg }));
  } catch {
    // ignora
  }
  try {
    const r = await fetch('/api/brand-kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatar_url: t.avatarUrl && !t.avatarUrl.startsWith('blob:') ? t.avatarUrl : undefined,
        username: c.brandHandle || t.username,
        layout_config: t.config,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function fundoDoTemplate(t: TemplateClipost): FundoTemplate {
  const bg = cfg(t).templateBg;
  return bg === 'white' ? 'white' : bg === 'gray' || bg === 'zinc' ? 'gray' : 'dark';
}

const COR_FUNDO: Record<FundoTemplate, string> = { dark: '#000000', white: '#ffffff', gray: '#18181b' };

/** Quadro de vídeo do template em px do canvas 1080×1920 */
export function areaVideoTemplate(t: TemplateClipost): Rect {
  const c = cfg(t);
  const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const w = Math.min(LARGURA, par((LARGURA * Number(c.videoWidth || 92)) / 100));
  const h = Math.min(ALTURA, par((ALTURA * Number(c.videoHeight || 48)) / 100));
  const px = Number(c.videoPos?.x ?? 50);
  const py = Number(c.videoPos?.y ?? 52);
  const x = Math.max(0, Math.min(LARGURA - w, Math.round((LARGURA * px) / 100 - w / 2)));
  const y = Math.max(0, Math.min(ALTURA - h, Math.round((ALTURA * py) / 100 - h / 2)));
  return { x: x - (x % 2), y: y - (y % 2), w, h };
}

export function cantosDoTemplate(t: TemplateClipost): number {
  return cfg(t).videoRounded ? Math.round(16 * S) : 0;
}

/** Estilo do título do template aplicado ao texto em massa. Tamanho/posição só se o usuário não mexeu. */
export function estiloDoTemplate(t: TemplateClipost, atual: EstiloTexto, manterAjustes: boolean): EstiloTexto {
  const c = cfg(t);
  const claro = fundoDoTemplate(t) === 'white';
  let cor = String(c.titleColor || '#ffffff');
  if (claro && /^#?f{3}(f{3})?$/i.test(cor.replace('#', ''))) cor = '#000000';
  const traco = ({ thin: 1, medium: 2, thick: 3 } as Record<string, number>)[c.titleStroke] ?? 0;
  const tx = Number(c.titlePos?.x ?? 50);
  const ty = Number(c.titlePos?.y ?? 24);
  return {
    ...atual,
    fonte: String(c.fontFamily || PADRAO.fontFamily),
    cor,
    negrito: true,
    peso: 900,
    italico: false,
    alinhamento: c.textAlign === 'left' || c.textAlign === 'right' ? c.textAlign : 'center',
    maiusculas: c.titleCapsLock !== false,
    contorno: { ativo: traco > 0, cor: String(c.titleStrokeColor || '#000000'), largura: traco * S },
    sombra: { ...atual.sombra, ativo: false },
    fundo: { ...atual.fundo, ativo: false },
    ...(manterAjustes
      ? {}
      : {
          tamanho: Math.round(Number(c.fontSize || 14) * S),
          posicao: { x: tx - 44, y: ty - 7, w: 88, h: 14 },
        }),
  };
}

/** Preset e altura das legendas definidos no editor de Templates */
export function legendaDoTemplate(t: TemplateClipost): { preset: string; posicaoY: number } {
  const c = cfg(t);
  const y = Number(c.subtitlePos?.y ?? 75);
  return { preset: String(c.subtitle_preset || 'hormozi_yellow'), posicaoY: Math.max(20, Math.min(92, Number.isFinite(y) ? y : 75)) };
}

export function marcaDoTemplate(t: TemplateClipost): MarcaTemplate | null {
  const c = cfg(t);
  if (c.showWatermark === false) return null;
  const op = Number(c.watermarkOpacity ?? 45);
  const imagem = c.watermarkType === 'image' && c.watermarkImage ? String(c.watermarkImage) : null;
  const texto = String(c.watermarkText || c.brandHandle || t.username || '').trim();
  if (!imagem && !texto) return null;
  return {
    texto,
    opacidade: op <= 1 ? op * 100 : op,
    posicao: ['center', 'bottom_center', 'top_right', 'top_left'].includes(c.watermarkPosition) ? c.watermarkPosition : 'bottom_center',
    imagem,
  };
}

// ---------------- desenho do fundo + perfil ----------------

function carregarCors(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url || url.startsWith('blob:')) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/** Pré-carrega a imagem da marca d'água; sem ela a marca cai para texto */
export async function prepararMarca(m: MarcaTemplate | null): Promise<MarcaTemplate | null> {
  if (!m?.imagem) return m;
  const img = await carregarCors(m.imagem);
  if (img) {
    registrarImagem(m.imagem, img);
    return m;
  }
  return m.texto ? { ...m, imagem: null } : null;
}

function reticencias(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function avatarPadrao(ctx: CanvasRenderingContext2D, x: number, y: number, d: number) {
  const g = ctx.createLinearGradient(x, y, x + d, y + d);
  g.addColorStop(0, '#6366f1');
  g.addColorStop(0.5, '#8b5cf6');
  g.addColorStop(1, '#ec4899');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, d, d);
  const u = d / 120;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(x + 60 * u, y + 49 * u, 15 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 40 * u, y + 88 * u);
  ctx.bezierCurveTo(x + 40 * u, y + 73 * u, x + 50 * u, y + 68 * u, x + 60 * u, y + 68 * u);
  ctx.bezierCurveTo(x + 70 * u, y + 68 * u, x + 80 * u, y + 73 * u, x + 80 * u, y + 88 * u);
  ctx.closePath();
  ctx.fill();
}

function desenharSelo(ctx: CanvasRenderingContext2D, x: number, y: number, tam: number) {
  ctx.save();
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2);
  ctx.fill();
  const u = tam / 24;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 2.4 * u);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 7 * u, y + 12.3 * u);
  ctx.lineTo(x + 10.3 * u, y + 15.6 * u);
  ctx.lineTo(x + 17 * u, y + 8.6 * u);
  ctx.stroke();
  ctx.restore();
}

const FONTE_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function desenharPerfil(ctx: CanvasRenderingContext2D, t: TemplateClipost, avatar: HTMLImageElement | null) {
  const c = cfg(t);
  const claro = fundoDoTemplate(t) === 'white';
  const esc = Number(c.brandScale || 14);
  const empilhado = c.brandLayout === 'stacked';
  const alinhar: string = c.brandAlign || 'center';

  const d = Math.round(esc * 2.85 * S);
  const gap = Math.max(6, Math.round(esc * 0.65)) * S;
  const fonteNome = `bold ${(esc * S).toFixed(1)}px ${FONTE_UI}`;
  const pxArroba = Math.max(9, Math.round(esc * 0.75)) * S;
  const fonteArroba = `500 ${pxArroba.toFixed(1)}px ${FONTE_UI}`;
  const tamSelo = Math.round(Math.max(10, Math.round(esc * 0.85)) * S);
  const selo = c.showVerifiedBadge !== false;

  const margem = 20 * S;
  const maxTexto = LARGURA - 2 * margem - (empilhado ? 0 : d + gap);
  const espacoSelo = selo ? 6 * S + tamSelo : 0;

  ctx.font = fonteNome;
  const nome = reticencias(ctx, String(c.brandName || ''), maxTexto - espacoSelo);
  const larguraNome = ctx.measureText(nome).width + espacoSelo;
  ctx.font = fonteArroba;
  const arroba = reticencias(ctx, String(c.brandHandle || t.username || ''), maxTexto);
  const larguraArroba = ctx.measureText(arroba).width;

  const altNome = esc * S * 1.375;
  const altArroba = arroba ? pxArroba * 1.25 : 0;
  const larguraTexto = Math.max(larguraNome, larguraArroba);
  const altTexto = altNome + altArroba;
  const blocoW = empilhado ? Math.max(d, larguraTexto) : d + gap + larguraTexto;
  const blocoH = empilhado ? d + gap + altTexto : Math.max(d, altTexto);

  const cy = (ALTURA * Number(c.headerPos?.y ?? 16)) / 100;
  const x0 = alinhar === 'left' ? margem : alinhar === 'right' ? LARGURA - margem - blocoW : (LARGURA - blocoW) / 2;
  const y0 = cy - blocoH / 2;

  // foto redonda com borda
  const ax = empilhado ? x0 + (blocoW - d) / 2 : x0;
  const ay = empilhado ? y0 : y0 + (blocoH - d) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + d / 2, ay + d / 2, d / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    const lado = Math.min(avatar.naturalWidth, avatar.naturalHeight) || 1;
    ctx.drawImage(avatar, (avatar.naturalWidth - lado) / 2, (avatar.naturalHeight - lado) / 2, lado, lado, ax, ay, d, d);
  } else {
    avatarPadrao(ctx, ax, ay, d);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax + d / 2, ay + d / 2, d / 2 - S, 0, Math.PI * 2);
  ctx.lineWidth = 2 * S;
  ctx.strokeStyle = claro ? '#d4d4d8' : 'rgba(255,255,255,0.6)';
  ctx.stroke();

  // nome + selo + @
  const tx0 = empilhado ? x0 + (blocoW - larguraTexto) / 2 : x0 + d + gap;
  const ty0 = empilhado ? y0 + d + gap : y0 + (blocoH - altTexto) / 2;
  const alinhTexto = empilhado ? 'center' : alinhar;
  const linhaX = (w: number) => (alinhTexto === 'center' ? tx0 + (larguraTexto - w) / 2 : alinhTexto === 'right' ? tx0 + larguraTexto - w : tx0);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = fonteNome;
  ctx.fillStyle = claro ? '#09090b' : '#ffffff';
  const nx = linhaX(larguraNome);
  ctx.fillText(nome, nx, ty0 + altNome / 2);
  if (selo) desenharSelo(ctx, nx + ctx.measureText(nome).width + 6 * S, ty0 + (altNome - tamSelo) / 2, tamSelo);
  if (arroba) {
    ctx.font = fonteArroba;
    ctx.fillStyle = claro ? '#52525b' : '#a1a1aa';
    ctx.fillText(arroba, linhaX(larguraArroba), ty0 + altNome + altArroba / 2);
  }
}

function desenharFundo(ctx: CanvasRenderingContext2D, t: TemplateClipost, bg: HTMLImageElement | null) {
  ctx.fillStyle = COR_FUNDO[fundoDoTemplate(t)];
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  if (bg) {
    const e = Math.max(LARGURA / bg.naturalWidth, ALTURA / bg.naturalHeight);
    const w = bg.naturalWidth * e;
    const h = bg.naturalHeight * e;
    ctx.drawImage(bg, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);
  }
}

/** PNG 1080×1920 do fundo do template (cor/imagem + perfil). O vídeo entra por cima, no quadro. */
export async function gerarImagemTemplate(t: TemplateClipost): Promise<Blob> {
  const c = cfg(t);
  const [avatar, bg] = await Promise.all([carregarCors(t.avatarUrl), carregarCors(c.customBgImage)]);
  await document.fonts?.ready.catch(() => null);

  const tela = document.createElement('canvas');
  tela.width = LARGURA;
  tela.height = ALTURA;
  const ctx = tela.getContext('2d')!;
  const gerar = () => new Promise<Blob | null>((res) => tela.toBlob((b) => res(b), 'image/png'));

  desenharFundo(ctx, t, bg);
  desenharPerfil(ctx, t, avatar);
  try {
    const b = await gerar();
    if (b) return b;
  } catch {
    // alguma imagem sem CORS "sujou" o canvas: redesenha sem as imagens externas
  }
  ctx.clearRect(0, 0, LARGURA, ALTURA);
  desenharFundo(ctx, t, null);
  desenharPerfil(ctx, t, null);
  const b = await gerar();
  if (!b) throw new Error('Não foi possível gerar a imagem do template');
  return b;
}
