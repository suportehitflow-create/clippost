'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { ModalRaioX } from '@/components/ferramentas/RaioX'
import { Pagina, Intro, Cartao, Rotulo, Campo, Opcoes, BotaoPrincipal, Aviso } from '@/components/pagina/Base'
import {
  Zap, Plus, Loader2, Trash2, CheckCircle2, Clock, ExternalLink, Play, Cookie, X, Link2, Send, Check, Ban, History, Inbox, Radar,
} from 'lucide-react'

// Autopilot: monitora canais do YouTube e perfis do Instagram/TikTok/Facebook. Vídeo novo → cortes
// no template do usuário. Cada monitoramento escolhe o destino: só Biblioteca, "eu aprovo antes"
// (aba Aguardando aprovação) ou postar sozinho (um a cada 3h).

type Plataforma = 'youtube' | 'instagram' | 'tiktok' | 'facebook'
type Modo = 'biblioteca' | 'aprovar' | 'auto'
type Aba = 'monitorados' | 'aprovacao' | 'historico'

interface Watch {
  id: string
  channel_id: string
  channel_handle: string | null
  channel_name: string | null
  clip_duration: string
  is_active: boolean
  modo?: Modo
  auto_post: boolean
  last_checked_at: string | null
  last_error: string | null
}
interface Recente { project_id: string | null; watch_id: string | null; created_at: string; projects: { id: string; title: string; status: string } | null }
interface CorteAprov {
  id: string; title: string | null; hook: string | null; storage_url: string | null; score: number | null; created_at: string; canal: string
  decisao?: 'aprovado' | 'recusado'; post_status?: string; agendado_para?: string
}

