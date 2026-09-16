'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Layers,
  Radio,
  Sparkles,
  Calendar,
  CreditCard,
  LogOut,
  Palette,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Novo Clipe', href: '/upload', icon: Upload },
  { label: 'Batch Studio', href: '/bulk', icon: Layers },
  { label: 'Canais AutoPilot', href: '/autopilot', icon: Radio },
  { label: 'Brand Kit', href: '/brand-kit', icon: Palette },
  { label: 'Templates', href: '/templates', icon: Sparkles },
  { label: 'Agendamentos', href: '/schedule', icon: Calendar },
  { label: 'Assinatura', href: '/billing', icon: CreditCard },
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
    <aside className="w-64 border-r border-white/[0.08] bg-[#0f0f12]/80 backdrop-blur-xl flex flex-col justify-between p-5 flex-shrink-0 sticky top-0 h-screen">
      <div className="space-y-6">
        {/* Logo Minimalista Apple Style */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange-600 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight text-white">clipost</span>
        </div>

        {/* Lista de Navegação Unificada */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.05]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Perfil & Sair no Rodapé da Sidebar */}
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
