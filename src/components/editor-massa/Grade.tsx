'use client';

import { memo, useDeferredValue, useEffect, useRef, useState, type MouseEvent } from 'react';
import { desenharComposicao } from '@/lib/editor-massa/client/render';
import { calcularLayout } from '@/lib/editor-massa/layout';
import type { ConfigGlobal, ConfigVideo } from '@/lib/editor-massa/types';
import { Segmentado } from './campos';
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

const TAMANHOS = { P: 130, M: 175, G: 240 } as const;

const ehVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name);

export default function Grade(p: PropsGrade) {
  const [tamanho, setTamanho] = useState<keyof typeof TAMANHOS>('M');
  const [arrastando, setArrastando] = useState(false);
  // miniaturas redesenham "depois" — arrastar um slider não trava a tela com muitos vídeos
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
            <Icone nome="upload" tamanho={24} />
          </div>
          <div className={s.vazioTitulo}>Arraste seus vídeos para cá</div>
          <div className={s.dica}>MP4, MOV, AVI, MKV ou WEBM · quantos quiser</div>
          <button type="button" className={`${s.btn} ${s.btnPrimario}`} onClick={p.adicionarVideos}>
            <Icone nome="mais" /> Adicionar vídeos
          </button>
          <div className={s.passos}>
            <span className={s.passo}>
              <span className={s.passoNum}>1</span> Adicione os vídeos
            </span>
            <span className={s.passo}>
              <span className={`${s.passoNum} ${p.template || p.global.moldura.ativo ? s.passoFeito : ''}`}>
                {p.template || p.global.moldura.ativo ? <Icone nome="check" tamanho={12} /> : 2}
              </span>
              {p.template ? (
                'Template escolhido'
              ) : (
                <a href="#" onClick={(e) => (e.preventDefault(), p.escolherTemplate())} style={{ color: 'inherit' }}>
                  Escolha o template
                </a>
              )}
            </span>
            <span className={s.passo}>
              <span className={s.passoNum}>3</span> Processe todos de uma vez
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={s.areaCabeca}>
        <span className={s.areaTitulo}>{p.videos.length} vídeos</span>
        {nSel > 1 ? (
          <span className={`${s.chip} ${s.chipAcento}`}>{nSel} selecionados · edições valem para todos</span>
        ) : (
          <span className={s.areaSub}>Ctrl/Shift + clique para selecionar vários</span>
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
        <div style={{ width: 96 }}>
          <Segmentado
            valor={tamanho}
            mudar={setTamanho}
            opcoes={[
              { valor: 'P', rotulo: 'P', titulo: 'Miniaturas pequenas' },
              { valor: 'M', rotulo: 'M', titulo: 'Miniaturas médias' },
              { valor: 'G', rotulo: 'G', titulo: 'Miniaturas grandes' },
            ]}
          />
        </div>
        <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.adicionarVideos}>
          <Icone nome="mais" tamanho={14} /> Adicionar
        </button>
      </div>
      <div
        className={`${s.grade} ${arrastando ? s.arrastando : ''}`}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TAMANHOS[tamanho]}px, 1fr))` }}
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

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
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
  }, [v, global, template]);

  const sb = v.semBordas ?? global.semBordas;
  const espelhado = global.efeitos.espelhar !== v.espelhar;
  const recortado = Object.values(v.recorte).some(Boolean) || Object.values(v.vcrop).some(Boolean);

  let estado: { texto: string; classe?: string } | null = null;
  if (v.uploadErro) estado = { texto: 'Falha no envio', classe: s.estadoErro };
  else if (v.statusJob === 'ok') estado = { texto: '✓ Pronto', classe: s.estadoOk };
  else if (v.statusJob === 'erro') estado = { texto: 'Erro', classe: s.estadoErro };
  else if (v.statusJob === 'processando') estado = { texto: `${Math.round(v.progressoJob * 100)}%`, classe: s.estadoAviso };
  else if (v.statusJob === 'detectando' || v.statusJob === 'fila') estado = { texto: 'Na fila', classe: s.estadoAviso };
  else if (!v.carregado) estado = { texto: 'Carregando…' };
  else if (v.detectando) estado = { texto: 'Detectando…' };
  else if (v.upload < 1) estado = { texto: `Enviando ${Math.round(v.upload * 100)}%` };

  const barra = v.statusJob === 'processando' ? v.progressoJob : v.upload < 1 && !v.uploadErro ? v.upload : null;

  return (
    <div className={`${s.card} ${ativo ? s.cardAtivo : ''} ${selecionado ? s.cardSel : ''}`}>
      <div className={s.thumb} onClick={(e) => clicar(v.id, e)}>
        <canvas ref={ref} />
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
        <div className={s.cardAcoes} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`${s.acao} ${v.espelhar ? s.acaoLigada : ''}`} title="Espelhar" onClick={() => acao(v.id, (x) => ({ espelhar: !x.espelhar }))}>
            <Icone nome="espelhar" tamanho={14} />
          </button>
          <button
            type="button"
            className={`${s.acao} ${v.semBordas != null ? s.acaoLigada : ''}`}
            title={sb ? 'Sem bordas: ligado' : 'Sem bordas: desligado'}
            onClick={() => acao(v.id, (x) => ({ semBordas: !(x.semBordas ?? global.semBordas) }))}
          >
            <Icone nome="expandir" tamanho={14} />
          </button>
          <button type="button" className={`${s.acao} ${v.mudo ? s.acaoLigada : ''}`} title={v.mudo ? 'Sem áudio' : 'Tirar áudio'} onClick={() => acao(v.id, (x) => ({ mudo: !x.mudo }))}>
            <Icone nome={v.mudo ? 'somOff' : 'som'} tamanho={14} />
          </button>
          <button type="button" className={`${s.acao} ${s.acaoPerigo}`} title="Remover" onClick={() => remover(v.id)}>
            <Icone nome="lixo" tamanho={14} />
          </button>
        </div>
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
      <div className={s.cardNome} title={v.nome}>
        {v.nome}
      </div>
      <input
        className={s.cardTexto}
        placeholder="Texto deste vídeo"
        value={v.texto}
        onChange={(e) => {
          const t = e.target.value;
          acao(v.id, () => ({ texto: t }), true);
        }}
      />
    </div>
  );
});
