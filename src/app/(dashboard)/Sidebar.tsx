'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Scissors,
  Flame,
  PenTool,
  Layers,
  Sparkles,
  Zap,
  Calendar,
  Settings,
  FolderOpen
} from 'lucide-react'
import { useHorizontalFisheyeDock } from '@/components/ui/FisheyeDock'
import type { User } from '@supabase/supabase-js'

const NAV_ITEMS = [
  { label: 'Início', href: '/inicio', icon: Home },
  { label: 'Meus Projetos', href: '/dashboard', icon: FolderOpen },
  { label: 'Criar Cortes', href: '/upload', icon: Scissors },
  { label: 'Radar Viral', href: '/trends', icon: Flame },
  { label: 'Roteiros IA', href: '/creator', icon: PenTool },
  { label: 'Edição em Massa', href: '/bulk', icon: Layers },
  { label: 'Templates', href: '/templates', icon: Sparkles },
  { label: 'Autopilot', href: '/autopilot', icon: Zap },
  { label: 'Agendamentos', href: '/schedule', icon: Calendar },
]

/**
 * Bencho Horizontal Magnifying Dock (https://bencho.dev/?c=dock&theme=dark)
 * Floating horizontal Apple-grade glass dock positioned at the bottom center.
 * Features:
 * - Raised cosine fisheye glyph scaling (--d distance tracking along X axis)
 * - Steady running dot indicator at the bottom (.gdock-dot)
 * - Instant floating pill tooltip above the dock (.gdock-tip)
 * - Translucent frosted glass with specular highlight
 * - Leaves the entire left side of the screen completely free!
 */
export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()

  // Bencho Fisheye Dock Physics (Horizontal)
  const { registerItem, onMouseMove, onMouseLeave } = useHorizontalFisheyeDock(2.8)

  return (
    <nav
      aria-label="Dock"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-row items-center py-2 px-3 rounded-[24px] bg-[#0c0c0f]/90 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] gap-1 sm:gap-1.5 select-none max-w-[calc(100vw-1.5rem)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Logo / Home */}
      <Link
        href="/inicio"
        title="Clipost - Início"
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shrink-0 mr-0.5"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
          <Scissors className="w-4 h-4 text-white" />
        </div>
      </Link>

      <div className="w-px h-6 bg-white/10 mx-0.5" />

      {/* Navigation Items */}
      {NAV_ITEMS.map((item, index) => {
        const Icon = item.icon
        const active =
          pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            ref={registerItem(index)}
            className={`gdock-item group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              active
                ? 'bg-indigo-600/20 text-white shadow-sm ring-1 ring-indigo-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] opacity-70 hover:opacity-100'
            }`}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            {/* Bencho Running Active Dot */}
            <span
              className={`gdock-dot absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#6366f1] shadow-[0_0_6px_rgba(99,102,241,0.9)] transition-all ${
                active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
            />

            {/* Bencho Glyph with raised cosine magnification */}
            <span className="gdock-glyph flex items-center justify-center">
              <Icon
                className={`w-4 h-4 transition-colors ${
                  active ? 'text-indigo-400' : 'text-zinc-300 group-hover:text-white'
                }`}
              />
            </span>

            {/* Bencho Floating Tip (.gdock-tip acima do ícone) */}
            <span className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#18181b] text-white font-mono text-[9px] uppercase tracking-wider shadow-2xl border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap">
              {item.label}
            </span>
          </Link>
        )
      })}

      <div className="w-px h-6 bg-white/10 mx-0.5 shrink-0" />

      {/* Ajustes da Conta */}
      <Link
        href="/settings"
        ref={registerItem(NAV_ITEMS.length)}
        className={`gdock-item group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          pathname === '/settings'
            ? 'bg-indigo-600/20 text-white shadow-sm ring-1 ring-indigo-500/30'
            : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] opacity-70 hover:opacity-100'
        }`}
        aria-label="Ajustes"
        aria-current={pathname === '/settings' ? 'page' : undefined}
      >
        <span
          className={`gdock-dot absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#6366f1] shadow-[0_0_6px_rgba(99,102,241,0.9)] transition-all ${
            pathname === '/settings' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
        />
        <span className="gdock-glyph flex items-center justify-center">
          <Settings
            className={`w-4 h-4 transition-colors ${
              pathname === '/settings' ? 'text-indigo-400' : 'text-zinc-300 group-hover:text-white'
            }`}
          />
        </span>
        <span className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#18181b] text-white font-mono text-[9px] uppercase tracking-wider shadow-2xl border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap">
          Ajustes
        </span>
      </Link>
    </nav>
  )
}