const PLATAFORMAS: Record<Plataforma, { nome: string; cor: string; letra: string }> = {
  youtube: { nome: 'YouTube', cor: '#ef4444', letra: 'YT' },
  instagram: { nome: 'Instagram', cor: '#e1306c', letra: 'IG' },
  tiktok: { nome: 'TikTok', cor: '#22d3ee', letra: 'TT' },
  facebook: { nome: 'Facebook', cor: '#3b82f6', letra: 'FB' },
}
const INTERVALOS = [15, 30, 60, 180, 360, 720, 1440]
const nomeIntervalo = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`)
const MODOS: { id: Modo; label: string; desc: string }[] = [
  { id: 'biblioteca', label: 'Só na Biblioteca', desc: 'Você posta quando quiser' },
  { id: 'aprovar', label: 'Eu aprovo antes', desc: 'Aprova ou recusa cada corte' },
  { id: 'auto', label: 'Postar sozinho', desc: 'Um corte a cada 3h' },
]
const NOME_MODO: Record<Modo, string> = { biblioteca: 'Só Biblioteca', aprovar: 'Eu aprovo', auto: 'Posta sozinho' }

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
const quando = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ainda não verificado'

function Selo({ p }: { p: Plataforma }) {
  const x = PLATAFORMAS[p]
  return (
    <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-bold text-white ring-1 ring-white/15"
      style={{ background: `linear-gradient(135deg, ${x.cor}, ${x.cor}99)` }} title={x.nome}>{x.letra}</span>
  )
}

export default function AutopilotPage() {
  const supabase = useMemo(() => createClient(), [])
  const [aba, setAba] = useState<Aba>('monitorados')
  const [watches, setWatches] = useState<Watch[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recentes, setRecentes] = useState<Recente[]>([])
  const [contas, setContas] = useState<{ platform: string }[]>([])
  const [cookiesIg, setCookiesIg] = useState<boolean | null>(null)

  const [canal, setCanal] = useState('')
  const [duracao, setDuracao] = useState('auto')
  const [modo, setModo] = useState<Modo>('aprovar')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [intervalo, setIntervalo] = useState(60)

  const [modalCookies, setModalCookies] = useState(false)
  const [cookiesTexto, setCookiesTexto] = useState('')
  const [salvandoCookies, setSalvandoCookies] = useState(false)
  const [raioX, setRaioX] = useState<string | null>(null)

  // aprovação
  const [pendentes, setPendentes] = useState<CorteAprov[]>([])
  const [historico, setHistorico] = useState<CorteAprov[]>([])
  const [monAprovar, setMonAprovar] = useState(0)
  const [selAprov, setSelAprov] = useState<string[]>([])
  const [decidindo, setDecidindo] = useState<string | null>(null)

  const plataformaDigitada = useMemo(() => plataformaDoTexto(canal), [canal])
  const precisaCookies = plataformaDigitada === 'instagram' && cookiesIg === false

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

  async function carregarAprovacao() {
    const r = await fetch('/api/autopilot/aprovacao', { cache: 'no-store' }).catch(() => null)
    const d = r?.ok ? await r.json().catch(() => null) : null
    if (!d) return
    setPendentes(d.pendentes ?? [])
    setHistorico(d.historico ?? [])
    setMonAprovar(d.monitoramentos_aprovar ?? 0)
    setSelAprov(s => s.filter(id => (d.pendentes ?? []).some((p: CorteAprov) => p.id === id)))
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id
      if (!uid) return
      const [rec, acc] = await Promise.all([
        supabase.from('autopilot_processed').select('project_id, watch_id, created_at, projects(id, title, status)').eq('user_id', uid).order('created_at', { ascending: false }).limit(12),
        supabase.from('social_accounts').select('platform').eq('user_id', uid),
      ])
      setRecentes(((rec.data as any[]) ?? []) as Recente[])
      setContas((acc.data as any[]) ?? [])
    })
    carregarWatches()
    carregarAprovacao()
    fetch('/api/autopilot/settings', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => d?.interval_minutes && setIntervalo(d.interval_minutes)).catch(() => {})
    fetch('/api/social/instagram-cookies', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setCookiesIg(!!d?.cookies_file_exists)).catch(() => setCookiesIg(null))
    // abre direto em "Aguardando aprovação" pelo link ?aba=aprovacao
    const a = new URLSearchParams(window.location.search).get('aba')
    if (a === 'aprovacao' || a === 'historico') setAba(a)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function monitorar() {
    if (!canal.trim()) return avisar('erro', 'Cole o link do canal ou do perfil.')
    setSalvando(true)
    try {
      const r = await fetch('/api/autopilot/watches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: canal.trim(), clip_duration: duracao, modo, auto_post: modo === 'auto' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível cadastrar.')
      setCanal('')
      avisar('ok', `Monitorando ${d.watch?.channel_name || 'o perfil'}. Os próximos vídeos novos viram cortes sozinhos.`)
      await Promise.all([carregarWatches(), carregarAprovacao()])
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(w: Watch, campos: { modo?: Modo; is_active?: boolean }) {
    setWatches(ws => ws.map(x => (x.id === w.id ? { ...x, ...campos } : x)))
    const r = await fetch('/api/autopilot/watches', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, ...campos }),
    }).catch(() => null)
    if (!r?.ok) {
      setWatches(ws => ws.map(x => (x.id === w.id ? w : x)))
      avisar('erro', 'Não foi possível salvar essa mudança.')
    } else if (campos.modo) carregarAprovacao()
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
    const r = await fetch('/api/autopilot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval_minutes: v }) }).catch(() => null)
    if (!r?.ok) { setIntervalo(antes); avisar('erro', 'Não foi possível salvar o intervalo.') }
  }

  async function salvarCookies() {
    setSalvandoCookies(true)
    try {
      const r = await fetch('/api/social/instagram-cookies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: cookiesTexto.trim() }) })
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

  async function decidir(ids: string[], acao: 'aprovar' | 'recusar') {
    if (!ids.length) return
    setDecidindo(acao + ids.join())
    try {
      const r = await fetch('/api/autopilot/aprovacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clip_ids: ids, acao }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível concluir.')
      avisar('ok', acao === 'aprovar' ? `${ids.length} corte(s) aprovado(s) e agendado(s) — um a cada 3h, depois da sua fila.` : `${ids.length} corte(s) recusado(s).`)
      setPendentes(p => p.filter(c => !ids.includes(c.id)))
      setSelAprov([])
      carregarAprovacao()
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setDecidindo(null)
    }
  }

  const nomeDoWatch = (id: string | null) => watches.find(w => w.id === id)?.channel_name || ''
  const ABAS: { id: Aba; label: string; icone: typeof Radar; n?: number }[] = [
    { id: 'monitorados', label: 'Contas monitoradas', icone: Radar, n: watches.length },
    { id: 'aprovacao', label: 'Aguardando aprovação', icone: Inbox, n: pendentes.length },
    { id: 'historico', label: 'Histórico', icone: History },
  ]

  return (
    <Pagina icone={Zap} titulo="Autopilot" largura="max-w-4xl"
      direita={<Link href="/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300">Biblioteca</Link>}>
      <Intro selo="Funciona 24/7" titulo="Cortes no piloto automático"
        descricao="Cole um canal do YouTube ou um perfil do Instagram, TikTok ou Facebook. Cada vídeo novo vira cortes no seu template — e você escolhe se eles esperam a sua aprovação ou já vão para a fila." />

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      {/* abas */}
      <div className="flex p-1 bg-white/[0.02] border border-white/[0.08] rounded-2xl gap-1 overflow-x-auto">
        {ABAS.map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`flex-1 min-w-fit py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap ${aba === a.id ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30' : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'}`}>
            <a.icone className="w-3.5 h-3.5" /> {a.label}
            {!!a.n && <span className={`px-1.5 rounded-full text-[10px] ${aba === a.id ? 'bg-white/20' : a.id === 'aprovacao' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.08]'}`}>{a.n}</span>}
          </button>
        ))}
      </div>

      {aba === 'monitorados' && (
        <>
          <Cartao>
            <div className="space-y-2.5">
              <Rotulo direita={<Selo p={plataformaDigitada} />}>Canal ou perfil</Rotulo>
              <Campo icone={Link2} id="autopilot-canal" value={canal} onChange={e => setCanal(e.target.value)} onKeyDown={e => e.key === 'Enter' && !salvando && monitorar()}
                placeholder="youtube.com/@canal, instagram.com/perfil, tiktok.com/@perfil" />
              {precisaCookies && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-100">
                  <Cookie className="w-4 h-4 shrink-0 text-amber-300" />
                  <span className="flex-1">Para acompanhar perfis do Instagram, o servidor precisa de uma conta conectada. É só uma vez.</span>
                  <button type="button" onClick={() => setModalCookies(true)} className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-900 font-semibold">Conectar Instagram</button>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/[0.06]">
              <div className="space-y-2">
                <Rotulo><Send className="w-3.5 h-3.5 text-indigo-400" /> O que fazer com os cortes</Rotulo>
                <Opcoes<Modo> valor={modo} mudar={setModo} opcoes={MODOS} />
                {modo !== 'biblioteca' && contas.length === 0 && (
                  <p className="text-[11px] text-amber-200/90">Nenhuma conta conectada: conecte uma em <Link href="/settings" className="underline">Ajustes</Link> para os cortes irem para a fila.</p>
                )}
              </div>
              <div className="space-y-2">
                <Rotulo direita={
                  <select id="autopilot-intervalo" value={intervalo} onChange={e => salvarIntervalo(Number(e.target.value))} aria-label="Verificar a cada"
                    className="text-[11px] font-mono font-bold text-indigo-300 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 outline-none">
                    {INTERVALOS.map(m => <option key={m} value={m}>verificar a cada {nomeIntervalo(m)}</option>)}
                  </select>
                }><Clock className="w-3.5 h-3.5 text-indigo-400" /> Duração dos cortes</Rotulo>
                <Opcoes valor={duracao} mudar={setDuracao} opcoes={[
                  { id: 'auto', label: '⚡ IA Dinâmico', desc: 'A IA decide' },
                  { id: '30', label: '30s', desc: 'Ultra-rápidos' },
                  { id: '60', label: '60s', desc: 'Padrão' },
                ]} />
              </div>
            </div>

            <BotaoPrincipal icone={Plus} onClick={monitorar} disabled={!canal.trim() || precisaCookies} carregando={salvando} textoCarregando="Lendo o canal…">
              Monitorar
            </BotaoPrincipal>
          </Cartao>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Monitorando ({watches.length})</h3>
            {carregando ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
            ) : watches.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/[0.1] p-8 text-center text-sm text-zinc-500">Nenhum canal ou perfil ainda. Cole um link acima para começar.</div>
            ) : (
              <div className="grid gap-2.5">
                {watches.map(w => {
                  const p = plataformaDoWatch(w)
                  const link = linkDoWatch(w)
                  const m: Modo = w.modo || (w.auto_post ? 'auto' : 'biblioteca')
                  return (
                    <article key={w.id} className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center gap-3 ${w.is_active ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white/[0.01] border-white/[0.05] opacity-70'}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Selo p={p} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{w.channel_name || w.channel_handle || w.channel_id}</span>
                            {link && <a href={link} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white" title="Abrir"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          </div>
                          <p className="text-[11px] text-zinc-500">{PLATAFORMAS[p].nome} · cortes {w.clip_duration === 'auto' ? 'automáticos' : `de ${w.clip_duration}s`} · verificado {quando(w.last_checked_at)}</p>
                          {w.last_error && <p className="text-[11px] text-red-300/90 mt-0.5 line-clamp-1" title={w.last_error}>Última verificação falhou: {w.last_error}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <select id={`modo-${w.id}`} value={m} onChange={e => atualizar(w, { modo: e.target.value as Modo })} aria-label="Destino dos cortes"
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] outline-none">
                          {MODOS.map(x => <option key={x.id} value={x.id}>{NOME_MODO[x.id]}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-zinc-300">Ativo <LiquidToggle checked={w.is_active} onChange={v => atualizar(w, { is_active: v })} /></label>
                        {link && <button type="button" onClick={() => setRaioX(link)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]">Raio-X</button>}
                        <button type="button" onClick={() => remover(w)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10" title="Parar de monitorar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {recentes.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Vídeos novos que viraram cortes</h3>
                <Link href="/dashboard" className="text-xs text-indigo-300 hover:text-indigo-200">Ver na Biblioteca →</Link>
              </div>
              <div className="grid gap-2">
                {recentes.map((r, i) => (
                  <Link key={`${r.project_id}-${i}`} href={r.project_id ? `/project/${r.project_id}` : '/dashboard'}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15]">
                    <Play className="w-4 h-4 text-zinc-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm truncate block">{r.projects?.title || 'Vídeo'}</span>
                      <span className="text-[11px] text-zinc-500">{nomeDoWatch(r.watch_id)} · {quando(r.created_at)}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.projects?.status === 'done' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : r.projects?.status === 'failed' ? 'text-red-300 border-red-500/30 bg-red-500/10' : 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10'}`}>
                      {r.projects?.status === 'done' ? 'Pronto' : r.projects?.status === 'failed' ? 'Falhou' : 'Gerando'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {aba === 'aprovacao' && (
        <Cartao>
          {pendentes.length === 0 ? (
            <div className="text-center space-y-2 py-4">
              <Inbox className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-300">Nada esperando aprovação.</p>
              <p className="text-xs text-zinc-500">
                {monAprovar ? 'Quando sair vídeo novo nos perfis em "Eu aprovo antes", os cortes aparecem aqui.' : 'Coloque um monitoramento em "Eu aprovo antes" para revisar os cortes antes de irem para a fila.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSelAprov(selAprov.length === pendentes.length ? [] : pendentes.map(p => p.id))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08]">
                  {selAprov.length === pendentes.length ? 'Limpar seleção' : `Selecionar todos (${pendentes.length})`}
                </button>
                <div className="ml-auto flex gap-2">
                  <button type="button" disabled={!selAprov.length || !!decidindo} onClick={() => decidir(selAprov, 'recusar')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-40"><Ban className="w-3.5 h-3.5" /> Recusar ({selAprov.length})</button>
                  <button type="button" disabled={!selAprov.length || !!decidindo} onClick={() => decidir(selAprov, 'aprovar')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 flex items-center gap-1.5 disabled:opacity-40"><Check className="w-3.5 h-3.5" /> Aprovar e agendar ({selAprov.length})</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {pendentes.map(c => {
                  const marcado = selAprov.includes(c.id)
                  return (
                    <div key={c.id} className={`rounded-2xl overflow-hidden border bg-black/40 ${marcado ? 'border-indigo-400 ring-1 ring-indigo-400/40' : 'border-white/[0.08]'}`}>
                      <div className="relative aspect-[9/16] bg-white/[0.03]">
                        {c.storage_url && <video src={c.storage_url} controls playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />}
                        <button type="button" aria-label={marcado ? 'Desmarcar' : 'Marcar'} onClick={() => setSelAprov(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}
                          className={`absolute top-2 left-2 w-6 h-6 rounded-md border flex items-center justify-center ${marcado ? 'bg-indigo-500 border-indigo-400' : 'bg-black/60 border-white/30'}`}>
                          {marcado && <Check className="w-3.5 h-3.5" />}
                        </button>
                        {c.score != null && <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-bold">nota {Math.round(c.score)}</span>}
                      </div>
                      <div className="p-2.5 space-y-2">
                        <p className="text-xs font-semibold line-clamp-2">{c.hook || c.title || 'Corte'}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{c.canal} · {quando(c.created_at)}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button type="button" disabled={!!decidindo} onClick={() => decidir([c.id], 'recusar')} className="py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] disabled:opacity-40">Recusar</button>
                          <button type="button" disabled={!!decidindo} onClick={() => decidir([c.id], 'aprovar')} className="py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 disabled:opacity-40">
                            {decidindo === 'aprovar' + c.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Aprovar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-500 text-center">Aprovados entram na fila das suas contas, um a cada 3h, depois do último post já agendado.</p>
            </>
          )}
        </Cartao>
      )}

      {aba === 'historico' && (
        <Cartao>
          {historico.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">As decisões de aprovação aparecem aqui.</p>
          ) : (
            <div className="grid gap-2">
              {historico.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  {c.decisao === 'aprovado' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Ban className="w-4 h-4 text-zinc-500 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{c.hook || c.title || 'Corte'}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{c.canal}{c.decisao === 'aprovado' ? ` · ${c.post_status === 'published' ? 'publicado' : c.post_status === 'failed' ? 'falhou' : 'agendado'} para ${quando(c.agendado_para)}` : ' · recusado'}</p>
                  </div>
                  {c.decisao === 'recusado' && (
                    <button type="button" onClick={() => decidir([c.id], 'aprovar')} disabled={!!decidindo} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] disabled:opacity-40">Aprovar mesmo assim</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link href="/schedule" className="block text-center text-xs text-indigo-300 hover:underline">Ver tudo no Calendário →</Link>
        </Cartao>
      )}

      {raioX && <ModalRaioX perfil={raioX} fechar={() => setRaioX(null)} />}

      {modalCookies && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Conectar Instagram">
          <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Conectar o Instagram ao servidor</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  No computador, entre no Instagram, exporte os cookies com a extensão <b>Get cookies.txt LOCALLY</b> e cole o conteúdo abaixo. Use uma conta secundária: o servidor usa essa sessão só para ver os vídeos dos perfis.
                </p>
              </div>
              <button type="button" onClick={() => setModalCookies(false)} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <textarea id="autopilot-cookies" value={cookiesTexto} onChange={e => setCookiesTexto(e.target.value)} rows={7}
              placeholder="# Netscape HTTP Cookie File&#10;.instagram.com	TRUE	/	TRUE	..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-[11px] font-mono outline-none focus:border-indigo-500" />
            <BotaoPrincipal icone={Check} onClick={salvarCookies} disabled={!cookiesTexto.trim()} carregando={salvandoCookies} textoCarregando="Salvando…">Salvar</BotaoPrincipal>
          </div>
        </div>
      )}
    </Pagina>
  )
}
