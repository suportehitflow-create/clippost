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
 * Floating Vertical Apple Glass Dock Sidebar
 * - Fixed at upper-left corner of the screen
 * - Compact by default (icons only)
 * - Smoothly auto-expands on mouse hover revealing labels
 * - Raised cosine fisheye magnification on glyphs
 * - Zero manual collapse button needed
 */
export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [isHovered, setIsHovered] = useState(false)

  // Bencho / macOS Fisheye Dock Physics
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
      {/* Spacer para garantir que o conteúdo da página não fique oculto sob o dock flutuante */}
      <div className="w-16 sm:w-20 shrink-0 select-none pointer-events-none" aria-hidden="true" />

      {/* Dock Flutuante Vertical estilo Apple (Fixed Top-Left) */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          onMouseLeave()
        }}
        onMouseMove={onMouseMove}
        className={
          "fixed top-4 left-4 z-50 flex flex-col justify-between rounded-2xl bg-[#0c0c0f]/85 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6)] py-3 px-2 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none " +
          (isHovered ? "w-56" : "w-14")
        }
      >
        <div className="space-y-3">
          {/* Logo Clipost */}
          <div className="flex items-center px-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-90 w-full overflow-hidden"
              title="Clipost"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0 ring-1 ring-white/20">
                <Scissors className="w-4 h-4 text-white" />
              </div>
              <span
                className={
                  "text-sm font-bold tracking-tight text-white whitespace-nowrap transition-all duration-200 " +
                  (isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none")
                }
              >
                Clipost
              </span>
            </Link>
          </div>

          <div className="h-px bg-white/[0.08] mx-1" />

          {/* Navegação Flutuante Fisheye */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon
              const active =
                pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={registerItem(index)}
                  title={item.label}
                  className={
                    "gdock-item group relative flex items-center h-10 rounded-xl transition-colors overflow-hidden " +
                    (isHovered ? "px-2.5 " : "justify-center px-0 ") +
                    (active
                      ? "bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/30 "
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04] ")
                  }
                >
                  {/* Running active dot estilo Apple */}
                  {active && (
                    <span
                      className={
                        "absolute left-0.5 w-1 rounded-full bg-[#6366f1] shadow-[0_0_8px_rgba(99,102,241,0.9)] " +
                        (isHovered ? "h-4" : "h-3 -left-0.5")
                      }
                    />
                  )}

                  {/* Glyph com magnificação fisheye de cosseno elevado */}
                  <div className="gdock-glyph flex items-center justify-center shrink-0 w-6 h-6">
                    <Icon
                      className={
                        "w-4 h-4 transition-colors " +
                        (active ? "text-indigo-400" : "text-zinc-400 group-hover:text-white")
                      }
                    />
                  </div>

                  {/* Label suave com slide-in */}
                  <span
                    className={
                      "text-xs font-medium ml-2.5 truncate whitespace-nowrap transition-all duration-200 " +
                      (isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none")
                    }
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Rodapé: Encerrar sessão */}
        <div className="pt-2 mt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={signOut}
            title="Encerrar sessão"
            className={
              "gdock-item w-full flex items-center h-9 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer overflow-hidden " +
              (isHovered ? "px-2.5" : "justify-center px-0")
            }
          >
            <div className="gdock-glyph flex items-center justify-center shrink-0 w-6 h-6">
              <LogOut className="w-4 h-4" />
            </div>
            <span
              className={
                "text-xs font-medium ml-2.5 truncate whitespace-nowrap transition-all duration-200 " +
                (isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none")
              }
            >
              Encerrar sessão
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
