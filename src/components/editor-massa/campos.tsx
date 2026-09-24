'use client';

import type { ReactNode } from 'react';
import { FONTES } from '@/lib/editor-massa/defaults';
import s from './editor-massa.module.css';

export function Toggle(p: { valor: boolean; mudar: (v: boolean) => void; rotulo?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={p.valor}
      aria-label={p.rotulo}
      className={`${s.toggle} ${p.valor ? s.toggleLigado : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        p.mudar(!p.valor);
      }}
    />
  );
}

/** Linha "rótulo ........ [interruptor]", com descrição opcional */
export function Opcao(p: { rotulo: string; descricao?: string; valor: boolean; mudar: (v: boolean) => void }) {
  return (
    <div className={s.linhaToggle} onClick={() => p.mudar(!p.valor)}>
      <span>
        {p.rotulo}
        {p.descricao && <span className={s.dica}>{p.descricao}</span>}
      </span>
      <Toggle valor={p.valor} mudar={p.mudar} rotulo={p.rotulo} />
    </div>
  );
}

export function Slider(p: {
  rotulo: string;
  valor: number;
  mudar: (v: number) => void;
  min: number;
  max: number;
  passo?: number;
  formatar?: (v: number) => string;
  /** duplo clique volta para este valor */
  padrao?: number;
}) {
  return (
    <label className={s.campo}>
      <span className={s.rotuloLinha}>
        {p.rotulo}
        <span className={s.valor}>{p.formatar ? p.formatar(p.valor) : p.valor}</span>
      </span>
      <input
        className={s.range}
        type="range"
        min={p.min}
        max={p.max}
        step={p.passo ?? 1}
        value={p.valor}
        onChange={(e) => p.mudar(Number(e.target.value))}
        onDoubleClick={() => p.padrao !== undefined && p.mudar(p.padrao)}
        title={p.padrao !== undefined ? 'Duplo clique para voltar ao padrão' : undefined}
      />
    </label>
  );
}

export function Segmentado<T extends string | number>(p: {
  valor: T;
  mudar: (v: T) => void;
  opcoes: { valor: T; rotulo: ReactNode; titulo?: string }[];
}) {
  return (
    <div className={s.segmentado} role="radiogroup">
      {p.opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={p.valor === o.valor}
          title={o.titulo}
          className={`${s.seg} ${p.valor === o.valor ? s.segAtivo : ''}`}
          onClick={() => p.mudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

const PALETA = ['#FFFFFF', '#000000', '#9CA3AF', '#FACC15', '#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6', '#22D3EE', '#22C55E'];

export function Cores(p: { valor: string; mudar: (v: string) => void }) {
  const atual = p.valor.toUpperCase();
  const livre = !PALETA.includes(atual);
  return (
    <div className={s.cores}>
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          className={`${s.swatch} ${atual === c ? s.swatchAtivo : ''}`}
          style={{ background: c }}
          onClick={() => p.mudar(c)}
        />
      ))}
      <label className={`${s.swatch} ${s.swatchLivre} ${livre ? s.swatchAtivo : ''}`} title="Cor personalizada">
        <input type="color" value={p.valor.slice(0, 7)} onChange={(e) => p.mudar(e.target.value.toUpperCase())} />
      </label>
    </div>
  );
}

export function Fonte(p: { valor: string; mudar: (v: string) => void }) {
  return (
    <select className={s.select} value={p.valor} onChange={(e) => p.mudar(e.target.value)} style={{ fontFamily: `"${p.valor}"` }}>
      {FONTES.map((f) => (
        <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>
          {f}
        </option>
      ))}
    </select>
  );
}

export function Campo(p: { rotulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className={s.campo}>
      <span className={s.rotuloLinha}>
        {p.rotulo}
        {p.extra}
      </span>
      {p.children}
    </div>
  );
}
