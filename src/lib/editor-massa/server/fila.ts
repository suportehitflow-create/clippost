import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CriarJobPayload, ItemJobInfo, JobInfo, StatusJob } from '../types';
import { gerarAntiDup } from './antidup';
import { caminhoUpload, limparAntigos, pastaJob } from './armazenamento';
import { registrarVideoProcessado, tokenDoUsuario } from './autorizacao';
import { gerarLegendas } from './legendas';
import { detectarArea } from './deteccao';
import { executar, FFMPEG, sondar } from './ffmpeg';
import { montarComando } from './filtro';
import { trechosComFala, type Segmento } from './silencio';
import { trechoVideo, velocidadeEfeitos } from '../layout';

// Fila em memória do processo Node. Roda N vídeos ao mesmo tempo (EDITOR_MASSA_CONCURRENCIA).
// Para escalar em vários servidores, troque por BullMQ/Redis mantendo a mesma interface.

interface Job {
  info: JobInfo;
  payload: CriarJobPayload;
  usuarioId: string | null;
  pausado: boolean;
  cancelado: boolean;
  controladores: Map<string, AbortController>;
  pendentes: number[];
}

interface EstadoFila {
  jobs: Map<string, Job>;
  rodando: number;
  ultimaLimpeza: number;
}

const g = globalThis as unknown as { __editorMassaFila?: EstadoFila };
const estado: EstadoFila = (g.__editorMassaFila ??= { jobs: new Map(), rodando: 0, ultimaLimpeza: 0 });

const CONCORRENCIA = Math.max(1, Number(process.env.EDITOR_MASSA_CONCURRENCIA || 2));

function hora() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function log(job: Job, msg: string) {
  job.info.log.push(`[${hora()}] ${msg}`);
  if (job.info.log.length > 2000) job.info.log.splice(0, job.info.log.length - 2000);
}

export function criarJob(payload: CriarJobPayload, usuarioId: string | null): JobInfo {
  const id = randomUUID();
  const info: JobInfo = {
    id,
    status: 'fila',
    criadoEm: Date.now(),
    log: [],
    itens: payload.videos.map((v) => ({ id: v.id, nome: v.nome, status: 'fila', progresso: 0, saida: null, erro: null })),
  };
  const job: Job = {
    info,
    payload,
    usuarioId,
    pausado: false,
    cancelado: false,
    controladores: new Map(),
    pendentes: payload.videos.map((_, i) => i),
  };
  estado.jobs.set(id, job);
  log(job, `[JOB] ${payload.videos.length} vídeo(s) na fila${payload.nomeAba ? ` — ${payload.nomeAba}` : ''}`);
  if (Date.now() - estado.ultimaLimpeza > 3600_000) {
    estado.ultimaLimpeza = Date.now();
    limparAntigos().catch(() => {});
  }
  bombear();
  return info;
}

export function obterJob(id: string): JobInfo | null {
  return estado.jobs.get(id)?.info ?? null;
}

/** Só o dono controla/consulta o job pela API autenticada */
export function ehDonoDoJob(id: string, usuarioId: string | null): boolean {
  const job = estado.jobs.get(id);
  return !!job && !!usuarioId && job.usuarioId === usuarioId;
}

export function controlarJob(id: string, acao: 'pausar' | 'continuar' | 'cancelar'): JobInfo | null {
  const job = estado.jobs.get(id);
  if (!job) return null;
  if (acao === 'pausar' && !job.cancelado) {
    job.pausado = true;
    job.info.status = 'pausado';
    log(job, '⏸ Processamento pausado');
  } else if (acao === 'continuar' && !job.cancelado) {
    job.pausado = false;
    job.info.status = 'processando';
    log(job, '▶️ Processamento retomado');
    bombear();
  } else if (acao === 'cancelar') {
    job.cancelado = true;
    job.pendentes = [];
    job.controladores.forEach((c) => c.abort());
    job.info.itens.forEach((it) => {
      if (it.status === 'fila' || it.status === 'processando' || it.status === 'detectando') it.status = 'cancelado';
    });
    job.info.status = 'cancelado';
    log(job, '⏹ Processamento cancelado');
  }
  return job.info;
}

