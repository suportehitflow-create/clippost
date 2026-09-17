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
  LogOut,
  PanelLeftClose,
  PanelLeft
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

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const supabase = createClient()

  // No /templates ou /project/[id], a sidebar recolhe para dar foco total à área de edição
  const isEditorPage = pathname.startsWith('/templates') || pathname.startsWith('/project/')
  const [collapsed, setCollapsed] = useState(isEditorPage)

  // Bencho / macOS Fisheye Dock Physics
  const { registerItem, onMouseMove, onMouseLeave } = useVerticalFisheyeDock(3.0)

  async function signOut() {
    document.cookie = 'clippost_demo_auth=; path=/; max-age=0'
    localStorage.removeItem('clippost_demo_auth')
    localStorage.removeItem('clippost_demo_user_id')
    localStorage.removeItem('clippost_demo_user_email')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside
      className={"border-r border-white/[0.08] bg-[#0c0c0f]/85 backdrop-blur-2xl flex flex-col justify-between flex-shrink-0 sticky top-0 h-screen transition-[width,padding] duration-200 ease-out z-40 shadow-[4px_0_24px_rgba(0,0,0,0.5)] " + (collapsed ? "w-16 p-2" : "w-60 p-4")}
    >
      <div className="space-y-4">
        {/* Header com Logo e Botão de Recolher */}
        <div className="flex items-center justify-between gap-2 px-1">
          <Link
            href="/dashboard"
            className={"flex items-center gap-2.5 transition-opacity hover:opacity-90 " + (collapsed ? "justify-center w-full" : "")}
            title="Clipost"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0 ring-1 ring-white/20">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="text-base font-bold tracking-tight text-white font-mono">Clipost</span>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
              title="Recolher menu"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botão de Expandir quando recolhida */}
        {collapsed && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
              title="Expandir menu lateral"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navegação Vertical Fisheye Dock (macOS / Bencho Style) */}
        <nav
          className="space-y-1.5 py-1"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
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
                  "gdock-item group relative flex items-center py-2 text-sm font-medium rounded-xl transition-colors " +
                  (collapsed ? "justify-center px-0 h-10 w-full " : "px-3 h-10 ") +
                  (active
                    ? "bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20 "
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.03] ")
                }
              >
                {/* Running active dot indicador (macOS dock style) */}
                {active && (
                  <span
                    className={
                      "absolute left-0.5 rounded-full bg-[#6366f1] shadow-[0_0_8px_rgba(99,102,241,0.9)] transition-all " +
                      (collapsed ? "w-1 h-3 -left-0.5" : "w-1 h-4")
                    }
                  />
                )}

                {/* Glyph magnifies with raised cosine curve; button remains stable */}
                <div className="gdock-glyph flex items-center justify-center shrink-0">
                  <Icon
                    className={
                      "w-4 h-4 transition-colors " +
                      (active ? "text-indigo-400" : "text-zinc-400 group-hover:text-white")
                    }
                  />
                </div>

                {!collapsed && (
                  <span className="ml-3 truncate tracking-tight">{item.label}</span>
                )}

                {/* Tooltip flutuante instantâneo no modo recolhido */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2 py-1 bg-[#18181b] text-white text-xs rounded-md shadow-2xl border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Rodapé / Sair */}
      <div className="pt-3 border-t border-white/[0.08]">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="px-2 text-xs text-zinc-500 truncate" title={user.email}>
              {user.email}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-white/[0.03] cursor-pointer"
            >
              <span>Encerrar sessão</span>
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={signOut}
              className="gdock-item p-2 text-zinc-400 hover:text-red-400 hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer group relative"
              title="Encerrar sessão"
            >
              <div className="gdock-glyph flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="absolute left-full ml-3 px-2 py-1 bg-[#18181b] text-white text-xs rounded-md shadow-2xl border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Encerrar sessão
              </span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
