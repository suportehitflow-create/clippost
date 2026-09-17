'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Scissors,
  Layers,
  Sparkles,
  Zap,
  Calendar,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Navegação completa reorganizada conforme solicitação do usuário
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Criar Cortes', href: '/upload', icon: Scissors },
  { label: 'Edição em Massa', href: '/bulk', icon: Layers },
  { label: 'Brand Kit & Templates', href: '/templates', icon: Sparkles },
  { label: 'Autopilot', href: '/autopilot', icon: Zap },
  { label: 'Agendamentos', href: '/schedule', icon: Calendar },
]

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    document.cookie = 'clippost_demo_auth=; path=/; max-age=0'
    localStorage.removeItem('clippost_demo_auth')
    localStorage.removeItem('clippost_demo_user_id')
    localStorage.removeItem('clippost_demo_user_email')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-[#0c0c0f] flex flex-col justify-between p-5 flex-shrink-0 sticky top-0 h-screen">
      <div className="space-y-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange-600 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">Clip Pro</span>
        </Link>

        {/* Lista de Navegação */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Perfil & Sair no Rodapé */}
      <div className="pt-4 border-t border-white/[0.08] space-y-2">
        <div className="px-3 text-xs text-zinc-500 truncate" title={user.email}>
          {user.email}
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-white/[0.03] cursor-pointer"
        >
          <span>Encerrar sessão</span>
          <LogOut className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    </aside>
  )
}
