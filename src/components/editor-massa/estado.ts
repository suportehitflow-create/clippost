import type { ConfigVideo, StatusItem } from '@/lib/editor-massa/types';

// Estado do lado do navegador (arquivos locais, uploads, miniaturas, progresso)

export interface VideoCliente extends ConfigVideo {
  arquivo: File;
  url: string; // object URL local
  upload: number; // 0-1
  uploadErro: string | null;
  quadro: ImageBitmap | HTMLImageElement | null; // quadro para miniatura / preview parado
  carregado: boolean;
  tocavel: boolean; // o navegador consegue tocar? (AVI/MKV/HEVC às vezes não)
  detectando: boolean;
  statusJob: StatusItem | null;
  progressoJob: number;
  saidaJob: string | null;
  /** Veio do armazenamento do navegador (a detecção já feita é mantida) */
  restaurado?: boolean;
}

export interface Aba {
  id: string;
  nome: string;
  videos: VideoCliente[];
  jobId: string | null;
  processando: boolean;
  pausado: boolean;
}

export interface MusicaCliente {
  id: string;
  nome: string;
  arquivo: File;
  url: string;
  duracao: number;
  arquivoId: string | null;
  upload: number;
}

export interface TemplateCliente {
  nome: string;
  arquivo: File;
  url: string;
  imagem: HTMLImageElement;
  arquivoId: string | null;
}

export interface ResultadoJob {
  jobId: string;
  aba: string;
  criadoEm: number;
  itens: { nome: string; saida: string | null; status: StatusItem; erro: string | null }[];
}

export const novoId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function novaAba(n: number): Aba {
  return { id: novoId(), nome: `Lote ${n}`, videos: [], jobId: null, processando: false, pausado: false };
}
