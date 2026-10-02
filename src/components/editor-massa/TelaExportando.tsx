'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icone } from './icones';
import type { VideoCliente } from './estado';
import e from './tela-exportando.module.css';

function Miniatura({ quadro }: { quadro: ImageBitmap | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !quadro) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = 180;
    c.height = 320;
    // preenche o cartão 9:16 recortando o centro do quadro
    const r = Math.max(c.width / quadro.width, c.height / quadro.height);
    const w = quadro.width * r;
    const h = quadro.height * r;
    ctx.drawImage(quadro, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }, [quadro]);
  return <canvas ref={ref} className={e.mini} />;
}

function tempo(seg: number) {
  if (!isFinite(seg) || seg < 0) return '';
  if (seg < 60) return `${Math.max(5, Math.round(seg / 5) * 5)} s`;
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** Tela cheia mostrada enquanto os vídeos são feitos: contador, barra geral e um cartão por vídeo
 * (na fila → preparando → renderizando → pronto). */
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
  const feitos = prontos + falhas;
  const fracao = total
    ? p.videos.reduce((a, v) => a + (v.statusJob === 'ok' || v.statusJob === 'erro' ? 1 : v.statusJob === 'processando' ? v.progressoJob : 0), 0) / total
    : 0;

  const inicio = useRef(Date.now());
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const decorrido = (agora - inicio.current) / 1000;
  // só estima depois de ter andado um pouco: antes disso o número oscila demais
  const restante = fracao > 0.06 && decorrido > 8 ? (decorrido / fracao) * (1 - fracao) : null;

  const titulo = useMemo(() => {
    if (p.pausado) return 'Pausado';
    if (!p.temJob) return 'Enviando seus vídeos…';
    if (feitos >= total) return 'Quase lá, finalizando…';
    return 'Fazendo seus cortes';
  }, [p.pausado, p.temJob, feitos, total]);

  return (
    <div className={e.tela} role="dialog" aria-modal="true" aria-label="Exportando vídeos">
      <div className={e.painel}>
        <div className={e.topo}>
          <div role="status" aria-live="polite">
            <div className={e.etiqueta}>{p.nome}</div>
            <h2 className={e.titulo}>{titulo}</h2>
          </div>
          <div className={e.contador}>
            <span className={e.contadorNum}>{prontos}</span>
            <span className={e.contadorDe}>de {total} {total === 1 ? 'pronto' : 'prontos'}</span>
          </div>
        </div>

        <div className={e.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fracao * 100)}>
          <div className={`${e.barraDentro} ${p.pausado ? e.barraPausada : ''}`} style={{ width: `${Math.max(2, fracao * 100)}%` }} />
        </div>
        <div className={e.linhaInfo}>
          <span>{Math.round(fracao * 100)}%{falhas ? ` · ${falhas} com erro` : ''}</span>
          <span>{restante !== null ? `faltam uns ${tempo(restante)}` : 'calculando o tempo…'}</span>
        </div>

        <div className={e.grade}>
          {p.videos.map((v, i) => {
            const est = v.statusJob;
            const pronto = est === 'ok';
            const erro = est === 'erro';
            const rodando = est === 'processando';
            const preparando = est === 'detectando';
            const pct = Math.round((v.progressoJob || 0) * 100);
            return (
              <div key={v.id} className={`${e.cartao} ${pronto ? e.cartaoPronto : ''} ${erro ? e.cartaoErro : ''} ${rodando || preparando ? e.cartaoAtivo : ''}`}>
                <div className={e.quadro}>
                  <Miniatura quadro={v.quadro as ImageBitmap | null} />
                  {(rodando || preparando) && <div className={e.varredura} />}
                  <div className={e.selo}>
                    {pronto ? <Icone nome="check" tamanho={16} /> : erro ? <Icone nome="x" tamanho={16} /> : <span>{i + 1}</span>}
                  </div>
                  {rodando && <div className={e.pct}>{pct}%</div>}
                </div>
                <div className={e.nome} title={v.nome}>{v.nome}</div>
                <div className={e.estado}>
                  {pronto ? 'Pronto' : erro ? 'Falhou' : rodando ? 'Renderizando' : preparando ? 'Preparando' : 'Na fila'}
                </div>
                <div className={e.miniBarra}>
                  <div style={{ width: `${pronto || erro ? 100 : rodando ? pct : preparando ? 8 : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className={e.rodape}>
          <span className={e.dica}>Quando terminar, o download começa sozinho.</span>
          <span className={e.espaco} />
          <button type="button" className={e.botao} onClick={p.pausar} disabled={!p.temJob} title={p.temJob ? undefined : 'Disponível quando o envio terminar'}>
            <Icone nome={p.pausado ? 'play' : 'pausa'} tamanho={14} /> {p.pausado ? 'Continuar' : 'Pausar'}
          </button>
          <button type="button" className={`${e.botao} ${e.botaoPerigo}`} onClick={p.cancelar}>
            <Icone nome="parar" tamanho={13} /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
