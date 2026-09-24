'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  User, Shield, Cpu, LogOut, Check, Zap,
  Plus, Trash2, Link as LinkIcon, CheckCircle2
} from 'lucide-react'
import LiquidToggle from '@/components/ui/LiquidToggle'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵',
  youtube: '▶️', youtube_shorts: '▶️',
}
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  youtube: 'YouTube', youtube_shorts: 'YouTube Shorts',
}

interface SocialAccount {
  id: string
  platform: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

function SearchParamsReader({ onMetaConnected, onMetaError }: {
  onMetaConnected: () => void
  onMetaError: (e: string) => void
}) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('meta_connected') === '1') onMetaConnected()
    if (searchParams.get('meta_error')) onMetaError(searchParams.get('meta_error') || 'Erro ao conectar')
  }, [searchParams])
  return null
}
export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [plan, setPlan] = useState('Pro Creator')
  const [autoSubtitles, setAutoSubtitles] = useState(true)
  const [aiTracking, setAiTracking] = useState(true)
  const [autoPublish, setAutoPublish] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [connectingUpload, setConnectingUpload] = useState(false)
  const [metaConnected, setMetaConnected] = useState(false)
  const [metaError, setMetaError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
        setUserId(user.id)
        // Load profile settings
        const { data: pSimple } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
        if (pSimple) {
          setPlan(pSimple.plan === 'pro' ? 'Pro Creator' : pSimple.plan === 'free' ? 'Gratuito' : pSimple.plan)
        }
        try {
          const saved = localStorage.getItem('clippost_auto_publish')
          if (saved !== null) setAutoPublish(saved === 'true')
        } catch {}
        // Load social accounts
        loadAccounts(user.id)
      }
    }
    loadUser()
  }, [])

  async function loadAccounts(uid: string) {
    try {
      const { data } = await supabase
        .from('social_accounts')
        .select('id, platform, username, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })

      let savedActiveId: string | null = null
      try {
        const saved = localStorage.getItem('clippost_active_account')
        if (saved) savedActiveId = JSON.parse(saved)?.id
      } catch {}

      const mapped: SocialAccount[] = (data || []).map((acc: any) => ({
        id: acc.id,
        platform: acc.platform,
        username: acc.username,
        display_name: acc.username ? `@${acc.username}` : 'Conta',
        avatar_url: null,
        is_active: savedActiveId ? acc.id === savedActiveId : false,
        created_at: acc.created_at
      }))

      if (mapped.length > 0 && !mapped.some(a => a.is_active)) {
        mapped[0].is_active = true
      }

      setAccounts(mapped)
    } catch {
      setAccounts([])
    }
  }

  async function toggleAutoPublish(val: boolean) {
    setAutoPublish(val)
    try { localStorage.setItem('clippost_auto_publish', String(val)) } catch {}
    if (userId) {
      try {
        await supabase.from('profiles').update({ auto_publish: val }).eq('id', userId)
      } catch (e) {
        console.warn('Coluna auto_publish ainda não migrada:', e)
      }
      showSaved()
    }
  }

  function showSaved() {
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2500)
  }

  async function connectViaUploadPost() {
    setConnectingUpload(true)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (data.access_url) window.location.href = data.access_url
    } catch {}
    setConnectingUpload(false)
  }

  async function connectViaMeta() {
    setConnectingMeta(true)
    const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
    if (!META_APP_ID) {
      setMetaError('META_APP_ID não configurado. Configure NEXT_PUBLIC_META_APP_ID no Vercel.')
      setConnectingMeta(false)
      return
    }
    const siteUrl = window.location.origin
    const callbackUrl = `${siteUrl}/api/auth/meta/callback`
    const scope = ['instagram_basic', 'instagram_content_publish', 'pages_manage_posts', 'pages_read_engagement', 'pages_show_list'].join(',')
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}&state=${userId}`
    window.location.href = url
  }

  async function removeAccount(id: string) {
    if (!confirm('Remover essa conta conectada?')) return
    setRemovingId(id)
    await supabase.from('social_accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
    setRemovingId(null)
  }

  async function signOut() {
    if (!confirm('Deseja realmente encerrar sua sessão?')) return
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Ajustes da Conta</h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Gerencie contas sociais, automações e preferências.
          </p>
        </div>
        {savedNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Salvo</span>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <SearchParamsReader
          onMetaConnected={() => setMetaConnected(true)}
          onMetaError={(e) => setMetaError(e)}
        />
      </Suspense>

      <div className="space-y-6">
        {/* SEÇÃO: CONTA */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Perfil & Assinatura</h2>
              <p className="text-[11px] text-zinc-400">Seus dados de autenticação e acesso.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">E-mail</span>
              <p className="text-xs font-semibold text-zinc-200 truncate">{userEmail}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Plano</span>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-indigo-400">{plan}</p>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/30">Ativo</span>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO: CONTAS SOCIAIS */}
        <section id="social" className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <LinkIcon className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Contas Conectadas</h2>
                <p className="text-[11px] text-zinc-400">Cada conta é um perfil independente com seu template.</p>
              </div>
            </div>
          </div>

          {/* Feedback de conexão Meta */}
          {metaConnected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Instagram e Facebook conectados com sucesso!</span>
            </div>
          )}
          {metaError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              Erro: {metaError}
            </div>
          )}

          {/* Lista de contas conectadas */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              {accounts.map(acc => {
                const label = acc.username ? `@${acc.username}` : acc.display_name || 'Conta'
                return (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {acc.avatar_url
                        ? <img src={acc.avatar_url} alt={label} className="w-full h-full object-cover" />
                        : <span className="text-sm">{PLATFORM_ICONS[acc.platform] || '🌐'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{label}</span>
                        {acc.is_active && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-mono border border-indigo-500/30">ativo</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500">{PLATFORM_LABELS[acc.platform] || acc.platform}</span>
                    </div>
                    <button
                      onClick={() => removeAccount(acc.id)}
                      disabled={removingId === acc.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Botões de conexão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={connectViaMeta}
              disabled={connectingMeta}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/[0.03] transition-all cursor-pointer text-left disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                <span>📸</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">
                  {connectingMeta ? 'Redirecionando...' : 'Instagram & Facebook'}
                </span>
                <span className="text-[10px] text-zinc-500">Via Meta API direta</span>
              </div>
              <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
            </button>

            <button
              onClick={connectViaUploadPost}
              disabled={connectingUpload}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition-all cursor-pointer text-left disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                <span>🎵▶️</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">
                  {connectingUpload ? 'Redirecionando...' : 'TikTok & YouTube'}
                </span>
                <span className="text-[10px] text-zinc-500">Via Upload-Post</span>
              </div>
              <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
            </button>
          </div>
        </section>

        {/* SEÇÃO: AUTOMAÇÕES DE IA */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Automações de IA</h2>
              <p className="text-[11px] text-zinc-400">Configure os módulos automáticos do pipeline de vídeo.</p>
            </div>
          </div>
          <div className="space-y-4 pt-2 divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between pt-3 first:pt-0">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-zinc-200 block">Enquadramento IA Automático</span>
                <span className="text-[11px] text-zinc-500 leading-normal block">
                  Identifica e centraliza rostos automaticamente sem ajustes manuais.
                </span>
              </div>
              <LiquidToggle checked={aiTracking} onChange={setAiTracking} activeColor="indigo" />
            </div>
            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-zinc-200 block">Legendas Sincronizadas por Padrão</span>
                <span className="text-[11px] text-zinc-500 leading-normal block">
                  Gera transcrição temporal automática palavra por palavra.
                </span>
              </div>
              <LiquidToggle checked={autoSubtitles} onChange={setAutoSubtitles} activeColor="indigo" />
            </div>
          </div>
        </section>

        {/* SEÇÃO: AUTO-POST */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center text-zinc-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Publicação Automática</h2>
              <p className="text-[11px] text-zinc-400">Controla o que acontece depois que os clipes são gerados.</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="space-y-1 pr-4">
              <span className="text-xs font-semibold text-zinc-200 block">Auto-agendar após corte</span>
              <span className="text-[11px] text-zinc-500 leading-normal block">
                {autoPublish
                  ? '🟢 Ativo — clipes são agendados automaticamente para o perfil ativo.'
                  : '⚫ Desativado — você agenda manualmente clicando em "Agendar todos".'}
              </span>
            </div>
            <LiquidToggle checked={autoPublish} onChange={toggleAutoPublish} activeColor="indigo" />
          </div>
          {!autoPublish && (
            <div className="p-3 rounded-xl bg-zinc-500/[0.06] border border-zinc-500/20 text-zinc-300/80 text-[11px] leading-relaxed">
              <strong className="text-zinc-300">Auto-post desativado.</strong> Após gerar os cortes, vá para
              a tela de Agendamentos e clique em <strong className="text-zinc-300">"Agendar todos"</strong> para publicar em lote.
            </div>
          )}
        </section>

        {/* SEÇÃO: SESSÃO */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Sessão & Desconexão</h2>
              <p className="text-[11px] text-zinc-400">Encerre sua sessão com segurança.</p>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between">
            <p className="text-xs text-zinc-400">Você precisará entrar novamente para acessar seus projetos.</p>
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ml-4"
            >
              <LogOut className="w-4 h-4" />
              <span>Encerrar Sessão</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}