'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Plus, Settings, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ModalConectarRedes from '@/components/ModalConectarRedes'

// Perfis (marca): cada perfil junta as redes onde aquela marca posta (Instagram, Facebook, TikTok,
// YouTube) e tem o SEU template. Trocar de perfil aqui troca as redes e o template usados no site.

interface Conta {
  id: string
  platform: string
  username: string | null
  account_id: string | null
}
interface Perfil {
  id: string
  nome: string
}

const REDE: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  threads: 'Threads',
}
const SIGLA: Record<string, string> = { instagram: 'IG', facebook: 'FB', tiktok: 'TT', youtube: 'YT', youtube_shorts: 'YT', threads: 'TH', x: 'X', linkedin: 'IN' }

export const perfilDaConta = (accountId: string | null | undefined) => {
  const a = String(accountId || '')
  return a.includes('::') ? a.split('::')[0] : 'principal'
}

/** Perfil ativo salvo neste navegador (o servidor também guarda) */
export function perfilAtivoSalvo(): string {
  try {
    return localStorage.getItem('clippost_active_perfil') || 'principal'
  } catch {
    return 'principal'
  }
}

export default function ProfileSwitcher({ userId: userIdProp, align = 'right' }: { userId?: string; align?: 'right' | 'center' }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(userIdProp || null)
  const [contas, setContas] = useState<Conta[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [ativo, setAtivo] = useState<string>('principal')
  const [open, setOpen] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modalPerfil, setModalPerfil] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userIdProp) {
      supabase.auth.getUser()
        .then(({ data }) => { if (data?.user) setUserId(data.user.id) })
        .catch(() => {})
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (userId) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function carregar() {
    const [{ data }, p] = await Promise.all([
      supabase.from('social_accounts').select('id, platform, username, account_id, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
      fetch('/api/perfis').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
    const cs = ((data as Conta[]) ?? [])
    setContas(cs)
    const lista: Perfil[] = p?.perfis?.length ? p.perfis : [{ id: 'principal', nome: 'Perfil principal' }]
    setPerfis(lista)
    const at = p?.ativo || perfilAtivoSalvo()
    setAtivo(at)
    lembrar(at, cs)
  }

  // compatibilidade: páginas antigas leem "a conta ativa" — fica a primeira rede do perfil
  function lembrar(perfilId: string, cs: Conta[]) {
    try {
      localStorage.setItem('clippost_active_perfil', perfilId)
      const primeira = cs.find(c => perfilDaConta(c.account_id) === perfilId)
      if (primeira) localStorage.setItem('clippost_active_account', JSON.stringify({ ...primeira, is_active: true }))
      else localStorage.removeItem('clippost_active_account')
    } catch {}
  }

  async function trocar(perfilId: string) {
    if (perfilId === ativo) return setOpen(false)
    setOcupado(perfilId)
    const r = await fetch('/api/perfis/ativar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: perfilId }) }).catch(() => null)
    setOcupado(null)
    if (!r?.ok) return
    lembrar(perfilId, contas)
    // template e contas mudam em todas as telas: recarrega a página no perfil novo
    window.location.reload()
  }

  // abre a tela do Clipost com as redes; cada botão vai direto para o login da rede
  function conectar(perfilId: string) {
    setOpen(false)
    setModalPerfil(perfilId)
  }

  async function criar() {
    const nome = novoNome.trim()
    if (!nome) return
    setOcupado('criar')
    const r = await fetch('/api/perfis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setOcupado(null)
    if (d.perfil) {
      setCriando(false); setNovoNome(''); carregar()
      // perfil novo já abre a conexão das redes dele, sem sair do site
      conectar(d.perfil.id)
    } else setErro(d.detail || d.error || 'Não foi possível criar o perfil agora.')
  }

  const perfilAtual = perfis.find(p => p.id === ativo)
  const redesDe = (pid: string) => contas.filter(c => perfilDaConta(c.account_id) === pid)
  const redesAtuais = redesDe(ativo)
  const semNada = perfis.length <= 1 && contas.length === 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all cursor-pointer min-w-[120px]"
      >
        {semNada ? (
          <span className="text-xs font-medium text-zinc-400">Conectar conta</span>
        ) : (
          <>
            {/* o @ da primeira rede conectada do perfil (é a "conta" em que a pessoa está); sem rede, o nome do perfil */}
            <span className="text-xs font-semibold text-white max-w-[160px] truncate">
              {redesAtuais[0]?.username ? `@${redesAtuais[0].username.replace(/^@/, '')}` : perfilAtual?.nome || 'Perfil'}
            </span>
            <span className="flex gap-0.5">
              {[...new Set(redesAtuais.map(c => SIGLA[c.platform] || c.platform.slice(0, 2).toUpperCase()))].map(s => (
                <span key={s} className="text-[9px] font-bold px-1 py-px rounded bg-white/[0.08] text-zinc-300">{s}</span>
              ))}
            </span>
          </>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 ml-auto ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-72 bg-[#13141a] border border-white/[0.1] rounded-2xl z-50 overflow-hidden ${align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>
          <div className="px-3 pt-3 pb-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Perfis</span>
          </div>
          <div className="px-2 pb-2 space-y-0.5 max-h-80 overflow-y-auto">
            {perfis.map(p => {
              const redes = redesDe(p.id)
              return (
                <div key={p.id} className={`rounded-xl ${p.id === ativo ? 'bg-white/[0.04]' : ''}`}>
                  <button type="button" onClick={() => trocar(p.id)} className="w-full flex items-center gap-2.5 px-2.5 pt-2 pb-1 text-left cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white block truncate">{p.nome}</span>
                      <span className="text-[10px] text-zinc-500 block truncate">
                        {redes.length ? redes.map(c => `${REDE[c.platform] || c.platform}${c.username ? ` @${c.username.replace(/^@/, '')}` : ''}`).join(' · ') : 'Nenhuma rede conectada'}
                      </span>
                    </div>
                    {ocupado === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : p.id === ativo && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                  <button type="button" onClick={() => conectar(p.id)} className="ml-2.5 mb-1.5 text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
                    {redes.length ? '+ Conectar outra rede' : '+ Conectar redes'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="border-t border-white/[0.06] p-2 space-y-1">
            {erro && <p role="alert" className="px-2.5 py-1.5 text-[11px] text-red-300">{erro}</p>}
            {criando ? (
              <div className="flex gap-1.5 p-1">
                <input
                  id="novo-perfil-nome"
                  autoFocus
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && criar()}
                  placeholder="Nome do perfil (ex.: Música tal)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                />
                <button type="button" onClick={criar} disabled={!novoNome.trim() || ocupado === 'criar'} className="px-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-50">
                  {ocupado === 'criar' ? '…' : 'Criar'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setCriando(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Novo perfil</span>
              </button>
            )}
            <Link href="/settings#social" onClick={() => setOpen(false)} className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/[0.06]">
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-400">Gerenciar contas</span>
            </Link>
          </div>
        </div>
      )}
      {modalPerfil && (
        <ModalConectarRedes
          perfilId={modalPerfil}
          perfilNome={perfis.length > 1 ? perfis.find(p => p.id === modalPerfil)?.nome : undefined}
          contas={redesDe(modalPerfil)}
          fechar={() => setModalPerfil(null)}
          aoConectar={carregar}
        />
      )}
    </div>
  )
}
