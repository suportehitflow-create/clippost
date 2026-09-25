'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import PainelResultados from '@/components/dashboard/PainelResultados'
import { createClient } from '@/lib/supabase/client'

export default function ResultadosPage() {
  const [nome, setNome] = useState('André')
  const supabase = createClient()

  useEffect(() => {
    async function pegarNome() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const n = user.user_metadata?.full_name || user.email?.split('@')[0] || 'André'
          setNome(n.charAt(0).toUpperCase() + n.slice(1))
        }
      } catch {}
    }
    pegarNome()
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white select-none">
      {/* Top Header */}
      <header className="h-16 border-b border-white/[0.06] grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/inicio"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
            title="Voltar ao Início"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Resultados & Acompanhamento
          </h1>
        </div>
        <ProfileSwitcher align="center" />
        <div className="flex justify-end">
          <Link
            href="/schedule"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-all"
          >
            Abrir Calendário
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto p-6 md:p-10 pb-28">
        <PainelResultados compacto={false} nomeUsuario={nome} />
      </div>
    </div>
  )
}
