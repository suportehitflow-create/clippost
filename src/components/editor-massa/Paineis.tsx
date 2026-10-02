'use client';

import { useEffect, useRef } from 'react';
import { Icone } from './icones';
import s from './editor-massa.module.css';

function useEsc(fechar: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fechar]);
}

export function GavetaLog(p: { log: string[]; limpar: () => void; fechar: () => void }) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => fim.current?.scrollIntoView({ block: 'end' }), [p.log.length]);
  return (
    <div className={s.gavetaLog}>
      <div className={s.gavetaLogTopo}>
        <Icone nome="log" tamanho={14} /> Log de processamento
        <span className={s.espaco} />
        <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`} onClick={() => navigator.clipboard?.writeText(p.log.join('\n'))}>
          Copiar
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`}
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([p.log.join('\n')], { type: 'text/plain' }));
            a.download = 'log.txt';
            a.click();
          }}
        >
          Salvar
        </button>
        <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`} onClick={p.limpar}>
          Limpar
        </button>
        <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`} onClick={p.fechar} title="Fechar">
          <Icone nome="x" tamanho={14} />
        </button>
      </div>
      <div className={s.log}>
        {p.log.length === 0 && <div style={{ color: '#6b6b77' }}>Nada por aqui ainda.</div>}
        {p.log.map((l, i) => (
          <div key={i} className={/\[(OK|CONT)\]|✅/.test(l) ? s.logOk : /ERRO|FALHA|❌/.test(l) ? s.logErro : undefined}>
            {l}
          </div>
        ))}
        <div ref={fim} />
      </div>
    </div>
  );
}

export type FormaExportar = 'zip' | 'individual';

/** Única pergunta ao exportar: um .zip ou um arquivo por vez (muita plataforma não aceita .zip).
 * O que ficar pronto é baixado sozinho, do jeito escolhido. */
export function ModalFormaExportar(p: { total: number; escolher: (forma: FormaExportar) => void; fechar: () => void }) {
  useEsc(p.fechar);
  let ultima: string | null = null;
  try { ultima = localStorage.getItem('clipost:exportar-forma'); } catch {}
  return (
    <>
      <div className={s.cortina} onClick={p.fechar} />
      <div className={s.modal} role="dialog" aria-label="Como baixar">
        <div className={s.modalTitulo}>Como você quer baixar?</div>
        <div className={s.dica}>{p.total} {p.total === 1 ? 'vídeo' : 'vídeos'} · o download começa sozinho quando ficarem prontos</div>
        <button type="button" className={`${s.btn} ${ultima === 'zip' ? s.btnPrimario : ''} ${s.btnLargo}`} autoFocus={ultima !== 'individual'} onClick={() => p.escolher('zip')}>
          <Icone nome="download" /> Um arquivo ZIP
        </button>
        <button type="button" className={`${s.btn} ${ultima === 'individual' ? s.btnPrimario : ''} ${s.btnLargo}`} autoFocus={ultima === 'individual'} onClick={() => p.escolher('individual')}>
          <Icone nome="download" /> Arquivos separados (um por um)
        </button>
      </div>
    </>
  );
}