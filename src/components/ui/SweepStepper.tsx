'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'

export interface SweepStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  label?: string
  className?: string
  size?: 'sm' | 'md'
  railWidth?: number
  formatValue?: (val: number) => string
}

/**
 * SweepStepper (Bencho style "Tap for one, hold to sweep")
 * 
 * "A stepper is precise and slow, a slider is fast and vague, and almost every product
 * picks one and makes the other job painful. This is both on the same control, chosen
 * by how long you hold — so the coarse move never costs you the fine one."
 */
export function SweepStepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  label,
  className = '',
  size = 'md',
  railWidth = 120,
  formatValue,
}: SweepStepperProps) {
  const [sweeping, setSweeping] = useState(false)
  const [sweepProgress, setSweepProgress] = useState(0) // -1 to 1 visual indication
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const containerRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const originRef = useRef<{ x: number; v: number; dir: number }>({ x: 0, v: value, dir: 0 })
  const isSweepingRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const clamp = useCallback((val: number) => {
    return Math.max(min, Math.min(max, Math.round(val / step) * step))
  }, [min, max, step])

  // Pointer Down handler: Tap for one, hold to sweep
  const handlePointerDown = (dir: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (e.button !== 0) return

    const actualRailWidth = containerRef.current?.getBoundingClientRect().width || railWidth
    originRef.current = { x: e.clientX, v: valueRef.current, dir }
    isSweepingRef.current = false

    // Tap vs Sweep threshold: 260ms (exact Bencho timing)
    timerRef.current = setTimeout(() => {
      isSweepingRef.current = true
      setSweeping(true)
    }, 260)

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = moveEvt.clientX - originRef.current.x

      // If dragged past threshold before 260ms, enter sweep mode immediately
      if (!isSweepingRef.current && Math.abs(deltaX) > 6) {
        if (timerRef.current) clearTimeout(timerRef.current)
        isSweepingRef.current = true
        setSweeping(true)
      }

      if (isSweepingRef.current) {
        const range = max - min
        // Proportional sweep: setV(origin.v + ((e.clientX - origin.x) / railWidth) * range)
        const deltaV = (deltaX / actualRailWidth) * range
        const nextV = clamp(originRef.current.v + deltaV)
        onChange(nextV)

        const progress = Math.max(-1, Math.min(1, deltaX / (actualRailWidth / 2)))
        setSweepProgress(progress)
      }
    }

    const onPointerUp = () => {
      if (timerRef.current) clearTimeout(timerRef.current)

      if (!isSweepingRef.current) {
        // It was a tap: setV((n) => n + dir)
        const nextV = clamp(valueRef.current + dir * step)
        onChange(nextV)
      }

      isSweepingRef.current = false
      setSweeping(false)
      setSweepProgress(0)

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const handleInputCommit = () => {
    setIsEditing(false)
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      onChange(clamp(parsed))
    }
  }

  const displayedValue = formatValue ? formatValue(value) : `${value}${unit ? unit : ''}`
  const fillPercentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const isSmall = size === 'sm'

  return (
    <div className={`flex flex-col gap-1 select-none ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium tracking-tight">{label}</span>
          <span className="font-mono text-[11px] font-semibold text-indigo-400">
            {displayedValue}
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative flex items-center rounded-xl border transition-all duration-200 ${
          isSmall ? 'h-7 text-xs' : 'h-9 text-sm'
        } ${
          sweeping
            ? 'bg-zinc-900 border-indigo-500/60 shadow-[0_0_16px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40 cursor-ew-resize'
            : 'bg-[#121217]/90 border-white/[0.08] hover:border-white/15'
        }`}
      >
        {/* Subtle Progress Bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-xl bg-indigo-500/[0.08] pointer-events-none transition-[width] duration-75"
          style={{ width: `${fillPercentage}%` }}
        />

        {/* Sweep Glow Indicator */}
        {sweeping && (
          <div
            className="absolute inset-y-0 rounded-xl bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent pointer-events-none transition-all"
            style={{
              left: `calc(50% + ${sweepProgress * 35}% - 20px)`,
              width: '40px',
            }}
          />
        )}

        {/* Minus: Tap for -1, Hold & Drag to sweep */}
        <button
          type="button"
          onPointerDown={handlePointerDown(-1)}
          disabled={value <= min}
          title="Toque para -1, segure e arraste para deslizar"
          className={`relative z-10 h-full flex items-center justify-center text-zinc-400 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-transform active:scale-90 cursor-pointer touch-none ${
            isSmall ? 'w-7' : 'w-9'
          }`}
        >
          <Minus className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>

        {/* Center Display / Scrubber */}
        <div
          onPointerDown={handlePointerDown(1)}
          onDoubleClick={() => {
            setIsEditing(true)
            setEditValue(value.toString())
          }}
          className="relative z-10 flex-1 h-full flex items-center justify-center cursor-ew-resize touch-none px-2 group"
          title="Clique e arraste para deslizar ou 2 cliques para digitar"
        >
          {isEditing ? (
            <input
              type="number"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleInputCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInputCommit()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              className="w-14 h-5 bg-zinc-950 text-center font-mono text-xs font-bold text-white border border-indigo-500 rounded outline-none"
            />
          ) : (
            <div className="flex items-center gap-1 font-mono font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              <span className={isSmall ? 'text-xs' : 'text-xs'}>{value}</span>
              {unit && <span className="text-[10px] text-zinc-400 font-normal">{unit}</span>}
            </div>
          )}

          {/* Sweeping Floating Pill */}
          {sweeping && (
            <div className="absolute -top-7 px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold shadow-lg pointer-events-none animate-in fade-in zoom-in-95">
              {displayedValue}
            </div>
          )}
        </div>

        {/* Plus: Tap for +1, Hold & Drag to sweep */}
        <button
          type="button"
          onPointerDown={handlePointerDown(1)}
          disabled={value >= max}
          title="Toque para +1, segure e arraste para deslizar"
          className={`relative z-10 h-full flex items-center justify-center text-zinc-400 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-transform active:scale-90 cursor-pointer touch-none ${
            isSmall ? 'w-7' : 'w-9'
          }`}
        >
          <Plus className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      </div>
    </div>
  )
}
