// Tipos compartilhados entre o navegador (UI / preview) e o servidor (fila FFmpeg).
// Os nomes seguem os rótulos do Editor Automa Dark original.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Lados {
  topo: number;
  base: number;
  esq: number;
  dir: number;
}

export type Qualidade = 480 | 720 | 1080;
export type Alinhamento = 'left' | 'center' | 'right';

export interface EstiloTexto {
  fonte: string;
  tamanho: number; // px com base em canvas de 1080 de largura
  cor: string;
  negrito: boolean;
  italico: boolean;
  alinhamento: Alinhamento;
  opacidade: number; // 0-100
  contorno: { ativo: boolean; cor: string; largura: number };
  sombra: { ativo: boolean; cor: string; opacidade: number; distancia: number; blur: number };
  fundo: { ativo: boolean; cor: string };
  /** Caixa do texto em % do canvas (X, Y, Larg, Alt) */
  posicao: Rect;
  /** Texto todo em maiúsculas (vem do template) */
  maiusculas?: boolean;
  /** Peso da fonte quando negrito (700 padrão; o título do template usa 900) */
  peso?: number;
  /** Tira os emojis do texto (opção "Emojis no título" do estúdio antigo desligada) */
  semEmojis?: boolean;
}

/** Marca d'água do template Clipost: pílula dentro do vídeo */
export interface MarcaTemplate {
  texto: string;
  opacidade: number; // 0-100
  posicao: 'center' | 'bottom_center' | 'top_right' | 'top_left';
  /** URL de imagem (marca em imagem) ou null para texto */
  imagem: string | null;
}

export interface MarcaDagua {
  texto: string;
  cor: string;
  fonte: string;
  fundoAtivo: boolean;
  corFundo: string;
  tamanho: number; // px (base 1080 de largura)
  posX: number; // px (base 1080 de largura)
  posY: number; // px (base 1080 de largura)
  opacidade: number; // 0-100
}

export type ModoDeteccao = 'auto' | 'margem' | 'nenhuma';

export interface ConfigGlobal {
  // ⚙ Básico
  pixelsParaDescer: number;
  corBorda: string;
  qualidade: Qualidade;
  semBordas: boolean;
  /** Original: a área abaixo de "pixels para descer" é preenchida com a cor da borda (pad do FFmpeg). */
  preencherArea: boolean;
  alinhamentoVertical: 'topo' | 'centro';
  moldura: { ativo: boolean; largura: number; altura: number; cor: string };
  melhorarAudio: boolean;
  antiDup: boolean;
  antiDupNivel: 'leve' | 'forte';
  removerMetadados: boolean;
  textoAtivo: boolean;
  estiloTexto: EstiloTexto;
  musica: {
    ativo: boolean;
    musicaId: string | null;
    inicio: number;
    volumeMusica: number; // 0-200 (%)
    volumeVideo: number; // 0-200 (%)
    mutarOriginal: boolean;
  };
  // ✨ Efeitos
  efeitos: {
    espelhar: boolean;
    cortarInicioFim: boolean; // 0.5s em cada ponta
    ajusteAutomatico: boolean;
    velocidade105: boolean;
    velocidadePersonalizada: boolean;
    velocidade: number; // 0.5 - 2.0
    /** Tira as pausas sem fala (função do estúdio antigo) */
    removerSilencio?: boolean;
  };
  // 💧 Marca
  marcaAtiva: boolean;
  marca: MarcaDagua;
  // Detecção / remoção do template antigo
  deteccao: { modo: ModoDeteccao; cortarTexto: boolean };

  // Template Clipost (vem do editor de Templates)
  /** 'template' = vídeo preenche o quadro de vídeo do template; 'video' = solto, no formato do próprio vídeo */
  encaixe: 'template' | 'video';
  /** Quadro de vídeo do template, px do canvas. null = sem template Clipost (usa "pixels para descer") */
  areaTemplate: Rect | null;
  /** Espaço no topo: desloca o topo do quadro de vídeo (px do canvas) */
  espacoTopo: number;
  /** Raio dos cantos arredondados do vídeo (px do canvas, 0 = reto) */
  cantos: number;
  marcaTemplate: MarcaTemplate | null;
  /** O usuário mexeu no tamanho/posição do texto: o template não sobrescreve mais */
  textoAjustado: boolean;
  /** Legendas automáticas (transcrição no backend, queimadas no FFmpeg) */
  legendas?: { ativo: boolean; preset: string; posicaoY: number };
}

export interface ConfigVideo {
  id: string;
  nome: string;
  arquivoId?: string; // id do upload no servidor
  largura: number;
  altura: number;
  duracao: number;
  /** Área do vídeo "de verdade" dentro do arquivo (sem template antigo), em px do vídeo de origem */
  areaDetectada: Rect | null;
  origemDeteccao?: 'local' | 'roboflow' | 'margem' | 'completo' | 'manual';
  /** ✂ Recortar (botões ↑↓←→ da 1ª linha): recorte extra na ORIGEM, px do vídeo */
  recorte: Lados;
  /** 🔲 VCrop (botões da 2ª linha): recorte no vídeo já posicionado, px do template */
  vcrop: Lados;
  /** Aba Editor → Posição do Vídeo */
  posicao: { x: number; y: number; escala: number };
  espelhar: boolean; // XOR com o espelhar global (igual ao original: mirror_final)
  semBordas: boolean | null; // null = usa o global
  mudo: boolean;
  texto: string;
  marcasExtras: MarcaDagua[]; // "Marca d'água individual" (máx. 3 no total)
  corte: { inicio: number; fim: number } | null;
  musica: { musicaId: string; inicio: number } | null;
  /** Corte vindo do Criar Cortes: o vídeo já tem a marca d'água do template dentro (não desenha de novo) */
  marcaEmbutida?: boolean;
}

export interface VideoJob extends ConfigVideo {
  arquivoId: string;
  overlayArquivoId: string | null; // PNG com texto + marcas gerado no navegador
}

export interface CriarJobPayload {
  global: ConfigGlobal;
  templateArquivoId: string | null;
  musicas: Record<string, string>; // musicaId -> arquivoId
  videos: VideoJob[];
  nomeAba?: string;
}

export type StatusItem = 'fila' | 'detectando' | 'processando' | 'ok' | 'erro' | 'cancelado';
export type StatusJob = 'fila' | 'processando' | 'pausado' | 'concluido' | 'cancelado' | 'erro';

export interface ItemJobInfo {
  id: string;
  nome: string;
  status: StatusItem;
  progresso: number; // 0-1
  saida: string | null;
  erro: string | null;
}

export interface JobInfo {
  id: string;
  status: StatusJob;
  criadoEm: number;
  itens: ItemJobInfo[];
  log: string[];
}
