'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import * as api from '@/lib/editor-massa/client/api';
import { abrirVideo, capturarQuadro, carregarImagem, detectarNoNavegador, duracaoAudio, lerMeta } from '@/lib/editor-massa/client/midia';
import { gerarOverlayPng, temOverlay } from '@/lib/editor-massa/client/render';
import { finalizarArea } from '@/lib/editor-massa/deteccao-core';
import { configGlobalPadrao, FONTES_GOOGLE, novoVideo } from '@/lib/editor-massa/defaults';
import type { ConfigGlobal, ConfigVideo, VideoJob } from '@/lib/editor-massa/types';
import { novaAba, novoId, type Aba, type MusicaCliente, type ResultadoJob, type TemplateCliente, type VideoCliente } from './estado';
import Grade from './Grade';
import { Icone } from './icones';
import Inspetor from './Inspetor';
import Lateral from './Lateral';
import { GavetaLog, ModalConcluido, PainelResultados } from './Paineis';
import s from './editor-massa.module.css';

type Sobreposicao = { tipo: 'resultados' } | { tipo: 'concluido'; aba: string; abaId: string; ok: number; falhas: number; jobId: string } | null;

const CHAVE_CONFIG = 'clipost:editor-massa:config';
const ANALISES_SIMULTANEAS = 3;
const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const emCampoDeTexto = (e: Event) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '');

/** Só os campos de ConfigVideo (sem File, ImageBitmap etc.) */
function paraConfig(v: VideoCliente): ConfigVideo {
  const { arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob, ...cfg } = v;
  void arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob;
  return cfg;
}

function carregarConfig(): ConfigGlobal {
  const padrao = configGlobalPadrao();
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIG) || 'null');
    if (!salvo) return padrao;
    const r: any = { ...padrao };
    for (const k of Object.keys(padrao) as (keyof ConfigGlobal)[]) {
      const p = padrao[k] as any;
      if (salvo[k] === undefined) continue;
      r[k] = p && typeof p === 'object' && !Array.isArray(p) ? { ...p, ...salvo[k] } : salvo[k];
    }
    r.estiloTexto = { ...padrao.estiloTexto, ...salvo.estiloTexto };
    r.musica = { ...r.musica, musicaId: null }; // músicas não sobrevivem ao recarregar a página
    return r;
  } catch {
    return padrao;
  }
}

