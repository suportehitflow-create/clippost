import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Arquivos enviados e gerados ficam em disco. Em produção aponte EDITOR_MASSA_DIR
// para um volume persistente (ou troque estas funções por S3/R2/Supabase Storage).

export const BASE = process.env.EDITOR_MASSA_DIR || path.join(os.tmpdir(), 'clipost-editor-massa');
export const PASTA_UPLOADS = path.join(BASE, 'uploads');
export const PASTA_JOBS = path.join(BASE, 'jobs');

const ID_VALIDO = /^[a-zA-Z0-9-]{8,64}$/;
export const idValido = (id: string) => ID_VALIDO.test(id);

export const EXTENSOES_PERMITIDAS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  '.png', '.jpg', '.jpeg', '.webp', '.bmp',
  '.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.wma',
]);

export interface MetaUpload {
  id: string;
  nome: string;
  tamanho: number;
  criadoEm: number;
}

export async function salvarUpload(corpo: ReadableStream<Uint8Array>, nomeOriginal: string, limiteBytes: number): Promise<MetaUpload> {
  const ext = path.extname(nomeOriginal).toLowerCase();
  if (!EXTENSOES_PERMITIDAS.has(ext)) throw new Error(`Tipo de arquivo não permitido: ${ext || '(sem extensão)'}`);
  await fs.mkdir(PASTA_UPLOADS, { recursive: true });
  const id = randomUUID();
  const destino = path.join(PASTA_UPLOADS, id + ext);
  let tamanho = 0;
  const node = Readable.fromWeb(corpo as any);
  node.on('data', (c: Buffer) => {
    tamanho += c.length;
    if (tamanho > limiteBytes) node.destroy(new Error('Arquivo maior que o limite permitido'));
  });
  try {
    await pipeline(node, createWriteStream(destino));
  } catch (e) {
    await fs.rm(destino, { force: true });
    throw e;
  }
  const meta: MetaUpload = { id, nome: path.basename(nomeOriginal), tamanho, criadoEm: Date.now() };
  await fs.writeFile(path.join(PASTA_UPLOADS, id + '.json'), JSON.stringify({ ...meta, ext }));
  return meta;
}

export async function caminhoUpload(id: string): Promise<string> {
  if (!idValido(id)) throw new Error('id de arquivo inválido');
  const meta = JSON.parse(await fs.readFile(path.join(PASTA_UPLOADS, id + '.json'), 'utf8'));
  return path.join(PASTA_UPLOADS, id + meta.ext);
}

export function pastaJob(jobId: string) {
  if (!idValido(jobId)) throw new Error('id de job inválido');
  return path.join(PASTA_JOBS, jobId);
}

/** Apaga uploads e jobs mais velhos que `horas` (chamado de tempos em tempos pela fila) */
export async function limparAntigos(horas = Number(process.env.EDITOR_MASSA_RETENCAO_HORAS || 24)) {
  const limite = Date.now() - horas * 3600_000;
  for (const pasta of [PASTA_UPLOADS, PASTA_JOBS]) {
    let itens: string[] = [];
    try {
      itens = await fs.readdir(/*turbopackIgnore: true*/ pasta);
    } catch {
      continue;
    }
    await Promise.all(
      itens.map(async (nome) => {
        const p = path.join(pasta, nome);
        try {
          const st = await fs.stat(p);
          if (st.mtimeMs < limite) await fs.rm(p, { recursive: true, force: true });
        } catch {
          // ignora
        }
      }),
    );
  }
}
