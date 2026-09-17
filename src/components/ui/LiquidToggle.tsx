'use client'

import React from 'react'

interface LiquidToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  activeColor?: 'emerald' | 'indigo' | 'violet'
  // Compatibilidade com código legado se passado
  activeLabel?: string
  inactiveLabel?: string
  showBadge?: boolean
}

/**
 * LiquidToggle (Apple / Bencho Liquid Gooey Spring Switch)
 * Pure pill toggle without redundant "LIGADO / DESLIGADO" text labels.
 * Physics: Thumb spring with following liquid gooey droplet.
 */
export function LiquidToggle({
  checked,
  onChange,
  disabled = false,
  className = '',
  activeColor = 'emerald',
}: LiquidToggleProps) {
  const isEmerald = activeColor === 'emerald'

  return (
    <div className={`inline-flex items-center select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {/* SVG Gooey Filter global para fusão líquida orgânica */}
      <svg className="fixed -top-full -left-full pointer-events-none w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liq-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="smear" />
            <feColorMatrix
              in="smear"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 18 -8"
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
              ? 'bg-emerald-500 border-emerald-400/80 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
              : 'bg-[#6366f1] border-[#818cf8]/80 shadow-[0_0_14px_rgba(99,102,241,0.4)]'
            : 'bg-zinc-800 border-white/15 hover:border-white/25 hover:bg-zinc-700/80'
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
    </div>
  )
}
export default LiquidToggle