/** Remove os arquivos já gerados de um job cancelado ("Apagar processados?") */
export async function apagarSaidas(id: string) {
  await fs.rm(pastaJob(id), { recursive: true, force: true });
  const job = estado.jobs.get(id);
  job?.info.itens.forEach((it) => (it.saida = null));
}

function bombear() {
  while (estado.rodando < CONCORRENCIA) {
    const prox = proximaTarefa();
    if (!prox) return;
    estado.rodando++;
    processarItem(prox.job, prox.indice)
      .catch(() => {})
      .finally(() => {
        estado.rodando--;
        finalizarSeAcabou(prox.job);
        bombear();
      });
  }
}

function proximaTarefa(): { job: Job; indice: number } | null {
  for (const job of estado.jobs.values()) {
    if (job.pausado || job.cancelado || !job.pendentes.length) continue;
    const indice = job.pendentes.shift()!;
    if (job.info.status === 'fila') job.info.status = 'processando';
    return { job, indice };
  }
  return null;
}

function finalizarSeAcabou(job: Job) {
  const emAndamento = job.info.itens.some((i) => i.status === 'processando' || i.status === 'detectando');
  if (job.pendentes.length || emAndamento || job.cancelado) return;
  if (job.info.status === 'concluido' || job.info.status === 'erro') return;
  const ok = job.info.itens.filter((i) => i.status === 'ok').length;
  const falhas = job.info.itens.filter((i) => i.status === 'erro');
  job.info.status = (ok === 0 && falhas.length ? 'erro' : 'concluido') as StatusJob;
  log(job, falhas.length ? `⚠️ ${ok} processados, ${falhas.length} falharam` : `✅ ${ok} vídeos processados!`);
  if (falhas.length) {
    const rel = [
      'Relatório de Processamento',
      `Total: ${job.info.itens.length}`,
      `Processados: ${ok}`,
      `Falharam: ${falhas.length}`,
      '',
      ...falhas.map((f) => `${f.nome}: ${f.erro}`),
    ].join('\n');
    fs.writeFile(path.join(pastaJob(job.info.id), '_erros_processamento.txt'), rel).catch(() => {});
  }
}

