'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Scissors,
  Layers,
  Sparkles,
  Zap,
  Calendar,
  LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useVerticalFisheyeDock } from '@/components/ui/FisheyeDock'
import type { User } from '@supabase/supabase-js'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Criar Cortes', href: '/upload', icon: Scissors },
  { label: 'Edição em Massa', href: '/bulk', icon: Layers },
  { label: 'Templates', href: '/templates', icon: Sparkles },
  { label: 'Autopilot', href: '/autopilot', icon: Zap },
  { label: 'Agendamentos', href: '/schedule', icon: Calendar },
]

/**
 * Bencho Vertical Magnifying Dock (https://bencho.dev/?c=dock&theme=dark)
 * Floating vertical Apple-grade glass dock positioned at the upper-left.
 * Features:
 * - Raised cosine fisheye glyph scaling (--d distance tracking)
 * - Steady running dot indicator (.gdock-dot)
 * - Instant floating pill tooltip (.gdock-tip)
 * - Translucent frosted glass with specular highlight
 */
export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const supabase = createClient()

  // Bencho Fisheye Dock Physics
  const { registerItem, onMouseMove, onMouseLeave } = useVerticalFisheyeDock(2.8)

  async function signOut() {
    document.cookie = 'clippost_demo_auth=; path=/; max-age=0'
    localStorage.removeItem('clippost_demo_auth')
    localStorage.removeItem('clippost_demo_user_id')
    localStorage.removeItem('clippost_demo_user_email')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {/* Spacer para o fluxo normal de páginas */}
      <div className="w-16 sm:w-20 shrink-0 select-none pointer-events-none" aria-hidden="true" />

      {/* Bencho Floating Vertical Dock */}
      <nav
        aria-label="Dock"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="fixed top-5 left-5 z-50 flex flex-col items-center py-2.5 px-1.5 rounded-[24px] bg-[#0c0c0f]/80 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] gap-1 select-none"
      >
        {/* Logo / Home */}
        <Link
          href="/dashboard"
          title="Clipost"
          className="w-11 h-11 rounded-2xl flex items-center justify-center hover:opacity-90 transition-opacity mb-1"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
            <Scissors className="w-4 h-4 text-white" />
          </div>
        </Link>

        <div className="w-6 h-px bg-white/10 my-0.5" />

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
              className={`gdock-item group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                active ? 'opacity-100' : 'opacity-50 hover:opacity-100'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Bencho Running Active Dot */}
              <span
                className={`gdock-dot absolute left-1 w-1 h-1 rounded-full bg-[#6366f1] shadow-[0_0_6px_rgba(99,102,241,0.9)] transition-all ${
                  active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                }`}
              />

              {/* Bencho Glyph with raised cosine magnification */}
              <span className="gdock-glyph flex items-center justify-center text-white">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    active ? 'text-indigo-400' : 'text-zinc-300 group-hover:text-white'
                  }`}
                />
              </span>

              {/* Bencho Floating Tip (.gdock-tip) */}
              <span className="absolute left-[calc(100%+14px)] px-2.5 py-1 rounded-full bg-[#18181b] text-white font-mono text-[9px] uppercase tracking-wider shadow-2xl border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          )
        })}

        <div className="w-6 h-px bg-white/10 my-0.5" />

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={signOut}
          className="gdock-item group relative w-11 h-11 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 opacity-50 hover:opacity-100 transition-all cursor-pointer"
          aria-label="Encerrar sessão"
        >
          <span className="gdock-glyph flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </span>
          <span className="absolute left-[calc(100%+14px)] px-2.5 py-1 rounded-full bg-[#18181b] text-white font-mono text-[9px] uppercase tracking-wider shadow-2xl border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
            Encerrar sessão
          </span>
        </button>
      </nav>
    </>
  )
}
