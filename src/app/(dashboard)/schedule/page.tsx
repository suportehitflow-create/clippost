'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import EditorLegenda from '@/components/ferramentas/EditorLegenda'
import { FUSOS, gerarLegendasIA, horarioLocal, juntarLegenda, LIMITE_DIARIO, MELHORES_HORARIOS, NOME_REDE } from '@/lib/publicacao'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Loader2, X, Send, Trash2, Clock, CheckCircle2, AlertCircle, Layers, Activity, Film, ExternalLink, Sparkles,
} from 'lucide-react'

// Calendário & Publicações (baseado no Agendador do usuário): calendário do mês com o ciclo de cada
// publicação, agendamento em massa distribuído por dias da semana e horários, e atividade.
// Publicação real: backend (workers/scheduler_tasks.py) publica o que venceu em scheduled_posts.

type Status = 'scheduled' | 'published' | 'failed'
type Aba = 'calendario' | 'massa' | 'atividade'

// is_active vem do seletor de perfil (localStorage), não do banco
interface Conta { id: string; platform: string; username: string | null; is_active: boolean }
interface Corte { id: string; title: string | null; hook: string | null; storage_url: string | null; score: number | null; created_at: string }
interface Post {
  id: string
  clip_id: string
  platform: string
  caption: string | null
  scheduled_at: string
  status: Status
  social_account_id: string | null
  clips?: { title: string | null; storage_url: string | null } | null
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const STATUS: Record<Status, { nome: string; cor: string; fundo: string }> = {
  scheduled: { nome: 'Agendado', cor: '#f59e0b', fundo: 'rgba(245,158,11,0.14)' },
  published: { nome: 'Publicado', cor: '#10b981', fundo: 'rgba(16,185,129,0.14)' },
  failed: { nome: 'Falhou', cor: '#ef4444', fundo: 'rgba(239,68,68,0.14)' },
}
const PLAT = NOME_REDE

const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataHora = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const paraInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const plataformaPost = (p: string) => (p === 'youtube' ? 'youtube_shorts' : p)

function gradeDoMes(base: Date) {
  const primeiro = new Date(base.getFullYear(), base.getMonth(), 1)
  const inicio = new Date(primeiro)
  inicio.setDate(1 - primeiro.getDay())
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
}

/** Horários da grade dia-da-semana × horário a partir da data de início (hora local), só no futuro */
function calcularHorarios(dias: number[], horarios: string[], inicio: string, quantidade: number): Date[] {
  const [y, m, d] = inicio.split('-').map(Number)
  const hs = [...horarios].map(t => t.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const saida: Date[] = []
  for (let k = 0; saida.length < quantidade && k < 3650; k++) {
    const dia = new Date(y, m - 1, d + k)
    if (!dias.includes(dia.getDay())) continue
    for (const [h, mi] of hs) {
      const t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, mi)
      if (t.getTime() > Date.now() && saida.length < quantidade) saida.push(t)
    }
  }
  return saida
}

function nomeConta(c?: Conta | null) {
  if (!c) return 'conta padrão'
  return c.username ? `@${c.username.replace(/^@/, '')}` : PLAT[c.platform] || c.platform
}

/** Conta escolhida no seletor de perfil do topo */
function contaAtivaSalva(): string | null {
  try {
    return JSON.parse(localStorage.getItem('clippost_active_account') || 'null')?.id ?? null
  } catch {
    return null
  }
}

function Selo({ status }: { status: Status }) {
  const s = STATUS[status] ?? STATUS.scheduled
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.cor, background: s.fundo }}>
      {s.nome}
    </span>
  )
}

