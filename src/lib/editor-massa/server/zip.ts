import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';

// ZIP simples sem compressão (vídeo já é comprimido), em streaming, sem dependências.
// Suporta arquivos até 4 GB cada (ZIP32).

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

async function crc32Arquivo(caminho: string): Promise<number> {
  let crc = 0xffffffff;
  for await (const bloco of createReadStream(caminho)) {
    const b = bloco as Buffer;
    for (let i = 0; i < b.length; i++) crc = TABELA_CRC[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipEmStream(arquivos: { nome: string; caminho: string }[]): ReadableStream<Uint8Array> {
  async function* gerar() {
    const centrais: Buffer[] = [];
    let offset = 0;
    for (const a of arquivos) {
      const st = await fs.stat(a.caminho);
      const crc = await crc32Arquivo(a.caminho);
      const nome = Buffer.from(a.nome, 'utf8');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
      local.writeUInt16LE(0, 8); // sem compressão
      local.writeUInt32LE(0, 10);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(st.size, 18);
      local.writeUInt32LE(st.size, 22);
      local.writeUInt16LE(nome.length, 26);
      local.writeUInt16LE(0, 28);
      yield local;
      yield nome;
      for await (const bloco of createReadStream(a.caminho)) yield bloco as Buffer;

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt32LE(0, 12);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(st.size, 20);
      central.writeUInt32LE(st.size, 24);
      central.writeUInt16LE(nome.length, 28);
      central.writeUInt32LE(offset, 42);
      centrais.push(central, nome);
      offset += 30 + nome.length + st.size;
    }
    const dir = Buffer.concat(centrais);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(arquivos.length, 8);
    fim.writeUInt16LE(arquivos.length, 10);
    fim.writeUInt32LE(dir.length, 12);
    fim.writeUInt32LE(offset, 16);
    yield dir;
    yield fim;
  }
  return Readable.toWeb(Readable.from(gerar())) as unknown as ReadableStream<Uint8Array>;
}
