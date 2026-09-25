import type { ConfigGlobal, ConfigVideo, MarcaDagua } from './types';

// Valores padrão tirados da tela do Editor Automa Dark v1.0.10

export const FONTES = [
  'Arial',
  'Impact',
  'Verdana',
  'Tahoma',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Courier New',
  'Comic Sans MS',
  'Montserrat',
  'Roboto',
  'Oswald',
  'Open Sans',
  'Poppins',
  'Bebas Neue',
];

/** Fontes que vêm do Google Fonts (as outras são do sistema) */
export const FONTES_GOOGLE = ['Montserrat', 'Roboto', 'Oswald', 'Open Sans', 'Poppins', 'Bebas Neue'];

export const CORES: { nome: string; hex: string }[] = [
  { nome: 'Branco', hex: '#FFFFFF' },
  { nome: 'Preto', hex: '#000000' },
  { nome: 'Cinza Claro', hex: '#D3D3D3' },
  { nome: 'Cinza Escuro', hex: '#404040' },
  { nome: 'Vermelho', hex: '#FF0000' },
  { nome: 'Amarelo', hex: '#FFFF00' },
  { nome: 'Laranja', hex: '#FFA500' },
  { nome: 'Rosa', hex: '#FFC0CB' },
  { nome: 'Ciano', hex: '#00FFFF' },
  { nome: 'Roxo', hex: '#800080' },
  { nome: 'Verde', hex: '#00FF00' },
  { nome: 'Azul', hex: '#0000FF' },
];

export const FORMATOS_MOLDURA = [
  { nome: '9:16 Story (1080×1920)', largura: 1080, altura: 1920 },
  { nome: '1:1 Quadrado (1080×1080)', largura: 1080, altura: 1080 },
  { nome: '4:5 Feed (1080×1350)', largura: 1080, altura: 1350 },
  { nome: '16:9 Paisagem (1920×1080)', largura: 1920, altura: 1080 },
];

export const MAX_MARCAS = 3;

/** Presets de legenda (mesmos ids do backend: services/subtitle_generator.py) — cores só para o preview */
export const PRESETS_LEGENDA: { id: string; nome: string; texto: string; caixa?: string; destaque?: string; umaPalavra?: boolean }[] = [
  { id: 'hormozi_yellow', nome: 'Hormozi Amarelo', texto: '#000000', caixa: '#facc15' },
  { id: 'hormozi_orange', nome: 'Hormozi Laranja', texto: '#ffffff', caixa: '#ea580c' },
  { id: 'clean_white', nome: 'Caixa Branca', texto: '#09090b', caixa: '#ffffff' },
  { id: 'dark_box', nome: 'Caixa Escura', texto: '#f97316', caixa: '#18181b' },
  { id: 'karaoke_amarelo', nome: 'Karaokê Amarelo', texto: '#ffffff', destaque: '#facc15' },
  { id: 'karaoke_roxo', nome: 'Karaokê Roxo', texto: '#ffffff', destaque: '#a855f7' },
  { id: 'palavra_unica', nome: 'Palavra Única', texto: '#facc15', umaPalavra: true },
  { id: 'revelacao', nome: 'Revelação', texto: '#ffffff' },
  { id: 'pop_branco', nome: 'Pop Branco', texto: '#ffffff' },
  { id: 'caixa_pop', nome: 'Caixa Pop', texto: '#000000', caixa: '#facc15' },
  { id: 'neon_cyan', nome: 'Neon Ciano', texto: '#22d3ee' },
  { id: 'neon_magenta', nome: 'Neon Rosa', texto: '#f472b6' },
  { id: 'fade_suave', nome: 'Suave', texto: '#f4f4f5' },
];

export function marcaPadrao(): MarcaDagua {
  return {
    texto: '',
    cor: '#FFFFFF',
    fonte: 'Arial',
    fundoAtivo: false,
    corFundo: '#000000',
    tamanho: 36,
    posX: 25,
    posY: 800,
    opacidade: 100,
  };
}

export function configGlobalPadrao(): ConfigGlobal {
  return {
    pixelsParaDescer: 60,
    corBorda: '#FFFFFF',
    qualidade: 1080,
    semBordas: false,
    preencherArea: true,
    alinhamentoVertical: 'topo',
    moldura: { ativo: false, largura: 1080, altura: 1920, cor: '#000000' },
    melhorarAudio: false,
    antiDup: false,
    antiDupNivel: 'leve',
    removerMetadados: true,
    textoAtivo: false,
    estiloTexto: {
      fonte: 'Arial',
      tamanho: 40,
      cor: '#FFFFFF',
      negrito: true,
      italico: false,
      alinhamento: 'center',
      opacidade: 100,
      contorno: { ativo: false, cor: '#000000', largura: 3 },
      sombra: { ativo: false, cor: '#000000', opacidade: 60, distancia: 4, blur: 4 },
      fundo: { ativo: false, cor: '#000000' },
      posicao: { x: 6, y: 25, w: 88, h: 9 },
    },
    musica: {
      ativo: false,
      musicaId: null,
      inicio: 0,
      volumeMusica: 30,
      volumeVideo: 100,
      mutarOriginal: false,
    },
    efeitos: {
      espelhar: false,
      cortarInicioFim: false,
      ajusteAutomatico: false,
      velocidade105: false,
      velocidadePersonalizada: false,
      velocidade: 1,
    },
    marcaAtiva: false,
    marca: marcaPadrao(),
    deteccao: { modo: 'auto', cortarTexto: true },
    encaixe: 'template',
    areaTemplate: null,
    espacoTopo: 0,
    cantos: 0,
    marcaTemplate: null,
    textoAjustado: false,
    legendas: { ativo: false, preset: 'hormozi_yellow', posicaoY: 75 },
  };
}

/** Completa uma config salva (localStorage) com os campos que surgiram depois */
export function completarConfig(salva: Partial<ConfigGlobal> | null | undefined): ConfigGlobal {
  const p = configGlobalPadrao();
  if (!salva) return p;
  return {
    ...p,
    ...salva,
    estiloTexto: { ...p.estiloTexto, ...(salva.estiloTexto ?? {}) },
    musica: { ...p.musica, ...(salva.musica ?? {}) },
    efeitos: { ...p.efeitos, ...(salva.efeitos ?? {}) },
    marca: { ...p.marca, ...(salva.marca ?? {}) },
    moldura: { ...p.moldura, ...(salva.moldura ?? {}) },
    deteccao: { ...p.deteccao, ...(salva.deteccao ?? {}) },
    legendas: { ...p.legendas!, ...(salva.legendas ?? {}) },
  };
}

export function novoVideo(p: { id: string; nome: string; largura: number; altura: number; duracao: number }): ConfigVideo {
  return {
    ...p,
    areaDetectada: null,
    recorte: { topo: 0, base: 0, esq: 0, dir: 0 },
    vcrop: { topo: 0, base: 0, esq: 0, dir: 0 },
    posicao: { x: 0, y: 0, escala: 100 },
    espelhar: false,
    semBordas: null,
    mudo: false,
    texto: '',
    marcasExtras: [],
    corte: null,
    musica: null,
  };
}
