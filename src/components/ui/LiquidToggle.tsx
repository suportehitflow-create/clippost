'use client'

import React, { useState } from 'react'

export interface LiquidToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  activeColor?: 'emerald' | 'indigo' | 'ink'
  activeLabel?: string
  inactiveLabel?: string
  showBadge?: boolean
}

/**
 * Bencho Liquid Toggle (https://bencho.dev/?c=liq-toggle&theme=dark)
 * Compact, standardized version (42px x 22px).
 * No extra text labels, clean fluid physics with gooey spring drop.
 */
export function LiquidToggle({
  checked,
  onChange,
  disabled = false,
  className = '',
  activeColor = 'indigo',
}: LiquidToggleProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    setIsTransitioning(true)
    onChange(!checked)
    setTimeout(() => setIsTransitioning(false), 320)
  }

  return (
    <div className={`inline-flex items-center select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {/* SVG Gooey Filter exact spec from bencho.dev */}
      <svg className="fixed -top-full -left-full pointer-events-none w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liq-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="smear" />
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

      {/* Bencho liq-sw button - Compact 42x22px */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        className={`relative w-[42px] h-[22px] rounded-full p-0 cursor-pointer border transition-colors duration-250 outline-none overflow-visible shrink-0 ${
          checked
            ? activeColor === 'emerald'
              ? 'bg-emerald-500 border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
              : 'bg-indigo-600 border-indigo-400/80 shadow-[0_0_10px_rgba(99,102,241,0.35)]'
            : 'bg-zinc-800 border-white/10 hover:border-white/20 hover:bg-zinc-700/80'
        }`}
      >
        {/* Recipiente com Filtro Líquido Gooey */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ filter: 'url(#liq-goo)' }}
        >
          {/* Drop líquido rastro (Goo Neck) — estica com amortecimento */}
          <div
            className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all pointer-events-none ${
              checked
                ? 'left-[22px] scale-x-125 opacity-90'
                : 'left-[2px] scale-x-125 opacity-90'
            }`}
            style={{
              transitionDuration: '340ms',
              transitionTimingFunction: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
            }}
          />

          {/* Thumb Principal (Botão central com overshoot) */}
          <div
            className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-all pointer-events-none ${
              checked ? 'left-[22px]' : 'left-[2px]'
            }`}
            style={{
              transitionDuration: '240ms',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
      </button>
    </div>
  )
}
export default LiquidToggle
