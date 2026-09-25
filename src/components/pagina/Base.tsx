'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'
import ProfileSwitcher from '@/components/ProfileSwitcher'

// Peças do visual padrão do Clipost (tirado do "Criar cortes"): cabeçalho com ícone, intro centralizada,
// UM cartão com o campo principal, poucas opções em cartões e um botão grande. Tudo novo usa isto.

export function Pagina({ icone: Icone, titulo, direita, children, largura = 'max-w-3xl' }: {
  icone: LucideIcon
  titulo: string
  direita?: ReactNode
  children: ReactNode
  largura?: string
}) {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white">
      <header className="h-16 border-b border-white/[0.06] grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Icone className="w-4 h-4" />
          </div>
          <h1 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold truncate">{titulo}</h1>
        </div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <div className="flex justify-end">{direita}</div>
      </header>
      <div className={`${largura} w-full mx-auto px-4 py-6 sm:p-6 md:p-10 space-y-8`}>{children}</div>
    </div>
  )
}

export function Intro({ selo, titulo, descricao }: { selo?: string; titulo: string; descricao?: ReactNode }) {
  return (
    <div className="text-center space-y-2.5 max-w-lg mx-auto">
      {selo && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">{selo}</div>
      )}
      <h2 className="text-3xl font-black tracking-tight text-white text-balance">{titulo}</h2>
      {descricao && <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{descricao}</p>}
    </div>
  )
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-6 bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 sm:p-8 backdrop-blur-md shadow-2xl ${className}`}>{children}</div>
}

export function Rotulo({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">{children}</label>
      {direita}
    </div>
  )
}

export function Campo({ icone: Icone, ...props }: { icone: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Icone className="w-4 h-4 text-indigo-400" /></div>
      <input {...props}
        className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all disabled:opacity-60" />
    </div>
  )
}

/** Opções em cartões (como a "Duração dos cortes") */
export function Opcoes<T extends string | number>({ valor, mudar, opcoes, colunas = 3 }: {
  valor: T
  mudar: (v: T) => void
  opcoes: { id: T; label: string; desc?: string }[]
  colunas?: 2 | 3 | 4
}) {
  const grade = { 2: 'grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[colunas]
  return (
    <div className={`grid ${grade} gap-2.5`}>
      {opcoes.map(o => (
        <button key={String(o.id)} type="button" onClick={() => mudar(o.id)}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${valor === o.id
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
            : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'}`}>
          <span className={`text-xs font-bold block ${valor === o.id ? 'text-white' : 'text-zinc-200'}`}>{o.label}</span>
          {o.desc && <span className="text-[10px] text-zinc-500 mt-0.5 block leading-tight font-mono">{o.desc}</span>}
        </button>
      ))}
    </div>
  )
}

export function BotaoPrincipal({ carregando, textoCarregando, icone: Icone, children, ...props }: {
  carregando?: boolean
  textoCarregando?: string
  icone: LucideIcon
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} disabled={carregando || props.disabled}
      className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
      {carregando ? <><Loader2 className="w-4 h-4 animate-spin" /> {textoCarregando || 'Aguarde…'}</> : <><Icone className="w-4 h-4" /> {children}</>}
    </button>
  )
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const cor = { erro: 'bg-rose-500/10 border-rose-500/20 text-rose-300', ok: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300', info: 'bg-white/[0.03] border-white/[0.08] text-zinc-400' }[tipo]
  return (
    <div className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 ${cor}`}>
      {tipo === 'info' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-indigo-300" /> : tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Divisória fina entre blocos dentro do cartão */
export const Divisoria = () => <div className="border-t border-white/[0.06]" />
