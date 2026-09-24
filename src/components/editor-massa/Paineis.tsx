'use client';

import { useEffect, useRef } from 'react';
import { urlArquivo } from '@/lib/editor-massa/client/api';
import type { ResultadoJob } from './estado';
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

export function PainelResultados(p: { resultados: ResultadoJob[]; fechar: () => void; apagar: (jobId: string) => void }) {
  useEsc(p.fechar);
  return (
    <>
      <div className={s.cortina} onClick={p.fechar} />
      <div className={s.lado} role="dialog" aria-label="Vídeos prontos">
        <div className={s.ladoTopo}>
          <Icone nome="pasta" /> Vídeos prontos
          <span className={s.espaco} />
          <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnIcone}`} onClick={p.fechar} title="Fechar">
            <Icone nome="x" />
          </button>
        </div>
        <div className={s.ladoCorpo}>
          {p.resultados.length === 0 && (
            <div className={s.palcoVazio} style={{ marginTop: 40 }}>
              <Icone nome="pasta" tamanho={28} />
              Os vídeos processados aparecem aqui.
            </div>
          )}
          {p.resultados.map((r) => {
            const prontos = r.itens.filter((i) => i.saida);
            const falhas = r.itens.filter((i) => i.status === 'erro').length;
            const andando = r.itens.filter((i) => ['fila', 'processando', 'detectando'].includes(i.status)).length;
            return (
              <div key={r.jobId} className={s.cartao}>
                <div className={s.linha}>
                  <b style={{ flex: 1 }}>{r.aba}</b>
                  <span className={s.dica}>{new Date(r.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={s.linha} style={{ flexWrap: 'wrap' }}>
                  <span className={`${s.chip} ${s.chipOk}`}>{prontos.length} prontos</span>
                  {andando > 0 && <span className={s.chip}>{andando} processando</span>}
                  {falhas > 0 && (
                    <span className={s.chip} style={{ color: '#f87171' }}>
                      {falhas} com erro
                    </span>
                  )}
                </div>
                <div className={s.lista}>
                  {r.itens.map((i, idx) => (
                    <div key={idx} className={s.itemLista}>
                      <Icone nome={i.saida ? 'check' : i.status === 'erro' ? 'x' : 'refresh'} tamanho={14} style={{ color: i.saida ? '#34d399' : i.status === 'erro' ? '#f87171' : '#6b6b77' }} />
                      <span title={i.erro ?? i.nome}>{i.nome}</span>
                      {i.saida && (
                        <>
                          <a className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`} href={urlArquivo(r.jobId, i.saida)} target="_blank" rel="noreferrer" title="Assistir">
                            <Icone nome="play" tamanho={13} />
                          </a>
                          <a className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`} href={urlArquivo(r.jobId, i.saida, true)} download title="Baixar">
                            <Icone nome="download" tamanho={14} />
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {prontos.length > 0 && (
                  <div className={s.linha}>
                    <a className={`${s.btn} ${s.btnPrimario} ${s.btnPequeno}`} style={{ flex: 1 }} href={urlArquivo(r.jobId, 'todos.zip')} download>
                      <Icone nome="download" tamanho={14} /> Baixar todos (.zip)
                    </a>
                    <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnPerigo}`} onClick={() => p.apagar(r.jobId)} title="Apagar do servidor">
                      <Icone nome="lixo" tamanho={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function ModalConcluido(p: { aba: string; ok: number; falhas: number; jobId: string; verResultados: () => void; limparLote: () => void; fechar: () => void }) {
  useEsc(p.fechar);
  return (
    <>
      <div className={s.cortina} onClick={p.fechar} />
      <div className={s.modal} role="dialog" aria-label="Processamento concluído">
        <div className={s.modalIcone}>
          <Icone nome="check" tamanho={26} strokeWidth={2.5} />
        </div>
        <div className={s.modalTitulo}>{p.ok} vídeos prontos!</div>
        <div className={s.dica}>
          {p.aba}
          {p.falhas > 0 && ` · ${p.falhas} falharam (veja o log)`}
        </div>
        {p.ok > 0 && (
          <a className={`${s.btn} ${s.btnPrimario} ${s.btnLargo}`} href={urlArquivo(p.jobId, 'todos.zip')} download onClick={() => setTimeout(p.fechar, 300)}>
            <Icone nome="download" /> Baixar todos (.zip)
          </a>
        )}
        <div className={s.linha} style={{ width: '100%' }}>
          <button type="button" className={s.btn} style={{ flex: 1 }} onClick={p.verResultados}>
            Ver um por um
          </button>
          <button type="button" className={s.btn} style={{ flex: 1 }} onClick={p.limparLote}>
            Limpar lote
          </button>
        </div>
      </div>
    </>
  );
}
