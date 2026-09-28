'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import * as api from '@/lib/editor-massa/client/api';
import { abrirVideo, capturarQuadro, carregarImagem, detectarNoNavegador, duracaoAudio, lerMeta } from '@/lib/editor-massa/client/midia';
import { gerarOverlayPng, temOverlay } from '@/lib/editor-massa/client/render';
import { finalizarArea } from '@/lib/editor-massa/deteccao-core';
import { completarConfig, configGlobalPadrao, FONTES_GOOGLE, novoVideo } from '@/lib/editor-massa/defaults';
import {
  areaVideoTemplate,
  cantosDoTemplate,
  carregarTemplateClipost,
  estiloDoTemplate,
  gerarImagemTemplate,
  legendaDoTemplate,
  marcaDoTemplate,
  prepararMarca,
  salvarTemplateClipost,
  type TemplateClipost,
} from '@/lib/editor-massa/client/templateClipost';
import type { ConfigGlobal, ConfigVideo, VideoJob } from '@/lib/editor-massa/types';
import { novaAba, novoId, type Aba, type MusicaCliente, type ResultadoJob, type TemplateCliente, type VideoCliente } from './estado';
import EditarTemplate from './EditarTemplate';
import {
  apagarArquivo,
  carregarEstado,
  carregarResultados,
  pedirArmazenamentoPersistente,
  salvarArquivo,
  salvarEstado,
  salvarResultados,
} from './persistencia';
import Grade from './Grade';
import { Icone } from './icones';
import Inspetor from './Inspetor';
import Lateral from './Lateral';
import { GavetaLog, ModalConcluido, PainelResultados } from './Paineis';
import ImportarPerfil from './ImportarPerfil';
import BibliotecaMusicas from '@/components/musicas/BibliotecaMusicas';
import { enviarMusicaNuvem, listarMusicas } from '@/lib/musicas';
import s from './editor-massa.module.css';

type Sobreposicao = { tipo: 'resultados' } | { tipo: 'concluido'; aba: string; abaId: string; ok: number; falhas: number; jobId: string } | null;

const CHAVE_CONFIG = 'clipost:editor-massa:config';
const ANALISES_SIMULTANEAS = 2;

// O Storage (Supabase) recusa conexões quando muitos vídeos de 20 MB baixam juntos
// (ERR_HTTP2_SERVER_REFUSED_STREAM) — e o vídeo parecia "formato que não toca". Fila: 3 por vez.
const DOWNLOADS_SIMULTANEOS = 3;
let downloadsAtivos = 0;
const filaDownloads: (() => void)[] = [];
async function baixarNaFila(url: string): Promise<Blob> {
  if (downloadsAtivos >= DOWNLOADS_SIMULTANEOS) await new Promise<void>((res) => filaDownloads.push(res));
  downloadsAtivos++;
  try {
    for (let tentativa = 0; ; tentativa++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.blob();
      } catch (e) {
        if (tentativa >= 2) throw e;
        await new Promise((res) => setTimeout(res, 1500 * (tentativa + 1)));
      }
    }
  } finally {
    downloadsAtivos--;
    filaDownloads.shift()?.();
  }
}
const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const emCampoDeTexto = (e: Event) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '');

/** Só os campos de ConfigVideo (sem File, ImageBitmap etc.) */
function paraConfig(v: VideoCliente): ConfigVideo {
  const { arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob, restaurado, ...cfg } = v;
  void arquivo, url, upload, uploadErro, quadro, carregado, tocavel, detectando, statusJob, progressoJob, saidaJob, restaurado;
  return cfg;
}

function carregarConfig(): ConfigGlobal {
  try {
    const r = completarConfig(JSON.parse(localStorage.getItem(CHAVE_CONFIG) || 'null'));
    // Agora o fundo é sempre o template Clipost (sem "fundo de cor"/imagem avulsa).
    // A música escolhida volta junto com as músicas salvas no navegador (ver restauração).
    return { ...r, moldura: { ...r.moldura, ativo: false } };
  } catch {
    return configGlobalPadrao();
  }
}

/** Carrega uma fonte (nome simples ou pilha CSS do template) antes de desenhar no canvas */
const carregarFonte = (f: string) => document.fonts?.load(`bold 40px ${f.includes(',') ? f : `"${f}"`}`).catch(() => null);

/** Projeto do Criar Cortes aberto no estúdio (os cortes prontos viram um lote) */
export interface ProjetoEstudio {
  id: string;
  titulo: string;
  isYouTube?: boolean;
  /** vídeos crus (ex.: baixados de um perfil): o template é aplicado aqui, não veio embutido */
  crus?: boolean;
  clips: { id: string; url: string; titulo: string; pronto?: boolean; status?: string }[];
}

