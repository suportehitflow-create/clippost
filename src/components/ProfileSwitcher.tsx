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

export default function ProfileSwitcher({ userId }: { userId: string }) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [active, setActive] = useState<SocialAccount | null>(null)
  const [open, setOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAccounts()
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userId])

  async function loadAccounts() {
    const { data } = await supabase
      .from('social_accounts')
      .select('id, platform, username, display_name, avatar_url, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) {
      // Try syncing from Upload-Post
      try {
        await fetch('/api/social/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        })
        const { data: synced } = await supabase
          .from('social_accounts')
          .select('id, platform, username, display_name, avatar_url, is_active')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
        if (synced) applyAccounts(synced as SocialAccount[])
      } catch {}
      return
    }
    applyAccounts(data as SocialAccount[])
  }

  function applyAccounts(data: SocialAccount[]) {
    setAccounts(data)
    const activeAcc = data.find(a => a.is_active) || data[0]
    setActive(activeAcc)
    try { localStorage.setItem('clippost_active_account', JSON.stringify(activeAcc)) } catch {}
  }

  async function switchAccount(account: SocialAccount) {
    await supabase.from('social_accounts').update({ is_active: false }).eq('user_id', userId)
    await supabase.from('social_accounts').update({ is_active: true }).eq('id', account.id)
    await supabase.from('profiles').update({ active_social_account_id: account.id }).eq('id', userId)
    setActive(account)
    setAccounts(prev => prev.map(a => ({ ...a, is_active: a.id === account.id })))
    try { localStorage.setItem('clippost_active_account', JSON.stringify(account)) } catch {}
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
        <div className="absolute right-0 top-full mt-2 w-60 bg-[#13141a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
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
          <div className="p-2 space-y-0.5">
            <button
              onClick={connectAccount}
              disabled={connecting}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-300">
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