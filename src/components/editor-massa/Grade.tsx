'use client';

import { memo, useDeferredValue, useEffect, useRef, useState, type MouseEvent } from 'react';
import { desenharComposicao } from '@/lib/editor-massa/client/render';
import { calcularLayout } from '@/lib/editor-massa/layout';
import type { ConfigGlobal, ConfigVideo } from '@/lib/editor-massa/types';
import type { TemplateCliente, VideoCliente } from './estado';
import { Icone } from './icones';
import s from './editor-massa.module.css';

export interface PropsGrade {
  videos: VideoCliente[];
  selecionados: Set<string>;
  ativoId: string | null;
  clicar: (id: string, e: MouseEvent) => void;
  alternarSelecao: (id: string) => void;
  acao: (id: string, fn: (v: ConfigVideo) => Partial<ConfigVideo>, individual?: boolean) => void;
  remover: (id: string) => void;
  selecionarTodos: () => void;
  limparSelecao: () => void;
  global: ConfigGlobal;
  template: TemplateCliente | null;
  soltarArquivos: (arquivos: File[]) => void;
  adicionarVideos: () => void;
  escolherTemplate: () => void;
}

const ehVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name);

export default function Grade(p: PropsGrade) {
  const [arrastando, setArrastando] = useState(false);
  const global = useDeferredValue(p.global);
  const template = useDeferredValue(p.template?.imagem ?? null);

  const eventosSoltar = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setArrastando(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastando(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setArrastando(false);
      const arquivos = Array.from(e.dataTransfer.files).filter(ehVideo);
      if (arquivos.length) p.soltarArquivos(arquivos);
    },
  };

  const nSel = p.selecionados.size;

  if (!p.videos.length) {
    return (
      <div className={`${s.vazio} ${arrastando ? s.arrastando : ''}`} {...eventosSoltar}>
        <div className={s.vazioCaixa}>
          <div className={s.vazioIcone}>
            <Icone nome="sparkles" tamanho={24} />
          </div>
          <div className={s.vazioTitulo}>Nenhum corte carregado</div>
          <div className={s.dica}>Aguardando finalização da IA ou adicione vídeos manualmente</div>
          <button type="button" className={`${s.btn} ${s.btnPrimario}`} onClick={p.adicionarVideos}>
            <Icone nome="mais" /> Adicionar vídeos
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={s.areaCabeca}>
        <span className={s.areaTitulo}>{p.videos.length} corte{p.videos.length === 1 ? '' : 's'}</span>
        {nSel > 1 && (
          <span className={`${s.chip} ${s.chipAcento}`}>{nSel} selecionados · edições valem para todos</span>
        )}
        <span className={s.espaco} />
        {nSel > 0 ? (
          <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`} onClick={p.limparSelecao}>
            Limpar seleção
          </button>
        ) : (
          <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`} onClick={p.selecionarTodos}>
            Selecionar todos
          </button>
        )}
      </div>
      <div
        className={`${s.grade} ${arrastando ? s.arrastando : ''}`}
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        {...eventosSoltar}
      >
        {p.videos.map((v) => (
          <Card
            key={v.id}
            v={v}
            selecionado={p.selecionados.has(v.id) && nSel > 1}
            ativo={p.ativoId === v.id}
            global={global}
            template={template}
            clicar={p.clicar}
            alternarSelecao={p.alternarSelecao}
            acao={p.acao}
            remover={p.remover}
          />
        ))}
      </div>
    </>
  );
}

interface PropsCard {
  v: VideoCliente;
  selecionado: boolean;
  ativo: boolean;
  global: ConfigGlobal;
  template: HTMLImageElement | null;
  clicar: (id: string, e: MouseEvent) => void;
  alternarSelecao: (id: string) => void;
  acao: PropsGrade['acao'];
  remover: (id: string) => void;
}