export default function EditorMassa() {
  const [global, setGlobal] = useState<ConfigGlobal>(configGlobalPadrao);
  const [abas, setAbas] = useState<Aba[]>(() => [novaAba(1)]);
  const [abaAtivaId, setAbaAtivaId] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateCliente | null>(null);
  const [musicas, setMusicas] = useState<MusicaCliente[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState('Pronto');
  const [resultados, setResultados] = useState<ResultadoJob[]>([]);
  const [sobre, setSobre] = useState<Sobreposicao>(null);
  const [logAberto, setLogAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gatilhoAnalise, setGatilhoAnalise] = useState(0);

  const abasRef = useRef(abas);
  abasRef.current = abas;
  const globalRef = useRef(global);
  globalRef.current = global;
  const templateRef = useRef(template);
  templateRef.current = template;
  const musicasRef = useRef(musicas);
  musicasRef.current = musicas;
  const uploads = useRef(new Map<string, Promise<string>>());
  const cancelarUploads = useRef(new Map<string, () => void>());
  const analisando = useRef(new Set<string>());
  const ultimoClicado = useRef<string | null>(null);
  const inputVideos = useRef<HTMLInputElement>(null);
  const inputTemplate = useRef<HTMLInputElement>(null);
  const inputMusicas = useRef<HTMLInputElement>(null);

  const abaAtiva = abas.find((a) => a.id === abaAtivaId) ?? abas[0];

  // ---------- inicialização / persistência ----------
  useEffect(() => {
    setGlobal(carregarConfig());
    setAbaAtivaId(abasRef.current[0].id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_CONFIG, JSON.stringify(global));
    } catch {
      // sem storage (aba anônima etc.)
    }
  }, [global]);

  // fontes do Google precisam estar carregadas antes de desenhar no canvas
  useEffect(() => {
    Promise.all([global.estiloTexto.fonte, global.marca.fonte].map((f) => document.fonts?.load(`bold 40px "${f}"`).catch(() => null))).then(() =>
      setGlobal((g) => ({ ...g })),
    );
  }, [global.estiloTexto.fonte, global.marca.fonte]);

  const avisar = useCallback((msg: string) => {
    setToast(msg);
    setStatus(msg);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const escreverLog = useCallback((msg: string) => setLog((l) => [...l.slice(-1500), `[${hora()}] ${msg}`]), []);

  // ---------- vídeos ----------
  const atualizarVideo = useCallback((id: string, parcial: Partial<VideoCliente> | ((v: VideoCliente) => Partial<VideoCliente>)) => {
    setAbas((as) =>
      as.map((a) =>
        a.videos.some((v) => v.id === id)
          ? { ...a, videos: a.videos.map((v) => (v.id === id ? { ...v, ...(typeof parcial === 'function' ? parcial(v) : parcial) } : v)) }
          : a,
      ),
    );
  }, []);

  // ---------- upload em segundo plano (3 por vez) ----------
  const filaUpload = useRef<(() => Promise<void>)[]>([]);
  const uploadsAtivos = useRef(0);
  const bombearUploads = useCallback(() => {
    while (uploadsAtivos.current < 3 && filaUpload.current.length) {
      const tarefa = filaUpload.current.shift()!;
      uploadsAtivos.current++;
      tarefa().finally(() => {
        uploadsAtivos.current--;
        bombearUploads();
      });
    }
  }, []);

  const enviar = useCallback(
    (chave: string, arquivo: File, aoProgresso: (f: number) => void): Promise<string> => {
      const existente = uploads.current.get(chave);
      if (existente) return existente;
      const p = new Promise<string>((res, rej) => {
        filaUpload.current.push(async () => {
          const u = api.enviarArquivo(arquivo, arquivo.name, aoProgresso);
          cancelarUploads.current.set(chave, u.cancelar);
          try {
            res(await u.promessa);
          } catch (e) {
            uploads.current.delete(chave);
            rej(e);
          } finally {
            cancelarUploads.current.delete(chave);
          }
        });
        bombearUploads();
      });
      uploads.current.set(chave, p);
      p.catch(() => {});
      return p;
    },
    [bombearUploads],
  );

  const enviarVideo = useCallback(
    (v: VideoCliente) =>
      enviar(v.id, v.arquivo, (f) => atualizarVideo(v.id, { upload: f }))
        .then((id) => {
          atualizarVideo(v.id, { arquivoId: id, upload: 1, uploadErro: null });
          return id;
        })
        .catch((e) => {
          atualizarVideo(v.id, { uploadErro: String(e.message ?? e) });
          escreverLog(`[ERRO] Upload ${v.nome}: ${e.message ?? e}`);
          throw e;
        }),
    [enviar, atualizarVideo, escreverLog],
  );

  // ---------- análise: dimensões, miniatura e detecção do template antigo ----------
  const detectar = useCallback(
    async (el: HTMLVideoElement | null, v: { id: string; nome: string; largura: number; altura: number; duracao: number; arquivoId?: string }) => {
      const modo = globalRef.current.deteccao.modo;
      if (modo === 'nenhuma') return atualizarVideo(v.id, { areaDetectada: null, origemDeteccao: 'completo', detectando: false });
      if (modo === 'margem') {
        const f = finalizarArea(null, v.largura, v.altura);
        return atualizarVideo(v.id, { areaDetectada: f.area, origemDeteccao: f.origem, detectando: false });
      }
      atualizarVideo(v.id, { detectando: true });
      try {
        let area, origem;
        if (el) {
          ({ area, origem } = finalizarArea(await detectarNoNavegador(el, v), v.largura, v.altura));
        } else {
          const arquivoId = v.arquivoId ?? (await uploads.current.get(v.id));
          const r = await api.analisarNoServidor(arquivoId!, 'auto');
          area = r.area;
          origem = r.origem as VideoCliente['origemDeteccao'];
        }
        atualizarVideo(v.id, { areaDetectada: area ?? null, origemDeteccao: origem ?? undefined, detectando: false });
        if (area) escreverLog(`[DETECT] ${v.nome} crop=${area.x},${area.y},${area.w},${area.h} (${origem})`);
      } catch (e: any) {
        atualizarVideo(v.id, { detectando: false });
        escreverLog(`[DIAG] ${v.nome} detecção falhou: ${e?.message ?? e}`);
      }
    },
    [atualizarVideo, escreverLog],
  );

  const analisar = useCallback(
    async (v: VideoCliente) => {
      analisando.current.add(v.id);
      let el: HTMLVideoElement | null = null;
      try {
        el = await abrirVideo(v.url);
        const meta = await lerMeta(el);
        if (!meta.largura) throw new Error('sem vídeo');
        const quadro = await capturarQuadro(el, Math.min(1, meta.duracao * 0.3), 720);
        atualizarVideo(v.id, { ...meta, quadro, carregado: true, tocavel: true });
        await detectar(el, { ...v, ...meta });
      } catch {
        // formato que o navegador não abre → o servidor analisa após o upload
        atualizarVideo(v.id, { tocavel: false });
        try {
          const arquivoId = await (uploads.current.get(v.id) ?? enviarVideo(v));
          const r = await api.analisarNoServidor(arquivoId, globalRef.current.deteccao.modo);
          const img = await carregarImagem(api.urlFrame(arquivoId, Math.min(1, r.duracao * 0.3), 720));
          atualizarVideo(v.id, {
            largura: r.largura,
            altura: r.altura,
            duracao: r.duracao,
            quadro: img,
            carregado: true,
            areaDetectada: r.area,
            origemDeteccao: (r.origem as VideoCliente['origemDeteccao']) ?? undefined,
          });
          escreverLog(`[DIAG] ${v.nome} analisado no servidor (${r.largura}x${r.altura})`);
        } catch (e: any) {
          escreverLog(`[FALHA] ${v.nome} - não foi possível ler o vídeo: ${e?.message ?? e}`);
          atualizarVideo(v.id, { carregado: true });
        }
      } finally {
        if (el) {
          el.removeAttribute('src');
          el.load();
        }
        analisando.current.delete(v.id);
        setGatilhoAnalise((n) => n + 1);
      }
    },
    [atualizarVideo, detectar, enviarVideo, escreverLog],
  );

  // fila automática: analisa todos os vídeos, alguns por vez, lote ativo primeiro
  useEffect(() => {
    const todos = [abaAtiva, ...abas.filter((a) => a.id !== abaAtiva.id)].flatMap((a) => a.videos);
    const pendentes = todos.filter((v) => !v.carregado && !analisando.current.has(v.id));
    pendentes.slice(0, Math.max(0, ANALISES_SIMULTANEAS - analisando.current.size)).forEach((v) => analisar(v));
  }, [abas, abaAtiva, gatilhoAnalise, analisar]);

  const adicionarVideos = useCallback(
    (arquivos: File[]) => {
      const novos: VideoCliente[] = arquivos.map((arquivo) => ({
        ...novoVideo({ id: novoId(), nome: arquivo.name, largura: 0, altura: 0, duracao: 0 }),
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
      }));
      const alvo = abaAtiva.id;
      setAbas((as) => as.map((a) => (a.id === alvo ? { ...a, videos: [...a.videos, ...novos] } : a)));
      novos.forEach((v) => enviarVideo(v).catch(() => {}));
      avisar(`${novos.length} vídeo(s) adicionados`);
      if (!ativoId && novos[0]) setAtivoId(novos[0].id);
    },
    [abaAtiva.id, enviarVideo, avisar, ativoId],
  );

  const removerVideos = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      abasRef.current.forEach((a) =>
        a.videos.forEach((v) => {
          if (!set.has(v.id)) return;
          URL.revokeObjectURL(v.url);
          cancelarUploads.current.get(v.id)?.();
          uploads.current.delete(v.id);
        }),
      );
      setAbas((as) => as.map((a) => ({ ...a, videos: a.videos.filter((v) => !set.has(v.id)) })));
      setSelecionados((sel) => new Set([...sel].filter((id) => !set.has(id))));
      if (ativoId && set.has(ativoId)) setAtivoId(null);
      avisar(`${ids.length} vídeo(s) removido(s)`);
    },
    [ativoId, avisar],
  );

  // ---------- seleção ----------
  const clicar = useCallback(
    (id: string, e: MouseEvent) => {
      const ids = abaAtiva.videos.map((v) => v.id);
      if (e.ctrlKey || e.metaKey) {
        setSelecionados((sel) => {
          const n = new Set(sel.size ? sel : ativoId ? [ativoId] : []);
          n.has(id) ? n.delete(id) : n.add(id);
          return n;
        });
      } else if (e.shiftKey && ultimoClicado.current && ids.includes(ultimoClicado.current)) {
        const a = ids.indexOf(ultimoClicado.current);
        const b = ids.indexOf(id);
        setSelecionados(new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1)));
      } else {
        setSelecionados(new Set([id]));
      }
      ultimoClicado.current = id;
      setAtivoId(id);
    },
    [abaAtiva.videos, ativoId],
  );

  const alternarSelecao = useCallback(
    (id: string) =>
      setSelecionados((sel) => {
        const n = new Set(sel.size ? sel : ativoId ? [ativoId] : []);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      }),
    [ativoId],
  );

  const editando = useMemo(() => {
    const sel = abaAtiva.videos.filter((v) => selecionados.has(v.id));
    if (sel.length > 1) return sel;
    const a = abaAtiva.videos.find((v) => v.id === ativoId);
    return a ? [a] : sel;
  }, [abaAtiva.videos, selecionados, ativoId]);

  const alvos = (id: string, individual?: boolean) => (!individual && selecionados.has(id) && selecionados.size > 1 ? [...selecionados] : [id]);

  const acaoCard = useCallback(
    (id: string, fn: (v: ConfigVideo) => Partial<ConfigVideo>, individual?: boolean) => {
      alvos(id, individual).forEach((a) => atualizarVideo(a, (v) => fn(v)));
      if (individual && !globalRef.current.textoAtivo) setGlobal((g) => ({ ...g, textoAtivo: true }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecionados, atualizarVideo],
  );

  const atualizarSelecionados = useCallback(
    (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => editando.forEach((v) => atualizarVideo(v.id, (x) => fn(x))),
    [editando, atualizarVideo],
  );

  const redetectar = useCallback(
    async (lista: VideoCliente[]) => {
      avisar(`Detectando de novo em ${lista.length} vídeo(s)…`);
      for (const v of lista) {
        if (!v.carregado) continue;
        let el: HTMLVideoElement | null = null;
        try {
          if (v.tocavel) el = await abrirVideo(v.url);
          await detectar(el, v);
        } catch {
          // segue
        } finally {
          el?.removeAttribute('src');
        }
      }
    },
    [detectar, avisar],
  );

  // ---------- template e músicas ----------
  const escolherTemplate = async (arquivo: File) => {
    try {
      const url = URL.createObjectURL(arquivo);
      const imagem = await carregarImagem(url);
      const t: TemplateCliente = { nome: arquivo.name, arquivo, url, imagem, arquivoId: null };
      setTemplate(t);
      setGlobal((g) => ({ ...g, moldura: { ...g.moldura, ativo: false } }));
      avisar(`Template: ${arquivo.name} (${imagem.naturalWidth}×${imagem.naturalHeight})`);
      enviar('template:' + url, arquivo, () => {})
        .then((id) => setTemplate((x) => (x && x.url === url ? { ...x, arquivoId: id } : x)))
        .catch((e) => escreverLog(`[ERRO] Upload do template: ${e.message}`));
    } catch {
      avisar('Não foi possível abrir essa imagem');
    }
  };

  const adicionarMusicas = async (arquivos: File[]) => {
    const novas: MusicaCliente[] = await Promise.all(
      arquivos.map(async (arquivo) => {
        const url = URL.createObjectURL(arquivo);
        return { id: novoId(), nome: arquivo.name, arquivo, url, duracao: await duracaoAudio(url), arquivoId: null, upload: 0 };
      }),
    );
    setMusicas((m) => [...m, ...novas]);
    novas.forEach((m) =>
      enviar('musica:' + m.id, m.arquivo, (f) => setMusicas((ms) => ms.map((x) => (x.id === m.id ? { ...x, upload: f } : x))))
        .then((id) => setMusicas((ms) => ms.map((x) => (x.id === m.id ? { ...x, arquivoId: id, upload: 1 } : x))))
        .catch((e) => escreverLog(`[ERRO] Upload da música ${m.nome}: ${e.message}`)),
    );
    if (novas[0] && !globalRef.current.musica.musicaId) setGlobal((g) => ({ ...g, musica: { ...g.musica, ativo: true, musicaId: novas[0].id } }));
    avisar(`${novas.length} música(s) importada(s)`);
  };

  // ---------- processamento ----------
  const acompanhar = useCallback(async (abaId: string, nomeAba: string, jobId: string) => {
    let lidos = 0;
    for (;;) {
      await new Promise((r) => setTimeout(r, 900));
      let st;
      try {
        st = await api.statusJob(jobId, lidos);
      } catch {
        continue;
      }
      if (st.log.length) setLog((l) => [...l.slice(-1500), ...st.log]);
      lidos = st.totalLog;
      const porId = new Map(st.itens.map((i) => [i.id, i]));
      setAbas((as) =>
        as.map((a) =>
          a.id !== abaId
            ? a
            : {
                ...a,
                pausado: st.status === 'pausado',
                videos: a.videos.map((v) => {
                  const i = porId.get(v.id);
                  return i ? { ...v, statusJob: i.status, progressoJob: i.progresso, saidaJob: i.saida } : v;
                }),
              },
        ),
      );
      setResultados((rs) => rs.map((r) => (r.jobId === jobId ? { ...r, itens: st.itens.map((i) => ({ ...i })) } : r)));
      if (st.status === 'concluido' || st.status === 'cancelado' || st.status === 'erro') {
        const ok = st.itens.filter((i) => i.status === 'ok').length;
        const falhas = st.itens.filter((i) => i.status === 'erro').length;
        setAbas((as) => as.map((a) => (a.id === abaId ? { ...a, processando: false, pausado: false } : a)));
        if (st.status === 'cancelado') setStatus('Processamento cancelado');
        else {
          setStatus(falhas ? `${nomeAba}: ${ok} prontos, ${falhas} falharam` : `${nomeAba}: ${ok} vídeos prontos`);
          setSobre({ tipo: 'concluido', aba: nomeAba, abaId, ok, falhas, jobId });
        }
        return;
      }
    }
  }, []);

  const processar = async () => {
    const aba = abaAtiva;
    if (aba.processando || !aba.videos.length) return;
    const g = globalRef.current;
    if (!templateRef.current && !g.moldura.ativo && !window.confirm('Nenhum template escolhido. Processar com fundo preto 1080×1920?')) return;

    setAbas((as) => as.map((a) => (a.id === aba.id ? { ...a, processando: true, pausado: false, videos: a.videos.map((v) => ({ ...v, statusJob: 'fila', progressoJob: 0 })) } : a)));
    try {
      setStatus('Enviando arquivos…');
      const videosIds = await Promise.all(aba.videos.map((v) => uploads.current.get(v.id) ?? enviarVideo(v)));
      const tpl = templateRef.current;
      const templateArquivoId = tpl && !g.moldura.ativo ? (tpl.arquivoId ?? (await uploads.current.get('template:' + tpl.url)) ?? null) : null;

      const usadas = new Set<string>();
      if (g.musica.ativo && g.musica.musicaId) usadas.add(g.musica.musicaId);
      aba.videos.forEach((v) => v.musica && usadas.add(v.musica.musicaId));
      const musicasMapa: Record<string, string> = {};
      for (const id of usadas) {
        const m = musicasRef.current.find((x) => x.id === id);
        if (m) musicasMapa[id] = m.arquivoId ?? (await uploads.current.get('musica:' + m.id))!;
      }

      setStatus('Preparando textos…');
      await Promise.all([g.estiloTexto.fonte, g.marca.fonte].map((f) => document.fonts?.load(`bold 40px "${f}"`).catch(() => null)));
      const tamTemplate = tpl ? { w: tpl.imagem.naturalWidth, h: tpl.imagem.naturalHeight } : null;
      // PNGs de texto em paralelo
      const videos: VideoJob[] = await Promise.all(
        aba.videos.map(async (v, i) => {
          const cfg = paraConfig(v);
          let overlayArquivoId: string | null = null;
          if (temOverlay(g, cfg) && v.largura) {
            const png = await gerarOverlayPng(g, cfg, tamTemplate);
            if (png) overlayArquivoId = await api.enviarArquivo(png, `overlay_${i}.png`).promessa;
          }
          return { ...cfg, arquivoId: videosIds[i], overlayArquivoId };
        }),
      );

      const job = await api.criarJob({ global: g, templateArquivoId, musicas: musicasMapa, videos, nomeAba: aba.nome });
      escreverLog(`[PROC] ${aba.nome}: ${videos.length} vídeo(s) enviados para processamento`);
      setAbas((as) => as.map((a) => (a.id === aba.id ? { ...a, jobId: job.id } : a)));
      setResultados((rs) => [{ jobId: job.id, aba: aba.nome, criadoEm: job.criadoEm, itens: job.itens.map((i) => ({ ...i })) }, ...rs]);
      setStatus(`Processando ${aba.nome}…`);
      acompanhar(aba.id, aba.nome, job.id);
    } catch (e: any) {
      setAbas((as) => as.map((a) => (a.id === aba.id ? { ...a, processando: false, videos: a.videos.map((v) => ({ ...v, statusJob: null })) } : a)));
      avisar(`Erro: ${e?.message ?? e}`);
      escreverLog(`[ERRO] ${e?.message ?? e}`);
    }
  };

  const pausar = async () => {
    if (!abaAtiva.jobId) return;
    await api.controlarJob(abaAtiva.jobId, abaAtiva.pausado ? 'continuar' : 'pausar').catch(() => {});
    setAbas((as) => as.map((a) => (a.id === abaAtiva.id ? { ...a, pausado: !a.pausado } : a)));
  };

  const cancelar = async () => {
    const jobId = abaAtiva.jobId;
    if (!jobId || !window.confirm('Cancelar o processamento?')) return;
    await api.controlarJob(jobId, 'cancelar').catch(() => {});
    if (window.confirm('Apagar também os vídeos que já ficaram prontos?')) {
      await api.apagarProcessados(jobId).catch(() => {});
      setResultados((rs) => rs.filter((r) => r.jobId !== jobId));
    }
  };

  // ---------- lotes (abas) ----------
  const criarLote = () => {
    const a = novaAba(abas.length + 1);
    setAbas((as) => [...as, a]);
    setAbaAtivaId(a.id);
    setSelecionados(new Set());
    setAtivoId(null);
  };
  const fecharLote = (id: string) => {
    const a = abas.find((x) => x.id === id);
    if (!a || abas.length === 1) return;
    if (a.processando) return avisar('Espere o processamento deste lote terminar');
    if (a.videos.length && !window.confirm(`Fechar "${a.nome}" e remover os ${a.videos.length} vídeos dele?`)) return;
    a.videos.forEach((v) => URL.revokeObjectURL(v.url));
    const resto = abas.filter((x) => x.id !== id);
    setAbas(resto);
    if (abaAtivaId === id) setAbaAtivaId(resto[0].id);
  };
  const renomearLote = (id: string) => {
    const a = abas.find((x) => x.id === id);
    const nome = window.prompt('Nome do lote:', a?.nome)?.trim();
    if (nome) setAbas((as) => as.map((x) => (x.id === id ? { ...x, nome } : x)));
  };

  // ---------- atalhos de teclado ----------
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (emCampoDeTexto(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelecionados(new Set(abaAtiva.videos.map((v) => v.id)));
      } else if (e.key === 'Escape') {
        setSelecionados(new Set());
      } else if (e.key === 'Delete' && editando.length && !abaAtiva.processando) {
        if (editando.length === 1 || window.confirm(`Remover ${editando.length} vídeos?`)) removerVideos(editando.map((v) => v.id));
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abaAtiva, editando, removerVideos]);

  // ---------- derivados para a interface ----------
  const ativo = abaAtiva.videos.find((v) => v.id === ativoId) ?? null;
  const total = abaAtiva.videos.length;
  const feitos = abaAtiva.videos.filter((v) => v.statusJob === 'ok' || v.statusJob === 'erro').length;
  const progressoLote = total ? abaAtiva.videos.reduce((acc, v) => acc + (v.statusJob === 'ok' || v.statusJob === 'erro' ? 1 : v.statusJob === 'processando' ? v.progressoJob : 0), 0) / total : 0;
  const enviando = abas.flatMap((a) => a.videos).filter((v) => v.upload < 1 && !v.uploadErro).length;
  const analisandoN = abas.flatMap((a) => a.videos).filter((v) => !v.carregado || v.detectando).length;
  const prontos = resultados.reduce((n, r) => n + r.itens.filter((i) => i.saida).length, 0);
  const temErroLog = log.some((l) => /ERRO|FALHA/.test(l));

  return (
    <div className={s.raiz}>
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&${FONTES_GOOGLE.map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`).join('&')}&display=swap`}
      />

      {/* ================= barra superior ================= */}
      <header className={s.barra}>
        <div className={s.logo}>
          <span className={s.logoMarca}>
            <Icone nome="sparkles" tamanho={15} />
          </span>
          Editor em Massa
        </div>
        <nav className={s.lotes}>
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`${s.lote} ${a.id === abaAtiva.id ? s.loteAtivo : ''}`}
              onClick={() => {
                setAbaAtivaId(a.id);
                setSelecionados(new Set());
                setAtivoId(a.videos[0]?.id ?? null);
              }}
              onDoubleClick={() => renomearLote(a.id)}
              title="Duplo clique para renomear"
            >
              {a.processando && <span className={s.pontoAtivo} />}
              {a.nome}
              <span className={s.loteNum}>{a.videos.length}</span>
              {abas.length > 1 && (
                <span
                  className={s.loteFechar}
                  role="button"
                  title="Fechar lote"
                  onClick={(e) => {
                    e.stopPropagation();
                    fecharLote(a.id);
                  }}
                >
                  <Icone nome="x" tamanho={11} />
                </span>
              )}
            </button>
          ))}
          <button type="button" className={`${s.lote}`} onClick={criarLote} title="Novo lote de vídeos (processa separado)">
            <Icone nome="mais" tamanho={14} />
          </button>
        </nav>

        <div className={s.barraDireita}>
          <button type="button" className={`${s.btn} ${s.btnFantasma}`} onClick={() => setSobre({ tipo: 'resultados' })}>
            <Icone nome="pasta" /> Prontos {prontos > 0 && <span className={s.contador}>{prontos}</span>}
          </button>
          {abaAtiva.processando ? (
            <div className={s.processando}>
              <div className={s.processandoBarra} style={{ width: `${progressoLote * 100}%` }} />
              <span className={s.processandoTexto}>
                {abaAtiva.pausado ? 'Pausado' : abaAtiva.jobId ? 'Processando' : 'Preparando'} · {feitos}/{total}
              </span>
              <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`} onClick={pausar} title={abaAtiva.pausado ? 'Continuar' : 'Pausar'} disabled={!abaAtiva.jobId}>
                <Icone nome={abaAtiva.pausado ? 'play' : 'pausa'} tamanho={14} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone} ${s.btnPerigo}`} onClick={cancelar} title="Cancelar" disabled={!abaAtiva.jobId}>
                <Icone nome="parar" tamanho={13} />
              </button>
            </div>
          ) : (
            <button type="button" className={`${s.btn} ${s.btnPrimario}`} onClick={processar} disabled={!total} style={{ minWidth: 190 }}>
              <Icone nome="play" tamanho={14} /> {total ? `Processar ${total} vídeo${total > 1 ? 's' : ''}` : 'Processar'}
            </button>
          )}
        </div>
      </header>

      {/* ================= corpo ================= */}
      <div className={s.corpo}>
        <Lateral
          global={global}
          mudarGlobal={setGlobal}
          template={template}
          escolherTemplate={() => inputTemplate.current?.click()}
          musicas={musicas}
          importarMusicas={() => inputMusicas.current?.click()}
          removerMusica={(id) => {
            setMusicas((ms) => ms.filter((m) => m.id !== id));
            setGlobal((g) => (g.musica.musicaId === id ? { ...g, musica: { ...g.musica, musicaId: null } } : g));
          }}
          totalVideos={total}
          aplicarTextosEmMassa={(linhas) => {
            abaAtiva.videos.forEach((v, i) => i < linhas.length && atualizarVideo(v.id, { texto: linhas[i] }));
            setGlobal((g) => ({ ...g, textoAtivo: true }));
            avisar(`Textos aplicados em ${Math.min(linhas.length, total)} vídeos`);
          }}
          redetectarTodos={() => redetectar(abaAtiva.videos)}
        />

        <main className={s.area}>
          <Grade
            videos={abaAtiva.videos}
            selecionados={selecionados}
            ativoId={ativoId}
            clicar={clicar}
            alternarSelecao={alternarSelecao}
            acao={acaoCard}
            remover={(id) => {
              const lista = alvos(id);
              if (lista.length > 1 && !window.confirm(`Remover ${lista.length} vídeos selecionados?`)) return;
              removerVideos(lista);
            }}
            selecionarTodos={() => setSelecionados(new Set(abaAtiva.videos.map((v) => v.id)))}
            limparSelecao={() => setSelecionados(new Set())}
            global={global}
            template={global.moldura.ativo ? null : template}
            soltarArquivos={adicionarVideos}
            adicionarVideos={() => inputVideos.current?.click()}
            escolherTemplate={() => inputTemplate.current?.click()}
          />
        </main>

        <Inspetor
          video={ativo}
          editando={editando}
          global={global}
          template={global.moldura.ativo ? null : template}
          musicas={musicas}
          atualizarAtivo={(fn) => ativo && atualizarVideo(ativo.id, (v) => fn(v))}
          atualizarSelecionados={atualizarSelecionados}
          redetectar={() => redetectar(editando)}
          avisar={avisar}
        />
      </div>

      {/* ================= rodapé ================= */}
      <footer className={s.rodape}>
        <span className={s.rodapeStatus} title={status}>
          {status}
        </span>
        {enviando > 0 && <span>Enviando {enviando}…</span>}
        {analisandoN > 0 && <span>Analisando {analisandoN}…</span>}
        <button type="button" className={s.rodapeBtn} onClick={() => setLogAberto(!logAberto)}>
          <Icone nome="log" tamanho={13} /> Log {temErroLog && <span style={{ color: '#f87171' }}>●</span>}
        </button>
      </footer>

      {logAberto && <GavetaLog log={log} limpar={() => setLog([])} fechar={() => setLogAberto(false)} />}
      {sobre?.tipo === 'resultados' && (
        <PainelResultados
          resultados={resultados}
          fechar={() => setSobre(null)}
          apagar={async (jobId) => {
            if (!window.confirm('Apagar estes vídeos do servidor?')) return;
            await api.apagarProcessados(jobId).catch(() => {});
            setResultados((rs) => rs.filter((r) => r.jobId !== jobId));
          }}
        />
      )}
      {sobre?.tipo === 'concluido' && (
        <ModalConcluido
          aba={sobre.aba}
          ok={sobre.ok}
          falhas={sobre.falhas}
          jobId={sobre.jobId}
          verResultados={() => setSobre({ tipo: 'resultados' })}
          limparLote={() => {
            const a = abasRef.current.find((x) => x.id === sobre.abaId);
            if (a) removerVideos(a.videos.filter((v) => v.statusJob === 'ok').map((v) => v.id));
            setSobre(null);
          }}
          fechar={() => setSobre(null)}
        />
      )}
      {toast && <div className={s.toast}>{toast}</div>}

      <input
        ref={inputVideos}
        type="file"
        accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v"
        multiple
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (f.length) adicionarVideos(f);
        }}
      />
      <input
        ref={inputTemplate}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) escolherTemplate(f);
        }}
      />
      <input
        ref={inputMusicas}
        type="file"
        accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.wma,video/mp4"
        multiple
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (f.length) adicionarMusicas(f);
        }}
      />
    </div>
  );
}
