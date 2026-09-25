import type { ConfigVideo } from '@/lib/editor-massa/types';
import type { Aba, MusicaCliente, ResultadoJob, VideoCliente } from './estado';

// Os vídeos enviados ficam no navegador (IndexedDB) até a pessoa remover: sair da página,
// recarregar ou fechar o navegador não perde nada. Os arquivos ficam no store "arquivos";
// lotes, ajustes de cada vídeo e músicas ficam no store "estado".

const BANCO = 'clipost-editor-massa';
const VERSAO = 1;
const ARQUIVOS = 'arquivos';
const ESTADO = 'estado';
const CHAVE_RESULTADOS = 'clipost:editor-massa:resultados';

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexao) return conexao;
  conexao = new Promise((res, rej) => {
    const r = indexedDB.open(BANCO, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(ARQUIVOS)) db.createObjectStore(ARQUIVOS);
      if (!db.objectStoreNames.contains(ESTADO)) db.createObjectStore(ESTADO);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  conexao.catch(() => (conexao = null));
  return conexao;
}

async function operar<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req ? req.result : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/** Pede ao navegador para não apagar os dados quando faltar espaço */
export function pedirArmazenamentoPersistente() {
  navigator.storage?.persist?.().catch(() => false);
}

export const salvarArquivo = (chave: string, arquivo: Blob) => operar(ARQUIVOS, 'readwrite', (s) => s.put(arquivo, chave)).catch(() => undefined);
export const apagarArquivo = (chave: string) => operar(ARQUIVOS, 'readwrite', (s) => s.delete(chave)).catch(() => undefined);
const lerArquivo = (chave: string) => operar<Blob>(ARQUIVOS, 'readonly', (s) => s.get(chave)).catch(() => undefined);

interface VideoSalvo extends ConfigVideo {
  tipo: string;
}
interface AbaSalva {
  id: string;
  nome: string;
  videos: VideoSalvo[];
}
interface MusicaSalva {
  id: string;
  nome: string;
  duracao: number;
  tipo: string;
}
interface EstadoSalvo {
  abas: AbaSalva[];
  abaAtivaId: string;
  musicas: MusicaSalva[];
}

/** Só a configuração (sem File, miniaturas, progresso) */
function configDoVideo(v: VideoCliente): ConfigVideo {
  const { arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob, restaurado, ...cfg } = v;
  void arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob, restaurado;
  return cfg;
}

export function salvarEstado(abas: Aba[], abaAtivaId: string, musicas: MusicaCliente[]) {
  const estado: EstadoSalvo = {
    abas: abas.map((a) => ({
      id: a.id,
      nome: a.nome,
      // o arquivoId do servidor pode expirar: na volta o vídeo é enviado de novo
      videos: a.videos.map((v) => ({ ...configDoVideo(v), arquivoId: undefined, tipo: v.arquivo.type })),
    })),
    abaAtivaId,
    musicas: musicas.map((m) => ({ id: m.id, nome: m.nome, duracao: m.duracao, tipo: m.arquivo.type })),
  };
  return operar(ESTADO, 'readwrite', (s) => s.put(estado, 'principal')).catch(() => undefined);
}

export async function carregarEstado(): Promise<{ abas: Aba[]; abaAtivaId: string; musicas: MusicaCliente[] } | null> {
  const e = await operar<EstadoSalvo>(ESTADO, 'readonly', (s) => s.get('principal')).catch(() => undefined);
  if (!e?.abas?.length) return null;

  const abas: Aba[] = [];
  for (const a of e.abas) {
    const videos: VideoCliente[] = [];
    for (const { tipo, ...cfg } of a.videos) {
      const blob = await lerArquivo(cfg.id);
      if (!blob) continue; // arquivo sumiu (dados limpos pelo navegador)
      const arquivo = blob instanceof File ? blob : new File([blob], cfg.nome, { type: tipo || 'video/mp4' });
      videos.push({
        ...cfg,
        arquivo,
        url: URL.createObjectURL(arquivo),
        upload: 0,
        uploadErro: null,
        quadro: null,
        carregado: false,
        tocavel: true,
        detectando: false,
        statusJob: null,
        progressoJob: 0,
        saidaJob: null,
        restaurado: true,
      });
    }
    abas.push({ id: a.id, nome: a.nome, videos, jobId: null, processando: false, pausado: false });
  }

  const musicas: MusicaCliente[] = [];
  for (const m of e.musicas ?? []) {
    const blob = await lerArquivo('musica:' + m.id);
    if (!blob) continue;
    const arquivo = blob instanceof File ? blob : new File([blob], m.nome, { type: m.tipo || 'audio/mpeg' });
    musicas.push({ id: m.id, nome: m.nome, arquivo, url: URL.createObjectURL(arquivo), duracao: m.duracao, arquivoId: null, upload: 0 });
  }
  return { abas, abaAtivaId: e.abaAtivaId, musicas };
}

export function salvarResultados(r: ResultadoJob[]) {
  try {
    localStorage.setItem(CHAVE_RESULTADOS, JSON.stringify(r.slice(0, 50)));
  } catch {
    // sem storage
  }
}

export function carregarResultados(): ResultadoJob[] {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RESULTADOS) || '[]');
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