async function processarItem(job: Job, indice: number) {
  const v = job.payload.videos[indice];
  const item: ItemJobInfo = job.info.itens[indice];
  const { global } = job.payload;
  const controle = new AbortController();
  job.controladores.set(v.id, controle);
  const total = job.payload.videos.length;

  try {
    const pasta = pastaJob(job.info.id);
    await fs.mkdir(pasta, { recursive: true });
    const arquivo = await caminhoUpload(v.arquivoId);
    const info = await sondar(arquivo);
    if (!info.largura || !info.altura) throw new Error('Não foi possível ler o vídeo');

    // Área do vídeo sem o template antigo: vem do navegador; se não vier, detecta aqui
    item.status = 'detectando';
    let video = { ...v, largura: info.largura, altura: info.altura, duracao: info.duracao };
    if (!video.areaDetectada) {
      log(job, `[PROC] ${indice + 1}/${total} - Detectando: ${v.nome}`);
      const det = await detectarArea(arquivo, info, global.deteccao.modo, !!global.deteccao.cortarTexto);
      video = { ...video, areaDetectada: det.area, origemDeteccao: det.origem };
    } else if (v.largura && v.altura && (v.largura !== info.largura || v.altura !== info.altura)) {
      // navegador mediu em outra escala → reescala a área
      const ex = info.largura / v.largura;
      const ey = info.altura / v.altura;
      const a = video.areaDetectada;
      video.areaDetectada = { x: a.x * ex, y: a.y * ey, w: a.w * ex, h: a.h * ey };
    }
    const a = video.areaDetectada!;
    log(job, `[DETECT] ${v.nome} crop=${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)},${Math.round(a.h)} (${video.origemDeteccao ?? 'navegador'})`);

    const templateArq = job.payload.templateArquivoId ? await caminhoUpload(job.payload.templateArquivoId) : null;
    const templateInfo = templateArq ? await sondar(templateArq) : null;
    const overlay = v.overlayArquivoId ? await caminhoUpload(v.overlayArquivoId) : null;

    // Música escolhida = música ativa (não existe mais o liga/desliga)
    const musicaId = v.musica?.musicaId ?? global.musica.musicaId ?? null;
    const musicaArqId = musicaId ? job.payload.musicas[musicaId] : null;
    const musica = musicaArqId
      ? { arquivo: await caminhoUpload(musicaArqId), inicio: v.musica?.inicio ?? global.musica.inicio }
      : null;

    const antiDup = global.antiDup ? gerarAntiDup(`${job.info.id}:${v.id}`, global.antiDupNivel) : null;
    const saida = path.join(pasta, `${indice + 1}.mp4`);

    // Remover silêncios: detecta as pausas no trecho usado antes de montar o comando
    let manter: Segmento[] | null = null;
    if (global.efeitos.removerSilencio && info.temAudio) {
      const t = trechoVideo(global, video);
      manter = await trechosComFala(arquivo, t.inicio, t.duracao).catch(() => null);
    }

    // Legendas automáticas (cortes do Criar Cortes já vêm legendados → não duplica)
    let legendas: string | null = null;
    const lg = global.legendas;
    if (lg?.ativo && info.temAudio && !v.marcaEmbutida) {
      const token = tokenDoUsuario(job.usuarioId);
      if (!token) log(job, `[LEGENDA] ${v.nome}: sessão expirada, seguindo sem legenda`);
      else {
        log(job, `[LEGENDA] Transcrevendo ${v.nome}…`);
        const t = trechoVideo(global, video);
        try {
          const r = await gerarLegendas({
            arquivo, inicio: t.inicio, duracao: t.duracao, manter,
            velocidade: velocidadeEfeitos(global) * (antiDup ? antiDup.atempo : 1),
            preset: lg.preset, posicaoY: lg.posicaoY, fonte: global.estiloTexto.fonte,
            token, pasta, nome: String(indice + 1),
          });
          legendas = r?.arquivo ?? null;
          log(job, r ? `[LEGENDA] ${v.nome}: ${r.palavras} palavras` : `[LEGENDA] ${v.nome}: sem fala, sem legenda`);
        } catch (e: any) {
          log(job, `[LEGENDA] ${v.nome}: falhou (${e?.message ?? e}), seguindo sem legenda`);
        }
      }
    }

    item.status = 'processando';
    for (const seguro of [false, true]) {
      const cmd = montarComando({
        global,
        video,
        info,
        arquivoVideo: arquivo,
        template: templateArq && templateInfo ? { arquivo: templateArq, tamanho: { w: templateInfo.largura, h: templateInfo.altura } } : null,
        overlayPng: overlay,
        musica,
        antiDup,
        saida,
        seguro,
        manter,
        // no retry sai sem legenda: se o problema era o filtro "ass", o vídeo ao menos fica pronto
        legendas: seguro ? null : legendas,
      });
      log(job, `[FFMPEG] ${seguro ? '[RETRY] ' : ''}Processando ${v.nome}: ${cmd.resumo}`);
      const timeoutMs = Math.max(120_000, cmd.duracaoSaida * 20_000);
      const r = await executar(FFMPEG, cmd.args, {
        timeoutMs,
        sinal: controle.signal,
        aoProgresso: (linha) => {
          const m = /^out_time_(?:us|ms)=(\d+)/.exec(linha);
          if (m) item.progresso = Math.min(0.99, Number(m[1]) / 1e6 / cmd.duracaoSaida);
        },
      });
      if (job.cancelado) {
        item.status = 'cancelado';
        await fs.rm(saida, { force: true });
        return;
      }
      if (r.codigo === 0) {
        item.status = 'ok';
        item.progresso = 1;
        item.saida = path.basename(saida);
        log(job, `[OK] ${v.nome} processado com sucesso!`);
        await registrarVideoProcessado(job.usuarioId, v.nome).catch(() => {});
        return;
      }
      log(job, `[DIAG] FFmpeg ERRO ret=${r.codigo}: ${r.stderr.split('\n').filter(Boolean).slice(-3).join(' | ')}`);
    }
    throw new Error('falhou em ambos os métodos');
  } catch (e: any) {
    if (job.cancelado) {
      item.status = 'cancelado';
      return;
    }
    item.status = 'erro';
    item.erro = String(e?.message ?? e);
    log(job, `[ERRO] ${v.nome} - ${item.erro}`);
  } finally {
    job.controladores.delete(v.id);
  }
}
