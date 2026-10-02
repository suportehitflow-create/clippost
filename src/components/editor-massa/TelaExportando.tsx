'use client';

import { useEffect, useRef, useState } from 'react';
import { Icone } from './icones';
import type { VideoCliente } from './estado';
import e from './tela-exportando.module.css';

function Quadro({ quadro }: { quadro: ImageBitmap | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !quadro) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = 360;
    c.height = 640;
    // preenche o quadro 9:16 recortando o centro
    const r = Math.max(c.width / quadro.width, c.height / quadro.height);
    const w = quadro.width * r;
    const h = quadro.height * r;
    ctx.drawImage(quadro, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }, [quadro]);
  return <canvas ref={ref} className={e.imagem} />;
}

function tempo(seg: number) {
  if (!isFinite(seg) || seg < 0) return '';
  if (seg < 60) return `${Math.max(5, Math.round(seg / 5) * 5)} s`;
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}

const ETAPAS = ['Entrando', 'Renderizando', 'Pronto'] as const;

/** Tela mostrada enquanto os vídeos são feitos: um corte por vez em destaque (entrando → renderizando → pronto),
 * contador, barra geral e uma fileira de pontinhos, um por vídeo. Não lista os vídeos. */
export function TelaExportando(p: {
  nome: string;
  videos: VideoCliente[];
  pausado: boolean;
  temJob: boolean;
  pausar: () => void;
  cancelar: () => void;
}) {
  const total = p.videos.length;
  const prontos = p.videos.filter((v) => v.statusJob === 'ok').length;
  const falhas = p.videos.filter((v) => v.statusJob === 'erro').length;
  const fracao = total
    ? p.videos.reduce((a, v) => a + (v.statusJob === 'ok' || v.statusJob === 'erro' ? 1 : v.statusJob === 'processando' ? v.progressoJob : 0), 0) / total
    : 0;

  // o corte em destaque: o primeiro que está renderizando; senão o primeiro sendo preparado
  const foco =
    p.videos.find((v) => v.statusJob === 'processando') ?? p.videos.find((v) => v.statusJob === 'detectando') ?? null;
  const focoNum = foco ? p.videos.indexOf(foco) + 1 : 0;
  let etapa = !foco ? -1 : foco.statusJob === 'processando' ? 1 : 0;
  const pct = foco ? Math.round((foco.progressoJob || 0) * 100) : 0;

  // aviso rápido "Corte N pronto" a cada vídeo que termina
  const [pronto, setPronto] = useState<{ n: number; chave: number } | null>(null);
  const anterior = useRef(new Set<string>());
  useEffect(() => {
    const agora = new Set(p.videos.filter((v) => v.statusJob === 'ok').map((v) => v.id));
    let novo: string | null = null;
    agora.forEach((id) => !anterior.current.has(id) && (novo = id));
    anterior.current = agora;
    if (novo) {
      setPronto({ n: p.videos.findIndex((v) => v.id === novo) + 1, chave: Date.now() });
      const t = setTimeout(() => setPronto(null), 1600);
      return () => clearTimeout(t);
    }
  }, [prontos]); // eslint-disable-line react-hooks/exhaustive-deps

  // no instante em que um corte termina, a etapa "Pronto" acende junto com o aviso
  if (pronto) etapa = 2;

  // foco para dentro da tela (o editor por baixo fica inerte para o teclado)
  const botaoCancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => botaoCancelar.current?.focus({ preventScroll: true }), []);

  const inicio = useRef(Date.now());
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const decorrido = (agora - inicio.current) / 1000;
  // só estima depois de ter andado um pouco: antes disso o número oscila demais
  const restante = fracao > 0.06 && decorrido > 8 ? (decorrido / fracao) * (1 - fracao) : null;

  const titulo = p.pausado ? 'Pausado' : !p.temJob ? 'Enviando seus vídeos…' : prontos + falhas >= total ? 'Finalizando…' : 'Preparando seus cortes';

  return (
    <div className={e.tela} role="dialog" aria-modal="true" aria-label="Exportando vídeos">
      <div className={e.painel}>
        <div role="status" aria-live="polite" className={e.cabeca}>
          <div className={e.etiqueta}>{p.nome}</div>
          <h2 className={e.titulo}>{titulo}</h2>
        </div>

        <div className={e.palco}>
          {foco ? (
            <div key={foco.id} className={e.celular}>
              <Quadro quadro={foco.quadro as ImageBitmap | null} />
              <div className={e.varredura} />
              <div className={e.numero}>Corte {focoNum}</div>
              <div className={e.pct}>{etapa === 1 ? `${pct}%` : '…'}</div>
            </div>
          ) : (
            <div className={`${e.celular} ${e.celularVazio}`}>
              <span className={e.pulso} />
            </div>
          )}
          {pronto && (
            <div key={pronto.chave} className={e.pronto} role="status">
              <Icone nome="check" tamanho={15} /> Corte {pronto.n} pronto
            </div>
          )}
        </div>

        <div className={e.etapas} aria-hidden="true">
          {ETAPAS.map((t, i) => (
            <span key={t} className={`${e.etapa} ${i === etapa ? e.etapaAtiva : ''} ${i < etapa ? e.etapaFeita : ''}`}>
              {t}
            </span>
          ))}
        </div>

        <div className={e.resumo}>
          <div className={e.contador}>
            <span className={e.contadorNum}>{prontos}</span>
            <span className={e.contadorDe}>de {total} {total === 1 ? 'pronto' : 'prontos'}{falhas ? ` · ${falhas} com erro` : ''}</span>
          </div>
          <div className={e.barra} role="progressbar" aria-label="Progresso da exportação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fracao * 100)}>
            <div className={`${e.barraDentro} ${p.pausado ? e.barraPausada : ''}`} style={{ width: `${Math.max(2, fracao * 100)}%` }} />
          </div>
          <div className={e.linhaInfo}>
            <span>{Math.round(fracao * 100)}%</span>
            <span>{restante !== null ? `faltam uns ${tempo(restante)}` : 'calculando o tempo…'}</span>
          </div>
        </div>

        <div className={e.pontos} aria-hidden="true">
          {p.videos.map((v) => (
            <i
              key={v.id}
              className={`${e.ponto} ${v.statusJob === 'ok' ? e.pontoOk : ''} ${v.statusJob === 'erro' ? e.pontoErro : ''} ${v.statusJob === 'processando' || v.statusJob === 'detectando' ? e.pontoAtivo : ''}`}
            />
          ))}
        </div>

        <div className={e.rodape}>
          <button type="button" className={e.botao} onClick={p.pausar} disabled={!p.temJob} title={p.temJob ? undefined : 'Disponível quando o envio terminar'}>
            <Icone nome={p.pausado ? 'play' : 'pausa'} tamanho={14} /> {p.pausado ? 'Continuar' : 'Pausar'}
          </button>
          <button ref={botaoCancelar} type="button" className={`${e.botao} ${e.botaoPerigo}`} onClick={p.cancelar}>
            <Icone nome="parar" tamanho={13} /> Cancelar
          </button>
        </div>
        <div className={e.dica}>Quando terminar, o download começa sozinho.</div>
      </div>
    </div>
  );
}
