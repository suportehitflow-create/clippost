'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LiquidToggle } from '@/components/ui/LiquidToggle'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import {
  Zap, Plus, Loader2, Trash2, AlertCircle, CheckCircle2, Clock, ExternalLink, Play, Send, Layers, Cookie, X,
} from 'lucide-react'

// Autopilot: monitora canais do YouTube e perfis do Instagram/TikTok/Facebook. Quando sai um
// vídeo novo, o backend baixa, gera os cortes no template do usuário e deixa na Biblioteca;
// com "Postar automaticamente" ligado, os cortes entram na fila de publicação sozinhos.

type Plataforma = 'youtube' | 'instagram' | 'tiktok' | 'facebook'

interface Watch {
  id: string
  channel_id: string
  channel_handle: string | null
  channel_name: string | null
  clip_duration: string
  is_active: boolean
  auto_post: boolean
  last_checked_at: string | null
  last_error: string | null
}

interface Recente {
  project_id: string | null
  watch_id: string | null
  created_at: string
  projects: { id: string; title: string; status: string } | null
}

const PLATAFORMAS: Record<Plataforma, { nome: string; cor: string; letra: string }> = {
  youtube: { nome: 'YouTube', cor: '#ef4444', letra: 'YT' },
  instagram: { nome: 'Instagram', cor: '#e1306c', letra: 'IG' },
  tiktok: { nome: 'TikTok', cor: '#22d3ee', letra: 'TT' },
  facebook: { nome: 'Facebook', cor: '#3b82f6', letra: 'FB' },
}

const INTERVALOS = [
  { v: 15, l: '15 min' },
  { v: 30, l: '30 min' },
  { v: 60, l: '1 h' },
  { v: 180, l: '3 h' },
  { v: 360, l: '6 h' },
  { v: 720, l: '12 h' },
  { v: 1440, l: '24 h' },
]

const DURACOES = [
  { v: 'auto', l: 'Automático' },
  { v: '30', l: '30s' },
  { v: '60', l: '60s' },
]

function plataformaDoTexto(t: string): Plataforma {
  if (/instagram\.com/i.test(t)) return 'instagram'
  if (/tiktok\.com/i.test(t)) return 'tiktok'
  if (/facebook\.com|fb\.com/i.test(t)) return 'facebook'
  return 'youtube'
}

function plataformaDoWatch(w: Watch): Plataforma {
  const p = w.channel_id.split(':')[0]
  return p === 'ig' ? 'instagram' : p === 'tt' ? 'tiktok' : p === 'fb' ? 'facebook' : 'youtube'
}

function linkDoWatch(w: Watch) {
  if (w.channel_handle?.startsWith('http')) return w.channel_handle
  if (plataformaDoWatch(w) === 'youtube') return `https://www.youtube.com/channel/${w.channel_id}`
  return null
}