const Card = memo(function Card({ v, selecionado, ativo, global, template, clicar, alternarSelecao, acao, remover }: PropsCard) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [videoPronto, setVideoPronto] = useState(false);

  // Se o corte ainda está sendo gerado pela IA no backend
  const ehPendente = !v.carregado && (!v.url || v.statusJob === 'fila' || v.statusJob === 'detectando');

  useEffect(() => {
    const c = ref.current;
    if (!c || ehPendente) return;
    const tpl = template && !global.moldura.ativo ? { w: template.naturalWidth, h: template.naturalHeight } : null;
    const L = calcularLayout(global, v, tpl);
    const w = 300;
    const h = Math.round((w * L.canvas.h) / L.canvas.w);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const quadro = v.quadro ? { imagem: v.quadro, largura: v.quadro.width, altura: v.quadro.height } : null;
    desenharComposicao(c.getContext('2d')!, global, v, template, quadro, { w, h });
  }, [v, global, template, ehPendente]);

  if (ehPendente) {
    return (
      <div className={`${s.card} ${s.cardSkeleton}`}>
        <div className={s.shimmerEffect} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
            {v.nome.slice(0, 4)}
          </span>
          <span style={{ fontSize: '9px', fontWeight: 600, color: '#818cf8', background: 'rgba(99,102,241,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
            Carregando
          </span>
        </div>
        <div className={s.skeletonCentro} style={{ zIndex: 2 }}>
          <Icone nome="sparkles" tamanho={22} className={s.girando} style={{ color: '#818cf8' }} />
          <span>{v.texto || 'Carregando corte…'}</span>
        </div>
        <div className={s.skeletonLinhas} style={{ zIndex: 2 }}>
          <div className={s.skeletonBarra} style={{ width: '85%' }} />
          <div className={s.skeletonBarra} style={{ width: '55%' }} />
        </div>
      </div>
    );
  }

  const espelhado = global.efeitos.espelhar !== v.espelhar;
  const recortado = Object.values(v.recorte).some(Boolean) || Object.values(v.vcrop).some(Boolean);

  let estado: { texto: string; classe?: string } | null = null;
  if (v.uploadErro) estado = { texto: 'Falha no envio', classe: s.estadoErro };
  else if (v.statusJob === 'ok') estado = { texto: '✓ Pronto', classe: s.estadoOk };
  else if (v.statusJob === 'erro') estado = { texto: 'Erro', classe: s.estadoErro };
  else if (v.statusJob === 'processando') estado = { texto: `${Math.round(v.progressoJob * 100)}%`, classe: s.estadoAviso };
  else if (!v.carregado) estado = { texto: 'Carregando…' };
  else if (v.upload < 1) estado = { texto: `Enviando ${Math.round(v.upload * 100)}%` };

  const barra = v.statusJob === 'processando' ? v.progressoJob : v.upload < 1 && !v.uploadErro ? v.upload : null;

  return (
    <div className={`${s.card} ${ativo ? s.cardAtivo : ''} ${selecionado ? s.cardSel : ''}`}>
      <div className={s.thumb} onClick={(e) => clicar(v.id, e)}>
        <canvas ref={ref} />
        {/* Fallback de vídeo caso o quadro do canvas ainda não esteja pronto */}
        {!v.quadro && v.url && (
          <video
            src={`${v.url}#t=1`}
            preload="metadata"
            muted
            playsInline
            onLoadedData={() => setVideoPronto(true)}
            style={{ display: videoPronto ? 'block' : 'none', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <button
          type="button"
          className={s.cardCheck}
          title="Selecionar"
          onClick={(e) => {
            e.stopPropagation();
            alternarSelecao(v.id);
          }}
        >
          {selecionado && <Icone nome="check" tamanho={12} strokeWidth={3} />}
        </button>
        {estado && <span className={`${s.estado} ${estado.classe ?? ''}`}>{estado.texto}</span>}
        <div className={s.indicadores}>
          {espelhado && (
            <span className={s.indicador} title="Espelhado">
              <Icone nome="espelhar" tamanho={12} />
            </span>
          )}
          {v.mudo && (
            <span className={s.indicador} title="Sem áudio">
              <Icone nome="somOff" tamanho={12} />
            </span>
          )}
          {v.musica && (
            <span className={s.indicador} title="Música própria">
              <Icone nome="musica" tamanho={12} />
            </span>
          )}
          {(v.corte || recortado) && (
            <span className={s.indicador} title="Cortado">
              <Icone nome="tesoura" tamanho={12} />
            </span>
          )}
        </div>
        {barra != null && (
          <div className={s.barraProg}>
            <span style={{ width: `${barra * 100}%` }} />
          </div>
        )}
      </div>
      <input
        className={s.cardTexto}
        placeholder="Título do corte"
        value={v.texto}
        onChange={(e) => {
          const t = e.target.value;
          acao(v.id, () => ({ texto: t }), true);
        }}
      />
    </div>
  );
});