export default function EditorMassa({
  projeto,
  titulo,
  abasModo,
  acoesExtras,
  onAgendar,
}: {
  projeto?: ProjetoEstudio;
  titulo?: string;
  abasModo?: ReactNode;
  acoesExtras?: ReactNode;
  onAgendar?: () => void;
} = {}) {
  const [emMassa, setEmMassa] = useState(true);
  const [larguraLateral, setLarguraLateral] = useState(330);
  const [lateralRecolhida, setLateralRecolhida] = useState(false);
  const [ferramentaAtiva, setFerramentaAtiva] = useState<string | null>(null);
  const [global, setGlobal] = useState<ConfigGlobal>(configGlobalPadrao);
  const [abas, setAbas] = useState<Aba[]>(() => [novaAba(1)]);
  const [abaAtivaId, setAbaAtivaId] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateCliente | null>(null);
  const [musicas, setMusicas] = useState<MusicaCliente[]>([]);
  const [bibliotecaMusicas, setBibliotecaMusicas] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState('Pronto');
  const [resultados, setResultados] = useState<ResultadoJob[]>([]);
  const [sobre, setSobre] = useState<Sobreposicao>(null);
  const [importarAberto, setImportarAberto] = useState(false);
  // Lote aberto pelo Explorador de perfis ("Editor"): os vídeos entram sozinhos na grade
  const [loteImportar, setLoteImportar] = useState<string | null>(null);
  // Lote com a lista (busca de perfil → "Editar com template"): cards "carregando" já aparecem
  const [loteComCards, setLoteComCards] = useState<{ batch: string; itens: { titulo: string }[] } | null>(null);
  useEffect(() => {
    try {
      const lote = localStorage.getItem('clipost:editor-importar-lote');
      if (lote) {
        localStorage.removeItem('clipost:editor-importar-lote');
        let dados: any = null;
        try { dados = JSON.parse(lote); } catch { dados = null; }
        if (dados && typeof dados === 'object' && dados.batch) setLoteComCards(dados);
        else {
          setLoteImportar(lote);
          setImportarAberto(true);
        }
      }
    } catch {
      // sem storage
    }
  }, []);
  const [logAberto, setLogAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gatilhoAnalise, setGatilhoAnalise] = useState(0);
  const [tplClipost, setTplClipost] = useState<TemplateClipost | null>(null);
  const [carregandoTpl, setCarregandoTpl] = useState(true);
  const [editarTplAberto, setEditarTplAberto] = useState(false);
  const [salvandoTpl, setSalvandoTpl] = useState(false);
  const tplRef = useRef(tplClipost);
  tplRef.current = tplClipost;
  const tplMudou = useRef(false);

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
    Promise.all([global.estiloTexto.fonte, global.marca.fonte].map(carregarFonte)).then(() => setGlobal((g) => ({ ...g })));
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
    async (v: VideoCliente) => {
      let arquivo = v.arquivo;
      // card ainda "carregando" (sem arquivo e sem link): nada para enviar — antes virava um 500 no servidor
      if (arquivo.size === 0 && !(v.url && v.url.startsWith('http'))) throw new Error('vídeo ainda não chegou');
      if (arquivo.size === 0 && v.url && v.url.startsWith('http')) {
        escreverLog(`[DIAG] Baixando ${v.nome} antes do upload...`);
        try {
          const blob = await baixarNaFila(v.url);
          arquivo = new File([blob], v.nome, { type: blob.type || 'video/mp4' });
          atualizarVideo(v.id, { arquivo });
        } catch (e: any) {
          escreverLog(`[ERRO] Falha ao baixar ${v.nome}: ${e?.message ?? e}`);
          throw e;
        }
      }
      return enviar(v.id, arquivo, (f) => atualizarVideo(v.id, { upload: f }))
        .then((id) => {
          atualizarVideo(v.id, { arquivoId: id, upload: 1, uploadErro: null });
          return id;
        })
        .catch((e) => {
          atualizarVideo(v.id, { uploadErro: String(e.message ?? e) });
          escreverLog(`[ERRO] Upload ${v.nome}: ${e.message ?? e}`);
          throw e;
        });
    },
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
          ({ area, origem } = finalizarArea(await detectarNoNavegador(el, v, globalRef.current.deteccao.cortarTexto), v.largura, v.altura));
        } else {
          const arquivoId = v.arquivoId ?? (await uploads.current.get(v.id));
          const r = await api.analisarNoServidor(arquivoId!, 'auto', globalRef.current.deteccao.cortarTexto);
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
        try {
          el = await abrirVideo(v.url);
        } catch (e) {
          // da internet: demorou (muitos abrindo juntos), não é formato ruim — tenta mais uma vez com calma
          if (!/^https?:/.test(v.url)) throw e;
          el = await abrirVideo(v.url, 90000);
        }
        const meta = await lerMeta(el);
        if (!meta.largura) throw new Error('sem vídeo');
        const quadro = await capturarQuadro(el, Math.min(1.0, Math.max(0.5, meta.duracao * 0.1)), 720);
        atualizarVideo(v.id, { ...meta, quadro, carregado: true, tocavel: true });
        // vídeo que voltou do armazenamento já tem a área detectada (e talvez ajustada à mão)
        if (!(v.restaurado && v.origemDeteccao)) await detectar(el, { ...v, ...meta });
      } catch {
        // formato que o navegador não abre → o servidor analisa após o upload
        atualizarVideo(v.id, { tocavel: false });
        try {
          const arquivoId = await (uploads.current.get(v.id) ?? enviarVideo(v));
          const r = await api.analisarNoServidor(arquivoId, globalRef.current.deteccao.modo, globalRef.current.deteccao.cortarTexto);
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
    // card ainda "carregando" (sem arquivo e sem link) espera o vídeo chegar antes de ser analisado
    const pendentes = todos.filter((v) => !v.carregado && !analisando.current.has(v.id) && (v.arquivo.size > 0 || !!v.url));
    pendentes.slice(0, Math.max(0, ANALISES_SIMULTANEAS - analisando.current.size)).forEach((v) => analisar(v));
  }, [abas, abaAtiva, gatilhoAnalise, analisar]);

  const adicionarVideos = useCallback(
    (arquivos: File[], opcoes?: { abaId?: string; extras?: (Partial<ConfigVideo> & { id?: string })[]; silencioso?: boolean; substituir?: boolean }) => {
      const novos: VideoCliente[] = arquivos.map((arquivo, i) => ({
        ...novoVideo({ id: opcoes?.extras?.[i]?.id ?? novoId(), nome: arquivo.name, largura: 0, altura: 0, duracao: 0 }),
        ...(opcoes?.extras?.[i] ?? {}),
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
      const alvo = opcoes?.abaId ?? abaAtiva.id;
      setAbas((as) =>
        as.map((a) => {
          if (a.id !== alvo) return a;
          // substituir: o vídeo entra no lugar do card "carregando" que tem o mesmo id
          if (opcoes?.substituir) {
            const porId = new Map(novos.map((n) => [n.id, n]));
            const trocados = a.videos.map((v) => porId.get(v.id) ?? v);
            const faltam = novos.filter((n) => !a.videos.some((v) => v.id === n.id));
            return { ...a, videos: [...trocados, ...faltam] };
          }
          return { ...a, videos: [...a.videos, ...novos] };
        }),
      );
      novos.forEach((v) => {
        salvarArquivo(v.id, v.arquivo);
        enviarVideo(v).catch(() => {});
      });
      if (!opcoes?.silencioso) avisar(`${novos.length} vídeo(s) adicionados`);
      if (!ativoId && novos[0]) setAtivoId(novos[0].id);
    },
    [abaAtiva.id, enviarVideo, avisar, ativoId],
  );

  // ---------- projeto do Criar Cortes: todos os cortes prontos entram num lote próprio ----------
  const [restaurado, setRestaurado] = useState(false);
  const clipsEmImportacao = useRef(new Set<string>());
  // cortes cujo vídeo já começou a carregar (os que ainda estavam sendo gerados entram quando ficam prontos)
  const clipsComVideo = useRef(new Set<string>());
  // ---------- lote da busca de perfil: um card "carregando" por vídeo, trocado quando baixa ----------
  useEffect(() => {
    if (!loteComCards || !restaurado) return;
    const { batch, itens } = loteComCards;
    const idDe = (i: number) => `lote-${batch}-${i}`;
    const cards: VideoCliente[] = itens.map((it, i) => ({
      ...novoVideo({ id: idDe(i), nome: `${String(i + 1).padStart(2, '0')} - ${(it.titulo || 'video').slice(0, 40)}.mp4`, largura: 1080, altura: 1920, duracao: 30 }),
      arquivo: new File([], 'carregando.mp4'),
      url: '',
      upload: 0,
      uploadErro: null,
      quadro: null,
      carregado: false,
      tocavel: false,
      detectando: false,
      statusJob: null,
      progressoJob: 0,
      saidaJob: null,
    }));
    setAbas((as) => as.map((a) => (a.id === abaAtiva.id ? { ...a, videos: [...a.videos, ...cards] } : a)));
    if (!ativoId && cards[0]) setAtivoId(cards[0].id);
    avisar(`Baixando ${itens.length} vídeo(s) — cada um aparece no seu card`);

    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const feitos = new Set<number>();
    const consultar = async () => {
      try {
        const res = await fetch(`/api/bulk/${batch}`, { cache: 'no-store' });
        const d = await res.json().catch(() => ({}));
        if (!ativo) return;
        const lista: { status: string; file_url?: string | null; title?: string }[] = d.items || [];
        for (let i = 0; i < lista.length; i++) {
          const it = lista[i];
          if (feitos.has(i)) continue;
          if (it.status === 'failed') {
            feitos.add(i);
            setAbas((as) => as.map((a) => ({ ...a, videos: a.videos.filter((v) => v.id !== idDe(i)) })));
            continue;
          }
          if (it.status !== 'done' || !it.file_url) continue;
          feitos.add(i);
          try {
            const blob = await baixarNaFila(it.file_url);
            const nome = `${String(i + 1).padStart(2, '0')} - ${(itens[i]?.titulo || it.title || 'video').replace(/[\\/:*?"<>|#\n\r]+/g, ' ').trim().slice(0, 50) || 'video'}.mp4`;
            adicionarRef.current([new File([blob], nome, { type: 'video/mp4' })], { extras: [{ id: idDe(i) }], silencioso: true, substituir: true });
          } catch {
            feitos.delete(i);
          }
        }
        if (d.status === 'done' || d.status === 'failed' || feitos.size >= itens.length) {
          if (d.status === 'failed' && d.error) escreverLog(`[FALHA] busca do perfil: ${d.error}`);
          return;
        }
      } catch {}
      if (ativo) timer = setTimeout(consultar, 2500);
    };
    consultar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteComCards, restaurado]);

  useEffect(() => {
    if (!projeto || !restaurado) return;
    const abaId = 'projeto-' + projeto.id;
    if (!abasRef.current.some((a) => a.id === abaId)) {
      // o lote do projeto substitui o lote vazio inicial
      setAbas((as) => [...as.filter((a) => a.videos.length || a.processando), { ...novaAba(1), id: abaId, nome: projeto.titulo.slice(0, 40) || 'Projeto' }]);
      setGlobal((g) => ({ ...g, textoAtivo: true, deteccao: { ...g.deteccao, modo: 'auto' } }));
    }
    setAbaAtivaId(abaId);

    const existentes = new Set(abasRef.current.flatMap((a) => a.videos.map((v) => v.id)));
    const novosParaInserir: VideoCliente[] = [];

    projeto.clips.forEach((c, i) => {
      const id = 'clip-' + c.id;
      const jaTem = existentes.has(id) || clipsEmImportacao.current.has(id);
      // corte que ainda estava sendo gerado: quando o vídeo fica pronto, carrega sozinho (sem F5)
      if (jaTem && (!c.url || clipsComVideo.current.has(id))) return;
      if (!jaTem) clipsEmImportacao.current.add(id);

      const nome = `${String(i + 1).padStart(2, '0')} - ${(c.titulo || 'corte').replace(/[\\/:*?"<>|#\n\r]+/g, ' ').slice(0, 50)}.mp4`;
      const vInicial: VideoCliente = {
        ...novoVideo({ id, nome, largura: 1080, altura: 1920, duracao: 45 }),
        texto: c.titulo,
        arquivo: new File([], nome),
        url: c.url || '',
        upload: 1,
        uploadErro: null,
        quadro: null,
        carregado: false,
        tocavel: !!c.url,
        marcaEmbutida: !projeto.crus,
        detectando: false,
        statusJob: null,
        progressoJob: 0,
        saidaJob: null,
      };
      if (!jaTem) novosParaInserir.push(vInicial);

      if (c.url) {
        clipsComVideo.current.add(id);
        baixarNaFila(c.url)
          .then(async (blob) => {
            const realFile = new File([blob], nome, { type: blob.type || 'video/mp4' });
            const localUrl = URL.createObjectURL(blob);
            let bmp: ImageBitmap | null = null;
            let vidW = 1080;
            let vidH = 1920;
            let vidDur = 45;
            try {
              const vid = await abrirVideo(localUrl);
              bmp = await capturarQuadro(vid, Math.min(1.5, (vid.duration || 45) * 0.2));
              vidW = vid.videoWidth || bmp.width;
              vidH = vid.videoHeight || bmp.height;
              vidDur = vid.duration || 45;
              vid.remove();
            } catch {
              // fallback
            }
            atualizarVideo(id, {
              arquivo: realFile,
              url: localUrl,
              quadro: bmp,
              carregado: true,
              tocavel: true,
              largura: vidW,
              altura: vidH,
              duracao: vidDur,
            });
          })
          .catch(() => {
            abrirVideo(c.url)
              .then(async (vid) => {
                const bmp = await capturarQuadro(vid, Math.min(1.5, (vid.duration || 45) * 0.2));
                const vidW = vid.videoWidth || bmp.width;
                const vidH = vid.videoHeight || bmp.height;
                const vidDur = vid.duration || 45;
                vid.remove();
                atualizarVideo(id, {
                  quadro: bmp,
                  carregado: true,
                  largura: vidW,
                  altura: vidH,
                  duracao: vidDur,
                });
              })
              .catch(() => {
                atualizarVideo(id, { carregado: true });
              });
          });
      }
    });

    if (novosParaInserir.length) {
      setAbas((as) => as.map((a) => (a.id === abaId ? { ...a, videos: [...a.videos, ...novosParaInserir] } : a)));
      if (!ativoId && novosParaInserir[0]) setAtivoId(novosParaInserir[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeto?.id, projeto?.clips.map((c) => c.id + (c.url ? '1' : '0')).join(','), restaurado]);
  const adicionarRef = useRef(adicionarVideos);
  adicionarRef.current = adicionarVideos;
  const removerVideos = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      abasRef.current.forEach((a) =>
        a.videos.forEach((v) => {
          if (!set.has(v.id)) return;
          URL.revokeObjectURL(v.url);
          cancelarUploads.current.get(v.id)?.();
          uploads.current.delete(v.id);
          apagarArquivo(v.id);
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

  const recarregarPrevias = useCallback(async () => {
    avisar('Recarregando prévias dos vídeos...');
    escreverLog('[PREVIA] Recarregando miniaturas e metadados...');
    for (const v of abaAtiva.videos) {
      if (!v.url) continue;
      try {
        const vid = await abrirVideo(v.url);
        const bmp = await capturarQuadro(vid, Math.min(1.5, (vid.duration || 45) * 0.2));
        const w = vid.videoWidth || bmp.width;
        const h = vid.videoHeight || bmp.height;
        vid.remove();
        atualizarVideo(v.id, {
          quadro: bmp,
          carregado: true,
          tocavel: true,
          largura: w,
          altura: h,
        });
      } catch {
        try {
          const r = await fetch(v.url);
          const b = await r.blob();
          const localUrl = URL.createObjectURL(b);
          const vid = await abrirVideo(localUrl);
          const bmp = await capturarQuadro(vid, Math.min(1.5, (vid.duration || 45) * 0.2));
          const w = vid.videoWidth || bmp.width;
          const h = vid.videoHeight || bmp.height;
          vid.remove();
          atualizarVideo(v.id, {
            arquivo: new File([b], v.nome, { type: b.type || 'video/mp4' }),
            url: localUrl,
            quadro: bmp,
            carregado: true,
            tocavel: true,
            largura: w,
            altura: h,
          });
        } catch (e: any) {
          escreverLog(`[PREVIA] Falha ao recarregar ${v.nome}: ${e?.message ?? e}`);
        }
      }
    }
    setGatilhoAnalise((n) => n + 1);
    avisar('Prévias recarregadas com sucesso!');
  }, [abaAtiva.videos, atualizarVideo, avisar, escreverLog]);

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

  // ---------- template Clipost (o mesmo do editor de Templates) ----------
  const aplicarTemplate = useCallback(
    async (t: TemplateClipost) => {
      try {
        const blob = await gerarImagemTemplate(t);
        const arquivo = new File([blob], 'template-clipost.png', { type: 'image/png' });
        const url = URL.createObjectURL(arquivo);
        const imagem = await carregarImagem(url);
        const marca = await prepararMarca(marcaDoTemplate(t));
        setTemplate((antigo) => {
          if (antigo) URL.revokeObjectURL(antigo.url);
          return { nome: 'Seu template', arquivo, url, imagem, arquivoId: null };
        });
        setGlobal((g) => ({
          ...g,
          moldura: { ...g.moldura, ativo: false },
          areaTemplate: areaVideoTemplate(t),
          cantos: cantosDoTemplate(t),
          marcaTemplate: marca,
          estiloTexto: estiloDoTemplate(t, g.estiloTexto, g.textoAjustado),
          // estilo e altura da legenda escolhidos no editor de Templates (liga/desliga continua do usuário)
          legendas: { ativo: g.legendas?.ativo ?? false, ...legendaDoTemplate(t) },
        }));
        enviar('template:' + url, arquivo, () => {})
          .then((id) => setTemplate((x) => (x && x.url === url ? { ...x, arquivoId: id } : x)))
          .catch((e) => escreverLog(`[ERRO] Upload do template: ${e.message}`));
      } catch (e: any) {
        escreverLog(`[ERRO] Template: ${e?.message ?? e}`);
        avisar('Não foi possível montar o seu template');
      }
    },
    [enviar, escreverLog, avisar],
  );

  useEffect(() => {
    let vivo = true;
    carregarTemplateClipost().then(async (t) => {
      if (!vivo) return;
      setTplClipost(t);
      await aplicarTemplate(t);
      if (vivo) setCarregandoTpl(false);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Voltar ao tamanho e posição do template"
  useEffect(() => {
    const t = tplRef.current;
    if (!global.textoAjustado && t) setGlobal((g) => ({ ...g, estiloTexto: estiloDoTemplate(t, g.estiloTexto, false) }));
  }, [global.textoAjustado]);

  // Edição rápida: redesenha o template 300ms depois da última mudança
  const timerTpl = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mudarTemplate = (parcial: Record<string, any>) => {
    const atual = tplRef.current;
    if (!atual) return;
    const novo = { ...atual, config: { ...atual.config, ...parcial } };
    setTplClipost(novo);
    tplMudou.current = true;
    if (timerTpl.current) clearTimeout(timerTpl.current);
    timerTpl.current = setTimeout(() => aplicarTemplate(novo), 300);
  };
  const concluirTemplate = async () => {
    const t = tplRef.current;
    if (t && tplMudou.current) {
      setSalvandoTpl(true);
      const ok = await salvarTemplateClipost(t);
      setSalvandoTpl(false);
      tplMudou.current = false;
      avisar(ok ? 'Template salvo' : 'Mudanças aplicadas aqui, mas não foi possível salvar no seu template');
    }
    setEditarTplAberto(false);
  };

  // ---------- vídeos, músicas e resultados salvos no navegador ----------
  const restaurou = useRef(false);
  useEffect(() => {
    pedirArmazenamentoPersistente();
    setResultados(carregarResultados());
    carregarEstado()
      .then((e) => {
        const salvas = e?.musicas ?? [];
        setGlobal((g) => (g.musica.musicaId && !salvas.some((m) => m.id === g.musica.musicaId) ? { ...g, musica: { ...g.musica, musicaId: null } } : g));
        if (!e) return;
        const temVideos = e.abas.some((a) => a.videos.length);
        if (temVideos || e.musicas.length) {
          // Na Edição em Massa (sem projeto) nunca abre no lote de um projeto do Criar Cortes:
          // esses lotes só aparecem na página do próprio projeto
          const deProjeto = (id: string) => id.startsWith('projeto-');
          // cards que ficaram "carregando" numa sessão anterior (sem arquivo e sem link) não voltam
          const semVazios = e.abas.map((a) => ({ ...a, videos: a.videos.filter((v) => v.arquivo.size > 0 || /^https?:/.test(v.url || '')) }));
          let lista = semVazios.length ? semVazios : [novaAba(1)];
          if (!projeto && lista.every((a) => deProjeto(a.id))) lista = [...lista, novaAba(1)];
          const preferida = lista.find((a) => a.id === e.abaAtivaId && (projeto || !deProjeto(a.id))) ?? lista.find((a) => projeto || !deProjeto(a.id)) ?? lista[0];
          setAbas(lista);
          setAbaAtivaId(preferida.id);
          setAtivoId(preferida.videos[0]?.id ?? null);
          setMusicas(e.musicas);
          lista.forEach((a) => a.videos.forEach((v) => enviarVideo(v).catch(() => {})));
          e.musicas.forEach((m) => enviarMusica(m));
          const n = e.abas.reduce((t, a) => t + a.videos.length, 0);
          if (n) avisar(`${n} vídeo(s) da última sessão recuperados`);
        }
      })
      .finally(() => {
        restaurou.current = true;
        setRestaurado(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restaurou.current) return;
    const t = setTimeout(() => salvarEstado(abas, abaAtivaId, musicas), 700);
    return () => clearTimeout(t);
  }, [abas, abaAtivaId, musicas]);

  useEffect(() => {
    if (restaurou.current) salvarResultados(resultados);
  }, [resultados]);

  // ---------- músicas ----------
  const enviarMusica = (m: MusicaCliente) =>
    enviar('musica:' + m.id, m.arquivo, (f) => setMusicas((ms) => ms.map((x) => (x.id === m.id ? { ...x, upload: f } : x))))
      .then((id) => setMusicas((ms) => ms.map((x) => (x.id === m.id ? { ...x, arquivoId: id, upload: 1 } : x))))
      .catch((e) => escreverLog(`[ERRO] Upload da música ${m.nome}: ${e.message}`));

  const adicionarMusicas = async (arquivos: File[], daNuvem = false) => {
    const novas: MusicaCliente[] = await Promise.all(
      arquivos.map(async (arquivo) => {
        const url = URL.createObjectURL(arquivo);
        return { id: novoId(), nome: arquivo.name, arquivo, url, duracao: await duracaoAudio(url), arquivoId: null, upload: 0 };
      }),
    );
    setMusicas((m) => [...m, ...novas]);
    novas.forEach((m) => {
      salvarArquivo('musica:' + m.id, m.arquivo);
      enviarMusica(m);
    });
    // Importou = está ativa (a primeira vira a música de fundo se ainda não tiver uma)
    if (novas[0] && !globalRef.current.musica.musicaId) setGlobal((g) => ({ ...g, musica: { ...g.musica, ativo: true, musicaId: novas[0].id } }));
    avisar(`${novas.length} música(s) importada(s)`);
    // Importada do computador: guarda também na biblioteca da conta (sem repetir o mesmo nome)
    if (!daNuvem) {
      listarMusicas()
        .then((salvas) => {
          const nomes = new Set(salvas.map((m) => m.nome.toLowerCase()));
          return Promise.all(arquivos.filter((a) => !nomes.has(a.name.replace(/\.[^.]+$/, '').toLowerCase())).map(enviarMusicaNuvem));
        })
        .catch(() => undefined);
    }
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
    if (!templateRef.current) return avisar(carregandoTpl ? 'Espere o seu template carregar' : 'Não foi possível carregar o seu template — recarregue a página');

    setAbas((as) => as.map((a) => (a.id === aba.id ? { ...a, processando: true, pausado: false, videos: a.videos.map((v) => ({ ...v, statusJob: 'fila', progressoJob: 0 })) } : a)));
    try {
      setStatus('Enviando arquivos…');
      const videosIds = await Promise.all(aba.videos.map((v) => uploads.current.get(v.id) ?? enviarVideo(v)));
      const tpl = templateRef.current;
      const templateArquivoId = tpl && !g.moldura.ativo ? (tpl.arquivoId ?? (await uploads.current.get('template:' + tpl.url)) ?? null) : null;

      const usadas = new Set<string>();
      if (g.musica.musicaId) usadas.add(g.musica.musicaId);
      aba.videos.forEach((v) => v.musica && usadas.add(v.musica.musicaId));
      const musicasMapa: Record<string, string> = {};
      for (const id of usadas) {
        const m = musicasRef.current.find((x) => x.id === id);
        if (m) musicasMapa[id] = m.arquivoId ?? (await uploads.current.get('musica:' + m.id))!;
      }

      setStatus('Preparando textos…');
      await Promise.all([g.estiloTexto.fonte, g.marca.fonte].map(carregarFonte));
      const tamTemplate = tpl ? { w: tpl.imagem.naturalWidth, h: tpl.imagem.naturalHeight } : null;
      // PNGs de texto em paralelo
      const videos: VideoJob[] = await Promise.all(
        aba.videos.map(async (v, i) => {
          const cfg = paraConfig(v);
          let overlayArquivoId: string | null = null;
          if (temOverlay(g, cfg) && v.largura) {
            const png = await gerarOverlayPng(g, cfg, tamTemplate, tpl?.imagem ?? null);
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
    a.videos.forEach((v) => {
      URL.revokeObjectURL(v.url);
      apagarArquivo(v.id);
    });
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

      {/* ================= barra superior unificada ================= */}
      <header className={s.barra}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            className={`${s.btn} ${s.btnFantasma} ${s.btnIcone}`}
            onClick={() => {
              if (lateralRecolhida) {
                setLateralRecolhida(false);
                setFerramentaAtiva('template');
              } else if (ferramentaAtiva) {
                setFerramentaAtiva(null);
              } else {
                setFerramentaAtiva('template');
              }
            }}
            title={ferramentaAtiva ? 'Ocultar painel de configurações' : 'Mostrar painel de configurações'}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Icone nome="chevron" tamanho={13} style={{ transform: ferramentaAtiva ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }} />
          </button>
          <div className={s.logo} title={titulo}>
            <span className={s.logoMarca}>
              <Icone nome="sparkles" tamanho={14} />
            </span>
            <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {titulo ?? 'Estúdio'}
            </span>
          </div>
          {abasModo}
        </div>

        <div className={s.barraDireita}>
          {acoesExtras}
          {abaAtiva.processando ? (
            <div className={s.processando}>
              <div className={s.processandoBarra} style={{ width: `${progressoLote * 100}%` }} />
              <span className={s.processandoTexto}>
                {abaAtiva.pausado ? 'Pausado' : 'Processando'} · {feitos}/{total}
              </span>
              <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`} onClick={pausar} title={abaAtiva.pausado ? 'Continuar' : 'Pausar'} disabled={!abaAtiva.jobId}>
                <Icone nome={abaAtiva.pausado ? 'play' : 'pausa'} tamanho={14} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone} ${s.btnPerigo}`} onClick={cancelar} title="Cancelar" disabled={!abaAtiva.jobId}>
                <Icone nome="parar" tamanho={13} />
              </button>
            </div>
          ) : (
            <>
              {projeto && onAgendar && (
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimario}`}
                  onClick={onAgendar}
                  style={{ minWidth: 200 }}
                  title="Agendar todos os cortes nas redes sociais"
                >
                  <Icone nome="calendario" tamanho={14} /> Seguir para agendamento
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* ================= corpo com largura dinâmica da lateral ================= */}
      <div
        className={s.corpo}
        style={{
          gridTemplateColumns: `${lateralRecolhida ? '0px' : (ferramentaAtiva ? '388px' : '68px')} minmax(0, 1fr) 390px`,
          transition: 'grid-template-columns 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {lateralRecolhida && (
          <button
            type="button"
            className={s.btnExpandirLateral}
            onClick={() => setLateralRecolhida(false)}
            title="Expandir barra lateral de configurações"
          >
            <Icone nome="chevron" tamanho={14} style={{ transform: 'rotate(-90deg)' }} />
            <span>Editar</span>
          </button>
        )}

        <Lateral
          aoProcessar={processar}
          onAgendar={onAgendar}
          processando={abaAtiva.processando}
          ferramentaAtiva={ferramentaAtiva}
          setFerramentaAtiva={setFerramentaAtiva}
          global={global}
          mudarGlobal={setGlobal}
          template={template}
          tplClipost={tplClipost}
          mudarTemplate={mudarTemplate}
          perfilTemplate={String(tplClipost?.config?.brandHandle || tplClipost?.config?.brandName || tplClipost?.username || '')}
          carregandoTemplate={carregandoTpl}
          musicas={musicas}
          importarMusicas={() => inputMusicas.current?.click()}
          abrirBibliotecaMusicas={() => setBibliotecaMusicas(true)}
          removerMusica={(id) => {
            apagarArquivo('musica:' + id);
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
          isYouTube={projeto?.isYouTube}
          emMassa={emMassa}
          setEmMassa={setEmMassa}
          videoAtivo={ativo}
          atualizarAtivo={(fn) => ativo && atualizarVideo(ativo.id, (v) => fn(v))}
          atualizarTodos={atualizarSelecionados}
          largura={larguraLateral}
          setLargura={setLarguraLateral}
          recolhido={lateralRecolhida}
          setRecolhido={setLateralRecolhida}
        />

        <main className={s.area}>
          <Grade
            videos={abaAtiva.videos}
            selecionados={selecionados}
            ativoId={ativoId}
            clicar={clicar}
            alternarSelecao={alternarSelecao}
            acao={acaoCard}
            recarregarPrevias={recarregarPrevias}
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
            escolherTemplate={() => setEditarTplAberto(true)}
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
      {bibliotecaMusicas && <BibliotecaMusicas fechar={() => setBibliotecaMusicas(false)} aoEscolher={(arquivos) => adicionarMusicas(arquivos, true)} />}
      {importarAberto && <ImportarPerfil loteInicial={loteImportar} fechar={() => { setImportarAberto(false); setLoteImportar(null); }} aoArquivos={adicionarVideos} />}

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
      {editarTplAberto && tplClipost && (
        <EditarTemplate config={{ ...tplClipost.config }} mudar={mudarTemplate} salvando={salvandoTpl} concluir={concluirTemplate} />
      )}
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