const quando = (d: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ainda não verificado'

function Selo({ p }: { p: Plataforma }) {
  const x = PLATAFORMAS[p]
  return (
    <span
      className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-bold text-white ring-1 ring-white/15"
      style={{ background: `linear-gradient(135deg, ${x.cor}, ${x.cor}99)` }}
      title={x.nome}
    >
      {x.letra}
    </span>
  )
}

const pilula = (ativo: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
    ativo ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
  }`

export default function AutopilotPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [watches, setWatches] = useState<Watch[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recentes, setRecentes] = useState<Recente[]>([])
  const [contas, setContas] = useState<{ platform: string }[]>([])
  const [cookiesIg, setCookiesIg] = useState<boolean | null>(null)

  // formulário
  const [canal, setCanal] = useState('')
  const [duracao, setDuracao] = useState('auto')
  const [autoPost, setAutoPost] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [intervalo, setIntervalo] = useState(60)
  const [salvandoIntervalo, setSalvandoIntervalo] = useState(false)

  // cookies do Instagram
  const [modalCookies, setModalCookies] = useState(false)
  const [cookiesTexto, setCookiesTexto] = useState('')
  const [salvandoCookies, setSalvandoCookies] = useState(false)

  const plataformaDigitada = useMemo(() => plataformaDoTexto(canal), [canal])

  function avisar(tipo: 'ok' | 'erro', texto: string) {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 6000)
  }

  async function carregarWatches() {
    try {
      const r = await fetch('/api/autopilot/watches', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setWatches(d.watches ?? [])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id
      if (!uid) return
      setUserId(uid)
      const [rec, acc] = await Promise.all([
        supabase.from('autopilot_processed').select('project_id, watch_id, created_at, projects(id, title, status)').eq('user_id', uid).order('created_at', { ascending: false }).limit(12),
        supabase.from('social_accounts').select('platform').eq('user_id', uid).eq('is_active', true),
      ])
      setRecentes(((rec.data as any[]) ?? []) as Recente[])
      setContas((acc.data as any[]) ?? [])
    })
    carregarWatches()
    fetch('/api/autopilot/settings', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d?.interval_minutes && setIntervalo(d.interval_minutes))
      .catch(() => {})
    fetch('/api/social/instagram-cookies', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setCookiesIg(!!d?.cookies_file_exists))
      .catch(() => setCookiesIg(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function monitorar() {
    if (!canal.trim()) return avisar('erro', 'Cole o link do canal ou do perfil.')
    setSalvando(true)
    try {
      const r = await fetch('/api/autopilot/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: canal.trim(), clip_duration: duracao, auto_post: autoPost }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível cadastrar.')
      setCanal('')
      avisar('ok', `Monitorando ${d.watch?.channel_name || 'o perfil'}. Os próximos vídeos novos viram cortes sozinhos.`)
      await carregarWatches()
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(w: Watch, campos: { auto_post?: boolean; is_active?: boolean }) {
    setWatches(ws => ws.map(x => (x.id === w.id ? { ...x, ...campos } : x)))
    const r = await fetch('/api/autopilot/watches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, ...campos }),
    }).catch(() => null)
    if (!r?.ok) {
      setWatches(ws => ws.map(x => (x.id === w.id ? w : x)))
      avisar('erro', 'Não foi possível salvar essa mudança.')
    }
  }

  async function remover(w: Watch) {
    if (!window.confirm(`Parar de monitorar ${w.channel_name || w.channel_handle}?`)) return
    const r = await fetch(`/api/autopilot/watches?id=${encodeURIComponent(w.id)}`, { method: 'DELETE' }).catch(() => null)
    if (r?.ok) setWatches(ws => ws.filter(x => x.id !== w.id))
    else avisar('erro', 'Não foi possível remover.')
  }

  async function salvarIntervalo(v: number) {
    const antes = intervalo
    setIntervalo(v)
    setSalvandoIntervalo(true)
    try {
      const r = await fetch('/api/autopilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_minutes: v }),
      })
      if (!r.ok) throw new Error()
    } catch {
      setIntervalo(antes)
      avisar('erro', 'Não foi possível salvar o intervalo.')
    } finally {
      setSalvandoIntervalo(false)
    }
  }

  async function salvarCookies() {
    setSalvandoCookies(true)
    try {
      const r = await fetch('/api/social/instagram-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesTexto.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao salvar.')
      setCookiesIg(true)
      setModalCookies(false)
      setCookiesTexto('')
      avisar('ok', 'Instagram conectado ao servidor. Agora dá para monitorar perfis.')
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setSalvandoCookies(false)
    }
  }

  const nomeDoWatch = (id: string | null) => watches.find(w => w.id === id)?.channel_name || ''
  const precisaCookies = plataformaDigitada === 'instagram' && cookiesIg === false

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h1 className="text-sm font-semibold tracking-wide">Autopilot</h1>
        </div>
        <div className="flex justify-center">{userId && <ProfileSwitcher userId={userId} align="center" />}</div>
        <div className="flex justify-end">
          <Link href="/dashboard" className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-200">
            Biblioteca
          </Link>
        </div>
      </header>

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Cortes no piloto automático</h2>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Cadastre um canal do YouTube ou um perfil do Instagram, TikTok ou Facebook. Sempre que sair um vídeo novo, o Clipost baixa, gera os cortes no seu template e deixa tudo pronto na Biblioteca.
          </p>
        </div>

        {aviso && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-2xl border text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-red-500/10 border-red-500/25 text-red-200'}`}>
            {aviso.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {aviso.texto}
          </div>
        )}

        {/* novo monitoramento */}
        <section className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Selo p={plataformaDigitada} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Monitorar um canal ou perfil</h3>
              <p className="text-xs text-zinc-500">YouTube: @canal ou link · Instagram, TikTok e Facebook: link do perfil</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="autopilot-canal"
              value={canal}
              onChange={e => setCanal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !salvando && monitorar()}
              placeholder="@toguro, youtube.com/@canal, instagram.com/perfil, tiktok.com/@perfil"
              className="flex-1 px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm placeholder-zinc-600 outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={monitorar}
              disabled={salvando || precisaCookies}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Monitorar
            </button>
          </div>

          {precisaCookies && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-100">
              <Cookie className="w-4 h-4 shrink-0 text-amber-300" />
              <span className="flex-1">O Instagram só deixa o servidor ver os vídeos de um perfil com uma conta conectada. Conecte uma vez e pronto.</span>
              <button type="button" onClick={() => setModalCookies(true)} className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-900 font-semibold">
                Conectar Instagram
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Duração dos cortes</span>
              <div className="flex flex-wrap gap-1.5">
                {DURACOES.map(d => (
                  <button key={d.v} type="button" className={pilula(duracao === d.v)} onClick={() => setDuracao(d.v)}>
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 border border-white/[0.06] px-4 py-3">
              <div>
                <span className="text-sm font-semibold block">Postar automaticamente</span>
                <span className="text-[11px] text-zinc-500">Publica os cortes nas suas contas, um a cada 3h</span>
              </div>
              <LiquidToggle checked={autoPost} onChange={setAutoPost} activeColor="emerald" />
            </div>
          </div>
          {autoPost && contas.length === 0 && (
            <p className="text-xs text-amber-200/90 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Nenhuma conta conectada: os cortes ficam só na Biblioteca até você conectar uma em{' '}
              <Link href="/settings" className="underline">Ajustes</Link>.
            </p>
          )}
        </section>

        {/* frequência */}
        <section className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Clock className="w-5 h-5 text-zinc-400" />
            <div>
              <h3 className="text-sm font-semibold">Verificar vídeos novos a cada</h3>
              <p className="text-xs text-zinc-500">Vale para todos os seus canais e perfis</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {INTERVALOS.map(i => (
              <button key={i.v} type="button" className={pilula(intervalo === i.v)} disabled={salvandoIntervalo} onClick={() => salvarIntervalo(i.v)}>
                {i.l}
              </button>
            ))}
            {salvandoIntervalo && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
          </div>
        </section>

        {/* monitorados */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Monitorando ({watches.length})</h3>
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
          ) : watches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.1] p-8 text-center text-sm text-zinc-500">
              Nenhum canal ou perfil ainda. Cole um link acima para começar.
            </div>
          ) : (
            <div className="grid gap-3">
              {watches.map(w => {
                const p = plataformaDoWatch(w)
                const link = linkDoWatch(w)
                return (
                  <article key={w.id} className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center gap-4 ${w.is_active ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white/[0.01] border-white/[0.05] opacity-70'}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Selo p={p} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{w.channel_name || w.channel_handle || w.channel_id}</span>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white" title="Abrir">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {PLATAFORMAS[p].nome} · cortes {w.clip_duration === 'auto' ? 'automáticos' : `de ${w.clip_duration}s`} · verificado {quando(w.last_checked_at)}
                        </p>
                        {w.last_error && <p className="text-[11px] text-red-300/90 mt-0.5 line-clamp-1" title={w.last_error}>Última verificação falhou: {w.last_error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <Send className="w-3.5 h-3.5 text-zinc-500" /> Postar sozinho
                        <LiquidToggle checked={w.auto_post} onChange={v => atualizar(w, { auto_post: v })} activeColor="emerald" />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        Ativo
                        <LiquidToggle checked={w.is_active} onChange={v => atualizar(w, { is_active: v })} />
                      </label>
                      <button type="button" onClick={() => remover(w)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10" title="Parar de monitorar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* cortes gerados pelo autopilot */}
        {recentes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vídeos novos que viraram cortes</h3>
              <Link href="/dashboard" className="text-xs text-indigo-300 hover:text-indigo-200">Ver na Biblioteca →</Link>
            </div>
            <div className="grid gap-2">
              {recentes.map((r, i) => (
                <Link
                  key={`${r.project_id}-${i}`}
                  href={r.project_id ? `/project/${r.project_id}` : '/dashboard'}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15]"
                >
                  <Play className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm truncate block">{r.projects?.title || 'Vídeo'}</span>
                    <span className="text-[11px] text-zinc-500">{nomeDoWatch(r.watch_id)} · {quando(r.created_at)}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    r.projects?.status === 'done' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                      : r.projects?.status === 'failed' ? 'text-red-300 border-red-500/30 bg-red-500/10'
                      : 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10'
                  }`}>
                    {r.projects?.status === 'done' ? 'Pronto' : r.projects?.status === 'failed' ? 'Falhou' : 'Gerando'}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Link href="/bulk" className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.01] px-4 py-3 text-xs text-zinc-400 hover:text-white">
          <Layers className="w-4 h-4" /> Quer os vídeos antigos de um perfil de uma vez? Use Edição em Massa → Baixar de um perfil.
        </Link>
      </div>

      {modalCookies && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Conectar Instagram">
          <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Conectar o Instagram ao servidor</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  No computador, entre no Instagram, exporte os cookies com a extensão <b>Get cookies.txt LOCALLY</b> e cole o conteúdo abaixo.
                  Use uma conta secundária: o servidor usa essa sessão só para ver os vídeos dos perfis.
                </p>
              </div>
              <button type="button" onClick={() => setModalCookies(false)} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              id="autopilot-cookies"
              value={cookiesTexto}
              onChange={e => setCookiesTexto(e.target.value)}
              rows={7}
              placeholder="# Netscape HTTP Cookie File&#10;.instagram.com	TRUE	/	TRUE	..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-[11px] font-mono outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={salvarCookies}
              disabled={salvandoCookies || !cookiesTexto.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {salvandoCookies && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
