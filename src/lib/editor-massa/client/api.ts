import { createClient } from '@/lib/supabase/client';
import type { CriarJobPayload, JobInfo } from '../types';

// Em produção a tela fica na Vercel e o processamento (FFmpeg) num servidor Node persistente
// (NEXT_PUBLIC_EDITOR_MASSA_URL). Sem a variável (localhost), usa as rotas do próprio app.
const ORIGEM = (process.env.NEXT_PUBLIC_EDITOR_MASSA_URL || '').replace(/\/$/, '');
export const BASE = `${ORIGEM}/api/editor-massa`;

async function token(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function cabecalhos(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const t = await token();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
}

export function enviarArquivo(
  arquivo: Blob,
  nome: string,
  aoProgresso?: (fracao: number) => void,
): { promessa: Promise<string>; cancelar: () => void } {
  const xhr = new XMLHttpRequest();
  let cancelado = false;
  const promessa = token().then(
    (t) =>
      new Promise<string>((res, rej) => {
        if (cancelado) return rej(new Error('Upload cancelado'));
        xhr.open('POST', `${BASE}/upload`);
        xhr.setRequestHeader('x-nome-arquivo', encodeURIComponent(nome));
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && aoProgresso?.(e.loaded / e.total);
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && j.arquivoId) res(j.arquivoId);
            else rej(new Error(j.erro || `Falha no upload (${xhr.status})`));
          } catch {
            rej(new Error(`Falha no upload (${xhr.status})`));
          }
        };
        xhr.onerror = () => rej(new Error('Erro de conexão no upload'));
        xhr.onabort = () => rej(new Error('Upload cancelado'));
        xhr.send(arquivo);
      }),
  );
  return {
    promessa,
    cancelar: () => {
      cancelado = true;
      xhr.abort();
    },
  };
}

async function json<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}

export const criarJob = async (p: CriarJobPayload) =>
  fetch(`${BASE}/jobs`, {
    method: 'POST',
    headers: await cabecalhos({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(p),
  }).then((r) => json<JobInfo>(r));

export const statusJob = async (id: string, desdeLog = 0) =>
  fetch(`${BASE}/jobs/${id}?log=${desdeLog}`, { cache: 'no-store', headers: await cabecalhos() }).then((r) =>
    json<JobInfo & { totalLog: number }>(r),
  );

export const controlarJob = async (id: string, acao: 'pausar' | 'continuar' | 'cancelar') =>
  fetch(`${BASE}/jobs/${id}`, {
    method: 'PATCH',
    headers: await cabecalhos({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ acao }),
  }).then((r) => json<{ status: string }>(r));

export const apagarProcessados = async (id: string) =>
  fetch(`${BASE}/jobs/${id}`, { method: 'DELETE', headers: await cabecalhos() }).then((r) => json<{ ok: boolean }>(r));

export const analisarNoServidor = async (arquivoId: string, detectar?: 'auto' | 'margem' | 'nenhuma') =>
  fetch(`${BASE}/analisar`, {
    method: 'POST',
    headers: await cabecalhos({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ arquivoId, detectar }),
  }).then((r) =>
    json<{ largura: number; altura: number; duracao: number; area: { x: number; y: number; w: number; h: number } | null; origem: string | null }>(r),
  );

// Usadas direto em <img>/<video>/<a download>, que não mandam cabeçalho: o id aleatório do
// arquivo/job funciona como chave de acesso.
export const urlFrame = (arquivoId: string, t: number, w = 720) => `${BASE}/frame?arquivoId=${arquivoId}&t=${t.toFixed(2)}&w=${w}`;
export const urlArquivo = (jobId: string, nome: string, baixar = false) => `${BASE}/jobs/${jobId}/arquivo/${nome}${baixar ? '?baixar=1' : ''}`;
