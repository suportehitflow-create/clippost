'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Film, Link2 } from 'lucide-react'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import PerfilEmMassa from '@/components/bulk/PerfilEmMassa'

// O editor usa canvas, <video> e localStorage: só no navegador
const EditorMassa = dynamic(() => import('@/components/editor-massa/EditorMassa'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Carregando o editor…</div>,
})

type Aba = 'editor' | 'perfil'
const CHAVE_ABA = 'clippost_bulk_aba'

export default function EdicaoEmMassaPage() {
  const [aba, setAba] = useState<Aba>('editor')

  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_ABA)
      if (salva === 'editor' || salva === 'perfil') setAba(salva)
    } catch {}
  }, [])

  function trocar(nova: Aba) {
    setAba(nova)
    try { localStorage.setItem(CHAVE_ABA, nova) } catch {}
  }

  return (
    // Altura fixa descontando o dock flutuante, para o rodapé do editor não ficar embaixo dele
    <div className="flex flex-col h-[calc(100dvh-6rem)] min-h-[620px] bg-[#0a0a0c]">
      <header className="h-14 shrink-0 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 bg-[#0c0c0f]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold text-white tracking-wide whitespace-nowrap">Edição em Massa</h1>
          <div className="flex p-1 bg-white/[0.02] border border-white/[0.08] rounded-xl gap-1" role="tablist" aria-label="Modo">
            {([
              { id: 'editor', label: 'Editor de vídeos', icon: Film },
              { id: 'perfil', label: 'Baixar de um perfil', icon: Link2 },
            ] as const).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                onClick={() => trocar(t.id)}
                className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  aba === t.id ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <ProfileSwitcher align="center" />
        <span />
      </header>

      {aba === 'editor' ? (
        <div className="flex-1 min-h-0">
          <EditorMassa />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PerfilEmMassa />
        </div>
      )}
    </div>
  )
}
