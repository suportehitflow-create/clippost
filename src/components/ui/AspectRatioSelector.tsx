'use client'

import React from 'react'

export interface AspectFormat {
  id: '9:16' | '4:5' | '1:1' | '16:9'
  label: string
  ratioName: string
  widthPercent: number
  heightPercent: number
  rect: { x: number; y: number; w: number; h: number }
}

export const ASPECT_FORMATS: AspectFormat[] = [
  {
    id: '9:16',
    label: '9:16 (Reels / TikTok)',
    ratioName: '9:16',
    widthPercent: 92,
    heightPercent: 54,
    rect: { x: 4.5, y: 1.5, w: 9, h: 15 }, // Vertical tall
  },
  {
    id: '4:5',
    label: '4:5 (Feed Retrato)',
    ratioName: '4:5',
    widthPercent: 88,
    heightPercent: 48,
    rect: { x: 3.5, y: 2, w: 11, h: 14 }, // Portrait 4:5
  },
  {
    id: '1:1',
    label: '1:1 (Feed Quadrado)',
    ratioName: '1:1',
    widthPercent: 86,
    heightPercent: 42,
    rect: { x: 2.5, y: 2.5, w: 13, h: 13 }, // Square 1:1
  },
  {
    id: '16:9',
    label: '16:9 (Paisagem)',
    ratioName: '16:9',
    widthPercent: 96,
    heightPercent: 32,
    rect: { x: 1.5, y: 4.5, w: 15, h: 9 }, // Landscape
  },
]

interface AspectRatioSelectorProps {
  currentAspect: '9:16' | '4:5' | '1:1' | '16:9'
  onSelectAspect: (aspect: AspectFormat) => void
  className?: string
}

/**
 * Bencho Aspect Ratio Component (https://bencho.dev/?c=aspect&theme=dark)
 * "THE FORMATS HAVE EQUAL AREA, and that is the whole idea.
 * One thumb sliding, not three backgrounds fading.
 * The icons ARE the shapes at the real ratio."
 */
export function AspectRatioSelector({
  currentAspect,
  onSelectAspect,
  className = '',
}: AspectRatioSelectorProps) {
  const activeIndex = ASPECT_FORMATS.findIndex(f => f.id === currentAspect)
  const safeIndex = activeIndex !== -1 ? activeIndex : 0

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 font-medium">Proporção do Vídeo:</span>
        <span className="font-mono text-[11px] font-bold text-indigo-400">
          {ASPECT_FORMATS[safeIndex].ratioName}
        </span>
      </div>

      {/* Bencho asp-tabs with sliding thumb */}
      <div
        role="radiogroup"
        aria-label="Proporção de aspecto"
        className="relative grid grid-cols-4 p-1 rounded-2xl bg-[#121217] border border-white/[0.08] shadow-inner select-none h-11 items-center"
      >
        {/* Sliding Thumb Indicator (Leads the animation) */}
        <span
          className="absolute top-1 bottom-1 w-[calc(25%-2px)] rounded-xl bg-indigo-600/90 shadow-md shadow-indigo-500/20 border border-indigo-400/40 pointer-events-none transition-transform"
          style={{
            transform: `translateX(calc(${safeIndex * 100}% + ${safeIndex * 2}px + 1px))`,
            transitionDuration: '280ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        {ASPECT_FORMATS.map((format, idx) => {
          const isActive = idx === safeIndex
          return (
            <button
              key={format.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelectAspect(format)}
              className={`relative z-10 h-9 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title={format.label}
            >
              {/* SVG Icon matching exact Bencho aspect geometry */}
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
                <rect
                  x={format.rect.x}
                  y={format.rect.y}
                  width={format.rect.w}
                  height={format.rect.h}
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="font-mono text-[10px] font-bold">{format.id}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
