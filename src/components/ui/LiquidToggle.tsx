'use client'

import React from 'react'

interface LiquidToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  showBadge?: boolean
  activeLabel?: string
  inactiveLabel?: string
  className?: string
  activeColor?: 'emerald' | 'indigo' | 'violet'
}

export function LiquidToggle({
  checked,
  onChange,
  disabled = false,
  showBadge = true,
  activeLabel = 'LIGADO',
  inactiveLabel = 'DESLIGADO',
  className = '',
  activeColor = 'emerald',
}: LiquidToggleProps) {
  const isEmerald = activeColor === 'emerald'

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {/* SVG Gooey Filter global para fusão líquida orgânica */}
      <svg className="fixed -top-full -left-full pointer-events-none w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liq-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="smear" />
            <feColorMatrix
              in="smear"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 19 -9"
            />
          </filter>
        </defs>
      </svg>

      {/* Track da Pílula */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 cursor-pointer border shadow-sm outline-none ${
          checked
            ? isEmerald
              ? 'bg-emerald-500/90 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-[#6366f1]/90 border-[#6366f1]/60 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
            : 'bg-zinc-800/90 border-white/15 hover:border-white/25 hover:bg-zinc-700/80'
        }`}
      >
        {/* Recipiente com Filtro Líquido Gooey */}
        <div
          className="relative w-full h-full"
          style={{ filter: 'url(#liq-goo)' }}
        >
          {/* Bolha de Arraste (Liquid Drop Trail) — persegue o botão principal com amortecimento */}
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-500 pointer-events-none ${
              checked
                ? 'translate-x-4.5 scale-x-110 scale-y-90 opacity-90'
                : 'translate-x-1.5 scale-x-110 scale-y-90 opacity-80'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.25, 1.4, 0.5, 1)',
            }}
          />

          {/* Botão Principal (Thumb Knob) — movimento spring rápido e elástico */}
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 pointer-events-none ${
              checked
                ? 'translate-x-5.5 scale-100'
                : 'translate-x-0.5 scale-95'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
      </button>

      {/* Badge Indicador de Status com Pílula Suave */}
      {showBadge && (
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm ${
            checked
              ? isEmerald
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
                : 'bg-[#6366f1]/15 text-[#818cf8] border-[#6366f1]/30 shadow-[#6366f1]/10'
              : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.06]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              checked
                ? isEmerald
                  ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : 'bg-[#6366f1] animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.8)]'
                : 'bg-zinc-500'
            }`}
          />
          <span>{checked ? activeLabel : inactiveLabel}</span>
        </button>
      )}
    </div>
  )
}
export default LiquidToggle
