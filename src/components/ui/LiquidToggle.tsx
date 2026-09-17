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
 * 
 * "Two blobs, not one, and ONE POSITION between them. The thumb's x is a motion value,
 * and the drop is a spring FOLLOWING that value rather than the same target with a delay on it.
 * That difference is the whole component: drag slowly and it stays one shape, flick it and
 * the goo necks out behind."
 */
export function LiquidToggle({
  checked,
  onChange,
  disabled = false,
  className = '',
  activeColor = 'emerald',
}: LiquidToggleProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleClick = () => {
    if (disabled) return
    setIsTransitioning(true)
    onChange(!checked)
    setTimeout(() => setIsTransitioning(false), 360)
  }

  return (
    <div className={`inline-flex items-center select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {/* SVG Gooey Filter exact spec from bencho.dev */}
      <svg className="fixed -top-full -left-full pointer-events-none w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liq-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="smear" />
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

      {/* Bencho liq-sw button */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        className={`relative w-[52px] h-[28px] rounded-full p-0 cursor-pointer border transition-colors duration-300 outline-none overflow-visible ${
          checked
            ? activeColor === 'emerald'
              ? 'bg-emerald-500 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'bg-[#6366f1] border-[#818cf8]/80 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
            : 'bg-zinc-800/95 border-white/15 hover:border-white/25 hover:bg-zinc-700/90'
        }`}
      >
        {/* Recipiente com Filtro Líquido Gooey */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ filter: 'url(#liq-goo)' }}
        >
          {/* Drop líquido rastro (Goo Neck) — estica com amortecimento */}
          <div
            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all pointer-events-none ${
              checked
                ? 'left-[26px] scale-x-125 opacity-90'
                : 'left-[3px] scale-x-125 opacity-90'
            }`}
            style={{
              transitionDuration: '420ms',
              transitionTimingFunction: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
            }}
          />

          {/* Thumb Principal (Botão central com overshoot) */}
          <div
            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md transition-all pointer-events-none ${
              checked ? 'left-[26px]' : 'left-[3px]'
            }`}
            style={{
              transitionDuration: '280ms',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
      </button>
    </div>
  )
}
export default LiquidToggle
