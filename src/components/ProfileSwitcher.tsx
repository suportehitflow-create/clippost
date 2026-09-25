'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Plus, Settings, Check } from 'lucide-react'
import Link from 'next/link'

interface SocialAccount {
  id: string
  platform: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  tiktok: '🎵',
  youtube: '▶️',
  youtube_shorts: '▶️',
}

export default function ProfileSwitcher({ userId: userIdProp, align = 'right' }: { userId?: string; align?: 'right' | 'center' }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(userIdProp || null)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [active, setActive] = useState<SocialAccount | null>(null)
  const [open, setOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
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
  }, [])

  useEffect(() => {
    if (userId) loadAccounts()
  }, [userId])

  async function loadAccounts() {
    try {
      // Query ONLY existing columns in Supabase to avoid 400 errors
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, platform, username, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error || !data || data.length === 0) {
        setAccounts([])
        setActive(null)
        return
      }

      // Read locally selected account id
      let savedActiveId: string | null = null
      try {
        const saved = localStorage.getItem('clippost_active_account')
        if (saved) savedActiveId = JSON.parse(saved)?.id
      } catch {}

      const mapped: SocialAccount[] = data.map((acc: any) => ({
        id: acc.id,
        platform: acc.platform,
        username: acc.username,
        display_name: acc.username ? `@${acc.username}` : 'Conta',
        avatar_url: null,
        is_active: savedActiveId ? acc.id === savedActiveId : false
      }))

      const activeAcc = mapped.find(a => a.is_active) || mapped[0]
      if (activeAcc) activeAcc.is_active = true

      setAccounts(mapped)
      setActive(activeAcc || null)
      if (activeAcc) {
        try { localStorage.setItem('clippost_active_account', JSON.stringify(activeAcc)) } catch {}
      }
    } catch {
      setAccounts([])
      setActive(null)
    }
  }

  function switchAccount(account: SocialAccount) {
    const updated = accounts.map(a => ({ ...a, is_active: a.id === account.id }))
    setAccounts(updated)
    const newActive = { ...account, is_active: true }
    setActive(newActive)
    try { localStorage.setItem('clippost_active_account', JSON.stringify(newActive)) } catch {}
    // páginas que dependem da conta (Raio-X, Agendar…) escutam e recarregam
    window.dispatchEvent(new CustomEvent('clipost:conta-ativa', { detail: newActive }))
    setOpen(false)
  }

  async function connectAccount() {
    setConnecting(true)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (data.access_url) window.location.href = data.access_url
    } catch {}
    setConnecting(false)
  }

  const label = active
    ? (active.username ? `@${active.username}` : active.display_name || 'Conta')
    : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all cursor-pointer min-w-[120px]"
      >
        {active ? (
          <>
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
              {active.avatar_url
                ? <img src={active.avatar_url} alt={label || ''} className="w-full h-full object-cover" />
                : <span className="text-[10px]">{PLATFORM_ICONS[active.platform] || '🌐'}</span>}
            </div>
            <span className="text-xs font-semibold text-white max-w-[130px] truncate">{label}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-zinc-400">Conectar conta</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ml-auto ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-60 bg-[#13141a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden ${
          align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
        }`}>
          {accounts.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Perfis conectados</span>
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {accounts.map(acc => {
                  const accLabel = acc.username ? `@${acc.username}` : acc.display_name || 'Conta'
                  return (
                    <button
                      key={acc.id}
                      onClick={() => switchAccount(acc)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-all text-left cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {acc.avatar_url
                          ? <img src={acc.avatar_url} alt={accLabel} className="w-full h-full object-cover" />
                          : <span className="text-[10px]">{PLATFORM_ICONS[acc.platform] || '🌐'}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-white block truncate">{accLabel}</span>
                        <span className="text-[10px] text-zinc-500 capitalize">{acc.platform.replace('_', ' ')}</span>
                      </div>
                      {acc.is_active && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-white/[0.06]" />
            </>
          )}
          <div className="p-2 space-y-1">
            <button
              onClick={connectAccount}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">
                {connecting ? 'Redirecionando...' : 'Adicionar conta'}
              </span>
            </button>
            <Link
              href="/settings#social"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-400">Gerenciar contas</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