const pilula = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${on ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'}`

function Conteudo() {
  const supabase = createClient()
  const params = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('calendario')
  const [contas, setContas] = useState<Conta[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // calendário
  const [mes, setMes] = useState(() => new Date())
  const [diaSel, setDiaSel] = useState(() => new Date())
  const [detalhe, setDetalhe] = useState<Post | null>(null)
  const [novoNoDia, setNovoNoDia] = useState<Date | null>(null)

  // massa
  const [selCortes, setSelCortes] = useState<string[]>([])
  const [selContas, setSelContas] = useState<string[]>([])
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [horarios, setHorarios] = useState<string[]>(['09:00', '12:00', '18:00', '21:00'])
  const [novoHorario, setNovoHorario] = useState('')
  const [inicio, setInicio] = useState(() => paraInput(new Date()).slice(0, 10))
  const [legendaModo, setLegendaModo] = useState<'corte' | 'comum' | 'ia'>('corte')
  const [legendaComum, setLegendaComum] = useState('')
  const [tomIA, setTomIA] = useState('viral')
  const [agendando, setAgendando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [fusoPublico, setFusoPublico] = useState('America/Sao_Paulo')

  // atividade
  const [filtro, setFiltro] = useState<'todos' | Status>('todos')

  function avisar(tipo: 'ok' | 'erro', texto: string) {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 6000)
  }

  async function carregar(uid: string) {
    // contas conectadas pelo Upload-Post (a conexão volta para esta página) entram na lista
    await fetch('/api/social/sync', { method: 'POST' }).catch(() => null)
    const [c, k, p] = await Promise.all([
      supabase.from('social_accounts').select('id, platform, username').eq('user_id', uid),
      supabase.from('clips').select('id, title, hook, storage_url, score, created_at').eq('user_id', uid).not('storage_url', 'is', null).order('created_at', { ascending: false }).limit(120),
      supabase.from('scheduled_posts').select('id, clip_id, platform, caption, scheduled_at, status, social_account_id, clips(title, storage_url)').eq('user_id', uid).order('scheduled_at', { ascending: true }).limit(1000),
    ])
    const ativa = contaAtivaSalva()
    const cs = (((c.data as any[]) ?? []).map(x => ({ ...x, is_active: x.id === ativa })) as Conta[])
    setContas(cs)
    setSelContas(s => (s.length ? s : cs.filter(x => x.is_active).map(x => x.id).concat(cs.some(x => x.is_active) ? [] : cs.map(x => x.id))))
    setCortes((k.data as Corte[]) ?? [])
    setPosts(((p.data as any[]) ?? []) as Post[])
    setCarregando(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return
      setUserId(data.user.id)
      carregar(data.user.id)
    })
    const clip = params.get('clipId')
    if (clip) {
      setAba('massa')
      setSelCortes([clip])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contaPorId = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas])
  const agora = Date.now()
  const stats = useMemo(() => {
    const pub = posts.filter(p => p.status === 'published').length
    const fal = posts.filter(p => p.status === 'failed').length
    return {
      agendados: posts.filter(p => p.status === 'scheduled').length,
      publicados: pub,
      falhas: fal,
      taxa: pub + fal ? Math.round((pub / (pub + fal)) * 100) : null,
      proximos: posts.filter(p => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() >= agora - 60000).slice(0, 4),
    }
  }, [posts, agora])

  // ------------------------- ações -------------------------
  async function inserir(linhas: { clip_id: string; caption: string; scheduled_at: string; conta: Conta | null }[]) {
    if (!userId) return 0
    const registros = linhas.map(l => ({
      user_id: userId,
      clip_id: l.clip_id,
      platform: plataformaPost(l.conta?.platform || 'instagram'),
      social_account_id: l.conta?.id ?? null,
      caption: l.caption,
      scheduled_at: l.scheduled_at,
      status: 'scheduled',
    }))
    let total = 0
    for (let i = 0; i < registros.length; i += 200) {
      const { error } = await supabase.from('scheduled_posts').insert(registros.slice(i, i + 200))
      if (error) throw new Error(error.message)
      total += Math.min(200, registros.length - i)
    }
    return total
  }

  async function agendarEmMassa() {
    const escolhidos = selCortes.map(id => cortes.find(c => c.id === id)).filter(Boolean) as Corte[]
    if (!escolhidos.length) return avisar('erro', 'Escolha os cortes que vão ser publicados.')
    if (!dias.length || !horarios.length) return avisar('erro', 'Escolha pelo menos um dia e um horário.')
    const destino = selContas.map(id => contaPorId.get(id)).filter(Boolean) as Conta[]
    if (!destino.length && contas.length) return avisar('erro', 'Escolha em quais contas publicar.')
    const slots = calcularHorarios(dias, horarios, inicio, escolhidos.length)
    if (slots.length < escolhidos.length) return avisar('erro', 'Não há horários suficientes a partir dessa data.')
    setAgendando(true)
    try {
      // "IA para cada corte": uma legenda com hashtags por corte (2 por vez; se falhar, usa o título)
      const legendas = new Map<string, string>()
      if (legendaModo === 'ia') {
        const rede = redesSelecionadas.includes('instagram') ? 'instagram' : redesSelecionadas[0] ?? 'instagram'
        let feitos = 0
        const fila = [...escolhidos]
        const trabalhar = async () => {
          for (let c = fila.shift(); c; c = fila.shift()) {
            try {
              const [o] = await gerarLegendasIA({ clipId: c.id, titulo: c.hook || c.title || '', plataforma: rede, tom: tomIA })
              if (o) legendas.set(c.id, juntarLegenda(o, rede))
            } catch {
              // fica o título do corte
            }
            setProgresso(`Escrevendo legendas com IA… ${++feitos}/${escolhidos.length}`)
          }
        }
        await Promise.all([trabalhar(), trabalhar()])
        setProgresso('')
      }
      const linhas = escolhidos.flatMap((c, i) =>
        (destino.length ? destino : [null]).map(conta => ({
          clip_id: c.id,
          caption: legendaModo === 'comum' ? legendaComum : legendas.get(c.id) ?? (c.hook || c.title || ''),
          scheduled_at: slots[i].toISOString(),
          conta,
        })),
      )
      const n = await inserir(linhas)
      avisar('ok', `${n} publicações agendadas (${dataHora(slots[0])} → ${dataHora(slots[slots.length - 1])}).`)
      setSelCortes([])
      setAba('calendario')
      setMes(slots[0])
      setDiaSel(slots[0])
      if (userId) await carregar(userId)
    } catch (e: any) {
      avisar('erro', `Não foi possível agendar: ${e.message}`)
    } finally {
      setAgendando(false)
      setProgresso('')
    }
  }

  function usarMelhoresHorarios() {
    const redes = redesSelecionadas.length ? redesSelecionadas : ['instagram']
    const todos = redes.flatMap(r => MELHORES_HORARIOS[r] ?? MELHORES_HORARIOS.instagram).map(h => horarioLocal(h, fusoPublico))
    setHorarios([...new Set(todos)].sort())
  }

  async function salvarDetalhe(p: Post, campos: Partial<Post>) {
    const { error } = await supabase.from('scheduled_posts').update(campos).eq('id', p.id)
    if (error) return avisar('erro', error.message)
    setPosts(ps => ps.map(x => (x.id === p.id ? { ...x, ...campos } : x)))
    setDetalhe(null)
    avisar('ok', campos.status === 'scheduled' && campos.scheduled_at && new Date(campos.scheduled_at).getTime() <= Date.now() + 60000 ? 'Enviado para publicação: sai no próximo minuto.' : 'Publicação atualizada.')
  }

  async function excluir(p: Post) {
    if (!window.confirm('Excluir esta publicação?')) return
    const { error } = await supabase.from('scheduled_posts').delete().eq('id', p.id)
    if (error) return avisar('erro', error.message)
    setPosts(ps => ps.filter(x => x.id !== p.id))
    setDetalhe(null)
  }

  // ------------------------- UI -------------------------
  const grade = gradeDoMes(mes)
  const doDia = posts.filter(p => mesmoDia(new Date(p.scheduled_at), diaSel))
  const previa = calcularHorarios(dias, horarios, inicio, Math.max(1, selCortes.length))
  const redesSelecionadas = [...new Set(selContas.map(id => contaPorId.get(id)).filter(Boolean).map(c => plataformaPost((c as Conta).platform)))]

  // Limite diário da API por conta: posts já agendados naquele dia + os deste lote
  const avisosLimite = (() => {
    if (!selCortes.length) return [] as string[]
    const chave = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const novosPorDia = new Map<string, { n: number; d: Date }>()
    previa.slice(0, selCortes.length).forEach(d => {
      const k = chave(d)
      novosPorDia.set(k, { n: (novosPorDia.get(k)?.n ?? 0) + 1, d })
    })
    const avisos: string[] = []
    for (const id of selContas) {
      const c = contaPorId.get(id)
      const lim = c && LIMITE_DIARIO[plataformaPost(c.platform)]
      if (!c || !lim) continue
      for (const [k, { n, d }] of novosPorDia) {
        const existentes = posts.filter(p => p.social_account_id === id && p.status === 'scheduled' && chave(new Date(p.scheduled_at)) === k).length
        if (existentes + n > lim.n) {
          avisos.push(`${nomeConta(c)} teria ${existentes + n} posts em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${lim.fonte}.`)
        }
      }
    }
    return avisos
  })()
  const atividade = [...posts].reverse().filter(p => filtro === 'todos' || p.status === filtro)

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h1 className="text-sm font-semibold tracking-wide">Calendário & Publicações</h1>
        </div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <div className="flex justify-end">
          <button type="button" onClick={() => setNovoNoDia(new Date())} className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-xs font-semibold flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Agendar
          </button>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* resumo */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { r: 'Agendados', v: stats.agendados, c: '#f59e0b' },
            { r: 'Publicados', v: stats.publicados, c: '#10b981' },
            { r: 'Falharam', v: stats.falhas, c: '#ef4444' },
            { r: 'Taxa de sucesso', v: stats.taxa === null ? '—' : `${stats.taxa}%`, c: '#a5b4fc' },
          ].map(x => (
            <div key={x.r} className="rounded-2xl bg-white/[0.02] border border-white/[0.07] px-4 py-3">
              <span className="text-[11px] text-zinc-500">{x.r}</span>
              <p className="text-2xl font-bold tabular-nums" style={{ color: x.c }}>{x.v}</p>
            </div>
          ))}
        </section>

        {contas.length === 0 && !carregando && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-100">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
            <span className="flex-1">Nenhuma conta conectada: dá para montar o calendário, mas para publicar de verdade conecte o Instagram, TikTok ou YouTube.</span>
            <Link href="/settings" className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-900 font-semibold">Conectar conta</Link>
          </div>
        )}

        {aviso && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-2xl border text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-red-500/10 border-red-500/25 text-red-200'}`}>
            {aviso.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {aviso.texto}
          </div>
        )}

        {/* abas */}
        <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.08] rounded-xl w-fit" role="tablist">
          {([
            { id: 'calendario', l: 'Calendário', i: Calendar },
            { id: 'massa', l: 'Agendar em massa', i: Layers },
            { id: 'atividade', l: 'Atividade', i: Activity },
          ] as const).map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)}
              className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${aba === t.id ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
              <t.i className="w-3.5 h-3.5" /> {t.l}
            </button>
          ))}
        </div>

        {carregando && <div className="flex items-center gap-2 text-xs text-zinc-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>}

        {/* ---------------- CALENDÁRIO ---------------- */}
        {!carregando && aba === 'calendario' && (
          <section className="grid lg:grid-cols-[1fr_320px] gap-5">
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{MESES[mes.getMonth()]} {mes.getFullYear()}</h2>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08]" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" onClick={() => { setMes(new Date()); setDiaSel(new Date()) }} className="px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold">Hoje</button>
                  <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08]" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-zinc-400">
                {(Object.keys(STATUS) as Status[]).map(s => (
                  <span key={s} className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: STATUS[s].cor }} />{STATUS[s].nome}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DIAS.map(d => <div key={d} className="text-[10px] font-semibold uppercase text-zinc-500 text-center py-1">{d}</div>)}
                {grade.map(d => {
                  const ev = posts.filter(p => mesmoDia(new Date(p.scheduled_at), d))
                  const fora = d.getMonth() !== mes.getMonth()
                  const sel = mesmoDia(d, diaSel)
                  return (
                    <button key={d.toISOString()} type="button" onClick={() => setDiaSel(d)}
                      className={`min-h-[76px] rounded-xl p-1.5 text-left flex flex-col gap-0.5 border transition-colors ${sel ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-white/[0.05] hover:border-white/[0.15]'} ${fora ? 'opacity-40' : ''}`}>
                      <span className={`text-[11px] font-semibold tabular-nums ${mesmoDia(d, new Date()) ? 'text-indigo-300' : 'text-zinc-300'}`}>{d.getDate()}</span>
                      {ev.slice(0, 3).map(p => (
                        <span key={p.id} className="text-[9px] leading-tight truncate rounded px-1 py-0.5" style={{ color: STATUS[p.status]?.cor, background: STATUS[p.status]?.fundo }}>
                          {hm(new Date(p.scheduled_at))} {PLAT[p.platform] ?? p.platform}
                        </span>
                      ))}
                      {ev.length > 3 && <span className="text-[9px] text-zinc-500">+{ev.length - 3}</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{diaSel.getDate()} de {MESES[diaSel.getMonth()].toLowerCase()}</h3>
                  <button type="button" onClick={() => setNovoNoDia(diaSel)} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agendar</button>
                </div>
                {doDia.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Nada neste dia.</p>
                ) : (
                  doDia.map(p => <LinhaPost key={p.id} p={p} conta={contaPorId.get(p.social_account_id ?? '')} abrir={() => setDetalhe(p)} />)
                )}
              </div>
              <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Clock className="w-4 h-4 text-zinc-500" /> Próximas publicações</h3>
                {stats.proximos.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma agendada.</p> : stats.proximos.map(p => (
                  <LinhaPost key={p.id} p={p} conta={contaPorId.get(p.social_account_id ?? '')} abrir={() => setDetalhe(p)} comData />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- EM MASSA ---------------- */}
        {!carregando && aba === 'massa' && (
          <section className="grid lg:grid-cols-[1fr_340px] gap-5">
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">1. Cortes da Biblioteca <span className="text-zinc-500 font-normal">· {selCortes.length} escolhidos</span></h3>
                <div className="flex gap-1.5">
                  <button type="button" className={pilula(false)} onClick={() => setSelCortes(cortes.map(c => c.id))}>Todos</button>
                  <button type="button" className={pilula(false)} onClick={() => setSelCortes([])}>Nenhum</button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">A ordem de escolha é a ordem de publicação.</p>
              {cortes.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">Nenhum corte pronto ainda. <Link href="/upload" className="underline">Crie cortes</Link> ou exporte na <Link href="/bulk" className="underline">Edição em Massa</Link>.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-[560px] overflow-y-auto pr-1">
                  {cortes.map(c => {
                    const ordem = selCortes.indexOf(c.id)
                    return (
                      <button key={c.id} type="button" onClick={() => setSelCortes(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}
                        className={`relative rounded-xl overflow-hidden border text-left ${ordem >= 0 ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-white/[0.06] hover:border-white/[0.2]'}`}>
                        <div className="aspect-[9/16] bg-black">
                          {c.storage_url && <video src={`${c.storage_url}#t=1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />}
                        </div>
                        <span className="absolute bottom-0 inset-x-0 p-1.5 text-[10px] leading-tight bg-gradient-to-t from-black/90 to-transparent line-clamp-2">{c.hook || c.title || 'Corte'}</span>
                        {ordem >= 0 && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-500 text-[10px] font-bold flex items-center justify-center tabular-nums">{ordem + 1}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold">2. Onde publicar</h3>
                {contas.length === 0 ? (
                  <p className="text-xs text-zinc-500">Sem contas conectadas: os posts ficam no calendário e publicam quando você conectar. <Link href="/settings" className="underline">Conectar</Link></p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {contas.map(c => (
                      <button key={c.id} type="button" className={pilula(selContas.includes(c.id))} onClick={() => setSelContas(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}>
                        {nomeConta(c)} <span className="opacity-60">· {PLAT[c.platform] ?? c.platform}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-3">
                <h3 className="text-sm font-semibold">3. Agenda</h3>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-zinc-500">Dias da semana</span>
                  <div className="flex flex-wrap gap-1">
                    {DIAS.map((d, i) => (
                      <button key={d} type="button" className={pilula(dias.includes(i))} onClick={() => setDias(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]))}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">Horários (no seu relógio)</span>
                    <div className="flex items-center gap-1.5">
                      <select id="massa-fuso" value={fusoPublico} onChange={e => setFusoPublico(e.target.value)} className="px-2 py-1 rounded-lg bg-black/40 border border-white/[0.1] text-[11px]" aria-label="Fuso do público">
                        {FUSOS.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                      <button type="button" onClick={usarMelhoresHorarios} className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-200 flex items-center gap-1" title="Horários de pico gerais de cada rede, no fuso do seu público">
                        <Sparkles className="w-3 h-3" /> Melhores horários
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {horarios.map(h => (
                      <span key={h} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-zinc-900 flex items-center gap-1 tabular-nums">
                        {h}
                        <button type="button" onClick={() => setHorarios(s => s.filter(x => x !== h))} aria-label={`Tirar ${h}`}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    <input id="massa-horario" type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="px-2 py-1 rounded-lg bg-black/40 border border-white/[0.1] text-xs" />
                    <button type="button" className={pilula(false)} onClick={() => { if (novoHorario && !horarios.includes(novoHorario)) setHorarios(s => [...s, novoHorario].sort()); setNovoHorario('') }}>+</button>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-zinc-500">A partir de</span>
                  <input id="massa-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
                </label>
              </div>

              <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold">4. Legenda</h3>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={pilula(legendaModo === 'ia')} onClick={() => setLegendaModo('ia')}>✨ IA para cada corte</button>
                  <button type="button" className={pilula(legendaModo === 'corte')} onClick={() => setLegendaModo('corte')}>Título de cada corte</button>
                  <button type="button" className={pilula(legendaModo === 'comum')} onClick={() => setLegendaModo('comum')}>Mesma para todos</button>
                </div>
                {legendaModo === 'ia' && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    Tom:
                    <select id="massa-tom" value={tomIA} onChange={e => setTomIA(e.target.value)} className="px-2 py-1 rounded-lg bg-black/40 border border-white/[0.1] text-[11px]">
                      <option value="viral">Viral</option>
                      <option value="engracado">Engraçado</option>
                      <option value="informativo">Informativo</option>
                      <option value="polemico">Polêmico</option>
                    </select>
                    <span>legenda + hashtags a partir do que é falado em cada corte</span>
                  </div>
                )}
                {legendaModo === 'comum' && (
                  <EditorLegenda id="massa-legenda" valor={legendaComum} mudar={setLegendaComum} plataformas={redesSelecionadas} titulo={legendaComum} linhas={4} />
                )}
              </div>

              <div className="rounded-3xl bg-indigo-500/[0.07] border border-indigo-500/25 p-4 space-y-3">
                <p className="text-xs text-zinc-300">
                  {selCortes.length
                    ? <>{selCortes.length} corte(s) × {Math.max(1, selContas.length)} conta(s) = <b>{selCortes.length * Math.max(1, selContas.length)} publicações</b>{previa.length ? <>, de {dataHora(previa[0])} até {dataHora(previa[previa.length - 1])}.</> : '.'}</>
                    : 'Escolha os cortes para ver a prévia da agenda.'}
                </p>
                {avisosLimite.length > 0 && (
                  <div className="space-y-1 rounded-xl bg-amber-500/10 border border-amber-500/25 p-2.5">
                    <p className="text-[11px] font-semibold text-amber-200 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Passa do limite diário</p>
                    {avisosLimite.slice(0, 4).map(a => <p key={a} className="text-[11px] text-amber-100/90">{a}</p>)}
                    <p className="text-[10px] text-amber-100/70">Os posts acima do limite costumam falhar. Tire horários ou comece em outra data.</p>
                  </div>
                )}
                <button type="button" onClick={agendarEmMassa} disabled={agendando || !selCortes.length}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {agendando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {progresso || 'Agendar'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- ATIVIDADE ---------------- */}
        {!carregando && aba === 'atividade' && (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(['todos', 'scheduled', 'published', 'failed'] as const).map(f => (
                <button key={f} type="button" className={pilula(filtro === f)} onClick={() => setFiltro(f)}>
                  {f === 'todos' ? 'Todos' : STATUS[f].nome}
                </button>
              ))}
            </div>
            {atividade.length === 0 ? (
              <p className="text-xs text-zinc-500 py-10 text-center">Nada por aqui.</p>
            ) : (
              <div className="grid gap-2">
                {atividade.slice(0, 200).map(p => <LinhaPost key={p.id} p={p} conta={contaPorId.get(p.social_account_id ?? '')} abrir={() => setDetalhe(p)} comData comLegenda />)}
              </div>
            )}
          </section>
        )}
      </div>

      {detalhe && (
        <DetalhePost p={detalhe} conta={contaPorId.get(detalhe.social_account_id ?? '')} fechar={() => setDetalhe(null)} salvar={c => salvarDetalhe(detalhe, c)} excluir={() => excluir(detalhe)} />
      )}
      {novoNoDia && (
        <NovoPost
          dia={novoNoDia}
          cortes={cortes}
          contas={contas}
          fechar={() => setNovoNoDia(null)}
          agendar={async (clipId, contasIds, legenda, quando) => {
            const destino = contasIds.map(id => contaPorId.get(id)).filter(Boolean) as Conta[]
            const n = await inserir((destino.length ? destino : [null]).map(conta => ({ clip_id: clipId, caption: legenda, scheduled_at: quando.toISOString(), conta })))
            setNovoNoDia(null)
            avisar('ok', `${n} publicação(ões) agendada(s) para ${dataHora(quando)}.`)
            if (userId) await carregar(userId)
          }}
        />
      )}
    </div>
  )
}

function LinhaPost({ p, conta, abrir, comData, comLegenda }: { p: Post; conta?: Conta; abrir: () => void; comData?: boolean; comLegenda?: boolean }) {
  const d = new Date(p.scheduled_at)
  return (
    <button type="button" onClick={abrir} className="w-full flex items-center gap-3 p-2 rounded-2xl bg-black/20 border border-white/[0.05] hover:border-white/[0.15] text-left">
      <div className="w-9 h-14 rounded-lg bg-black overflow-hidden shrink-0">
        {p.clips?.storage_url ? <video src={`${p.clips.storage_url}#t=1`} preload="metadata" muted playsInline className="w-full h-full object-cover" /> : <Film className="w-4 h-4 m-auto mt-5 text-zinc-600" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums">{comData ? dataHora(d) : hm(d)}</span>
          <Selo status={p.status} />
        </div>
        <p className="text-[11px] text-zinc-500 truncate">{nomeConta(conta)} · {PLAT[p.platform] ?? p.platform}</p>
        {comLegenda && <p className="text-[11px] text-zinc-400 truncate">{p.caption || p.clips?.title}</p>}
      </div>
    </button>
  )
}

function DetalhePost({ p, conta, fechar, salvar, excluir }: { p: Post; conta?: Conta; fechar: () => void; salvar: (c: Partial<Post>) => void; excluir: () => void }) {
  const [legenda, setLegenda] = useState(p.caption ?? '')
  const [quando, setQuando] = useState(paraInput(new Date(p.scheduled_at)))
  const editavel = p.status !== 'published'
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Publicação">
      <div className="w-full max-w-2xl bg-[#111114] border border-white/[0.1] rounded-3xl p-5 grid sm:grid-cols-[180px_1fr] gap-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-black">
          {p.clips?.storage_url && <video src={p.clips.storage_url} controls playsInline className="w-full h-full object-cover" />}
        </div>
        <div className="space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">Publicação <Selo status={p.status} /></h3>
              <p className="text-xs text-zinc-500">{nomeConta(conta)} · {PLAT[p.platform] ?? p.platform} · {dataHora(new Date(p.scheduled_at))}</p>
            </div>
            <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
          </div>
          {p.status === 'failed' && (
            <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
              A publicação falhou. Confira se a conta continua conectada em Ajustes e tente de novo.
            </p>
          )}
          {p.clips?.storage_url && (
            <a href={p.clips.storage_url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 inline-flex items-center gap-1">Abrir vídeo <ExternalLink className="w-3 h-3" /></a>
          )}
          {editavel ? (
            <>
              <EditorLegenda id="detalhe-legenda" valor={legenda} mudar={setLegenda} plataformas={[p.platform]} clipId={p.clip_id} titulo={p.clips?.title ?? undefined} />
              <label className="block space-y-1">
                <span className="text-[11px] text-zinc-500">Data e hora</span>
                <input id="detalhe-quando" type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => salvar({ caption: legenda, scheduled_at: new Date(quando).toISOString(), status: 'scheduled' })} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-xs font-semibold">
                  {p.status === 'failed' ? 'Salvar e tentar de novo' : 'Salvar'}
                </button>
                <button type="button" onClick={() => salvar({ caption: legenda, scheduled_at: new Date().toISOString(), status: 'scheduled' })} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-semibold flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Publicar agora
                </button>
                <button type="button" onClick={excluir} className="px-3 py-2 rounded-xl text-xs font-semibold text-red-300 hover:bg-red-500/10 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{p.caption}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function NovoPost({ dia, cortes, contas, fechar, agendar }: {
  dia: Date
  cortes: Corte[]
  contas: Conta[]
  fechar: () => void
  agendar: (clipId: string, contas: string[], legenda: string, quando: Date) => Promise<void>
}) {
  const inicial = new Date(dia)
  inicial.setHours(18, 0, 0, 0)
  if (inicial.getTime() < Date.now()) inicial.setTime(Date.now() + 15 * 60000)
  const [clip, setClip] = useState(cortes[0]?.id ?? '')
  const [sel, setSel] = useState<string[]>(contas.filter(c => c.is_active).map(c => c.id))
  const [legenda, setLegenda] = useState(cortes[0]?.hook || cortes[0]?.title || '')
  const [quando, setQuando] = useState(paraInput(inicial))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Novo agendamento">
      <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-5 space-y-3 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Novo agendamento</h3>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {cortes.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum corte pronto. <Link href="/upload" className="underline">Crie cortes primeiro</Link>.</p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-500">Corte</span>
              <select id="novo-corte" value={clip} onChange={e => { setClip(e.target.value); const c = cortes.find(x => x.id === e.target.value); setLegenda(c?.hook || c?.title || '') }} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm">
                {cortes.map(c => <option key={c.id} value={c.id}>{(c.hook || c.title || 'Corte').slice(0, 80)}</option>)}
              </select>
            </label>
            {contas.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-zinc-500">Contas</span>
                <div className="flex flex-wrap gap-1.5">
                  {contas.map(c => (
                    <button key={c.id} type="button" className={pilula(sel.includes(c.id))} onClick={() => setSel(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}>
                      {nomeConta(c)} <span className="opacity-60">· {PLAT[c.platform] ?? c.platform}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <EditorLegenda
              id="novo-legenda"
              valor={legenda}
              mudar={setLegenda}
              plataformas={contas.filter(c => sel.includes(c.id)).map(c => plataformaPost(c.platform))}
              clipId={clip || undefined}
              linhas={4}
            />
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-500">Data e hora</span>
              <input id="novo-quando" type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
            </label>
            {erro && <p className="text-xs text-red-300">{erro}</p>}
            <button type="button" disabled={salvando || !clip}
              onClick={async () => {
                const d = new Date(quando)
                if (d.getTime() < Date.now() - 60000) return setErro('Escolha um horário no futuro.')
                setSalvando(true)
                try { await agendar(clip, sel, legenda, d) } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Agendar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-zinc-500 min-h-screen">Carregando…</div>}>
      <Conteudo />
    </Suspense>
  )
}
