'use client'

import { useEffect, useState } from 'react'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { createClient } from '@/lib/supabase/client'
import { ModalInstagramOficial, useInstagramOficial } from '@/components/bulk/InstagramOficial'
import {
  Activity, Loader2, Eye, Heart, MessageCircle, Share2, Film, TrendingUp, Clock, Trophy, AlertCircle, ExternalLink, Search,
} from 'lucide-react'

// Raio-X da página: painel de desempenho de uma conta (a sua ou qualquer @) no período escolhido —
// números, melhor horário, formato campeão, gráficos por dia, mapa de calor e top posts.

type Tipo = 'reel' | 'post' | 'carrossel'
interface Post {
  id: string; tipo: Tipo; thumbnail: string | null; permalink: string | null; legenda: string
  views: number | null; likes: number | null; comentarios: number | null; timestamp: number | null; engajamento: number | null
}
interface Painel {
  perfil: { usuario: string; nome?: string | null; foto?: string | null; seguidores?: number | null; url: string }
  plataforma: string
  fonte: 'api_oficial' | 'servidor'
  dias: number
  totais: { views: number | null; posts: number; engajamento: number | null; likes: number; comentarios: number; compartilhamentos: number | null }
  melhor_horario: { dia: string; hora: number; ganho_pct: number; posts: number } | null
  formato_campeao: { tipo: Tipo; media: number; metrica: 'views' | 'curtidas' } | null
  por_dia: { data: string; likes: number; comentarios: number; views: number; posts: number }[]
  mapa: (number | null)[][]
  top_posts: Post[]
  seguidores: { data: string; n: number }[]
}
interface Conta { id: string; platform: string; username: string }

const PERIODOS = [7, 30, 90, 180]
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOME_TIPO: Record<Tipo, string> = { reel: 'Reels', post: 'Posts de foto', carrossel: 'Carrosséis' }
const REDE: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', youtube_shorts: 'YouTube', facebook: 'Facebook' }

const num = (n: number | null | undefined) => (n == null ? '—' : Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n))
const diaCurto = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }

function perfilDaConta(c: Conta) {
  const u = c.username.replace(/^@/, '')
  if (c.platform === 'tiktok') return `tiktok.com/@${u}`
  if (c.platform.startsWith('youtube')) return `youtube.com/@${u}`
  if (c.platform === 'facebook') return `facebook.com/${u}`
  return u
}

// ---------- gráficos (SVG simples, sem biblioteca) ----------

function Barras({ dados, series, altura = 150 }: {
  dados: { rotulo: string; valores: number[] }[]
  series: { nome: string; cor: string }[]
  altura?: number
}) {
  const max = Math.max(1, ...dados.map(d => d.valores.reduce((a, b) => a + b, 0)))
  const L = 640, E = 36, B = 20
  const w = (L - E) / Math.max(1, dados.length)
  const passo = Math.ceil(dados.length / 8)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${L} ${altura + B}`} className="w-full min-w-[420px]" role="img">
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line x1={E} x2={L} y1={altura - f * (altura - 8)} y2={altura - f * (altura - 8)} stroke="currentColor" className="text-white/[0.06]" />
              <text x={E - 6} y={altura - f * (altura - 8) + 3} textAnchor="end" fontSize="9" fill="currentColor" className="text-zinc-500">{num(max * f)}</text>
            </g>
          ))}
          {dados.map((d, i) => {
            let y = altura
            return (
              <g key={d.rotulo}>
                {d.valores.map((v, s) => {
                  const h = (v / max) * (altura - 8)
                  y -= h
                  return <rect key={s} x={E + i * w + w * 0.15} y={y} width={Math.max(1, w * 0.7)} height={h} rx={1.5} fill={series[s].cor}><title>{`${d.rotulo} · ${series[s].nome}: ${v.toLocaleString('pt-BR')}`}</title></rect>
                })}
                {i % passo === 0 && <text x={E + i * w + w / 2} y={altura + 14} textAnchor="middle" fontSize="9" fill="currentColor" className="text-zinc-500">{d.rotulo}</text>}
              </g>
            )
          })}
        </svg>
      </div>
      {series.length > 1 && (
        <div className="flex gap-4 text-[11px] text-zinc-400">
          {series.map(s => <span key={s.nome} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: s.cor }} />{s.nome}</span>)}
        </div>
      )}
    </div>
  )
}

function Linha({ pontos, altura = 150 }: { pontos: { rotulo: string; v: number }[]; altura?: number }) {
  const L = 640, E = 44, B = 20
  const min = Math.min(...pontos.map(p => p.v)), max = Math.max(...pontos.map(p => p.v))
  const faixa = max - min || 1
  const x = (i: number) => E + (pontos.length === 1 ? (L - E) / 2 : (i / (pontos.length - 1)) * (L - E - 8))
  const y = (v: number) => altura - 8 - ((v - min) / faixa) * (altura - 24)
  const passo = Math.ceil(pontos.length / 8)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${L} ${altura + B}`} className="w-full min-w-[420px]" role="img">
        {[min, max].map((v, k) => (
          <g key={k}>
            <line x1={E} x2={L} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-white/[0.06]" />
            <text x={E - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" className="text-zinc-500">{num(v)}</text>
          </g>
        ))}
        <polyline fill="none" stroke="#818cf8" strokeWidth={2} points={pontos.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
        {pontos.map((p, i) => (
          <g key={p.rotulo}>
            <circle cx={x(i)} cy={y(p.v)} r={3} fill="#a5b4fc"><title>{`${p.rotulo}: ${p.v.toLocaleString('pt-BR')} seguidores`}</title></circle>
            {i % passo === 0 && <text x={x(i)} y={altura + 14} textAnchor="middle" fontSize="9" fill="currentColor" className="text-zinc-500">{p.rotulo}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}

function MapaCalor({ mapa }: { mapa: (number | null)[][] }) {
  const max = Math.max(0, ...mapa.flat().map(v => v ?? 0)) || 1
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-1">
        <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-1 text-[9px] text-zinc-500 text-center">
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? `${h}h` : ''}</span>)}
        </div>
        {mapa.map((linha, d) => (
          <div key={d} className="grid grid-cols-[36px_repeat(24,1fr)] gap-1 items-center">
            <span className="text-[10px] text-zinc-500">{DIAS_SEMANA[d]}</span>
            {linha.map((v, h) => (
              <div key={h} title={v == null ? `${DIAS_SEMANA[d]} ${h}h: sem posts` : `${DIAS_SEMANA[d]} ${h}h: engajamento ${(v * 100).toFixed(2)}%`}
                className="aspect-square rounded-[4px] border border-white/[0.04]"
                style={{ background: v == null ? 'rgba(255,255,255,0.02)' : `rgba(129,140,248,${0.15 + 0.85 * (v / max)})` }} />
            ))}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-500">
          menos <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(129,140,248,0.15), rgba(129,140,248,1))' }} /> mais engajamento · horário de Brasília
        </div>
      </div>
    </div>
  )
}

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

// ---------- página ----------

export default function RaioXPaginaPage() {
  const [contas, setContas] = useState<Conta[]>([])
  const [perfil, setPerfil] = useState('')
  const [dias, setDias] = useState(30)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [painel, setPainel] = useState<Painel | null>(null)
  const [modalOficial, setModalOficial] = useState(false)
  const { status: oficial, recarregar } = useInstagramOficial()

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await fetch('/api/social/sync', { method: 'POST' }).catch(() => null)
      const { data } = await supabase.from('social_accounts').select('id, platform, username').eq('user_id', user.id)
      const lista = (data || []).filter((c: Conta) => c.username)
      setContas(lista)
      if (lista.length) setPerfil(p => p || perfilDaConta(lista[0]))
    })()
  }, [])

  async function analisar(p = perfil, d = dias) {
    if (!p.trim()) return
    setCarregando(true)
    setErro('')
    try {
      const r = await fetch('/api/tools/raio-x-pagina', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: p.trim(), dias: d }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.detail || 'Não foi possível analisar essa conta.')
      setPainel(j)
    } catch (e: any) {
      setErro(e.message)
      setPainel(null)
    } finally {
      setCarregando(false)
    }
  }

  const tv = painel?.totais
  const temViews = tv?.views != null
  const kpis = tv ? [
    { i: Eye, l: 'Visualizações', v: num(tv.views), dica: temViews ? '' : 'a fonte não informa views' },
    { i: Film, l: 'Posts', v: tv.posts.toLocaleString('pt-BR') },
    { i: TrendingUp, l: 'Engajamento', v: tv.engajamento == null ? '—' : `${tv.engajamento.toLocaleString('pt-BR')}%`, dica: temViews ? 'interações ÷ views' : 'interações ÷ seguidores, por post' },
    { i: Heart, l: 'Curtidas', v: num(tv.likes) },
    { i: MessageCircle, l: 'Comentários', v: num(tv.comentarios) },
    { i: Share2, l: 'Compartilhamentos', v: num(tv.compartilhamentos), dica: 'só a Meta vê (Insights da própria conta)' },
  ] : []

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-rose-300" /><h1 className="text-sm font-semibold tracking-wide">Raio-X da página</h1></div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <span />
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Como a página está indo</h2>
          <p className="text-sm text-zinc-400">Escolha uma conta conectada (ou digite qualquer @) e o período. Mostra o que dá mais resultado e o melhor horário para postar.</p>
        </div>

        {/* conta + período */}
        <section className="space-y-3">
          {contas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contas.map(c => {
                const p = perfilDaConta(c)
                return (
                  <button key={c.id} type="button" onClick={() => { setPerfil(p); analisar(p) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${perfil === p ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08] hover:text-white'}`}>
                    @{c.username.replace(/^@/, '')} <span className="opacity-60">· {REDE[c.platform] || c.platform}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-2">
            <input id="raiox-perfil" value={perfil} onChange={e => setPerfil(e.target.value)} onKeyDown={e => e.key === 'Enter' && !carregando && analisar()}
              placeholder="@perfil, tiktok.com/@perfil ou youtube.com/@canal"
              className="flex-1 px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm placeholder-zinc-600 outline-none focus:border-indigo-500" />
            <div className="flex gap-2">
              <div className="flex rounded-2xl bg-black/40 border border-white/[0.1] p-1" role="group" aria-label="Período">
                {PERIODOS.map(p => (
                  <button key={p} type="button" onClick={() => { setDias(p); if (painel) analisar(perfil, p) }}
                    className={`px-3 rounded-xl text-xs font-semibold ${dias === p ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>{p}d</button>
                ))}
              </div>
              <button type="button" onClick={() => analisar()} disabled={carregando || !perfil.trim()}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Analisar
              </button>
            </div>
          </div>
          {!oficial?.configurado && (
            <p className="text-[11px] text-zinc-500">
              Instagram: <button type="button" onClick={() => setModalOficial(true)} className="underline text-zinc-300">conecte a API oficial</button> para ler reels, posts e carrosséis sem bloqueio.
            </p>
          )}
        </section>

        {carregando && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-300" /> Lendo os posts do período…
          </div>
        )}
        {erro && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" /> {erro}
          </div>
        )}

        {painel && tv && (
          <>
            {/* perfil */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
                {painel.perfil.foto ? <img src={painel.perfil.foto} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : painel.perfil.usuario.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <a href={painel.perfil.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline flex items-center gap-1">@{painel.perfil.usuario} <ExternalLink className="w-3 h-3 text-zinc-500" /></a>
                <p className="text-[11px] text-zinc-500">
                  {painel.perfil.seguidores != null ? `${num(painel.perfil.seguidores)} seguidores · ` : ''}últimos {painel.dias} dias · {painel.fonte === 'api_oficial' ? 'API oficial da Meta' : 'leitura do servidor'}
                </p>
              </div>
            </div>

            {/* números */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {kpis.map(k => (
                <div key={k.l} className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4" title={k.dica || undefined}>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><k.i className="w-3.5 h-3.5" />{k.l}</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{k.v}</p>
                  {k.dica && <p className="text-[10px] text-zinc-600 mt-0.5">{k.dica}</p>}
                </div>
              ))}
            </section>

            {tv.posts === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum post nos últimos {painel.dias} dias. Tente um período maior.</p>
            ) : (
              <>
                {/* insights */}
                <section className="grid md:grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 to-transparent border border-indigo-400/20 p-4 flex gap-3">
                    <Clock className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-indigo-200/80">Melhor horário</p>
                      {painel.melhor_horario ? (
                        <p className="text-sm mt-1">
                          <b className="capitalize">{painel.melhor_horario.dia}</b> às <b>{painel.melhor_horario.hora}h</b>
                          {painel.melhor_horario.ganho_pct > 0 && <> — <b>{painel.melhor_horario.ganho_pct.toLocaleString('pt-BR')}%</b> acima da média</>}
                          <span className="text-zinc-400"> ({painel.melhor_horario.posts} post{painel.melhor_horario.posts > 1 ? 's' : ''} nesse horário)</span>
                        </p>
                      ) : <p className="text-sm mt-1 text-zinc-400">Poucos posts para comparar horários.</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-400/20 p-4 flex gap-3">
                    <Trophy className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-200/80">Formato campeão</p>
                      {painel.formato_campeao ? (
                        <p className="text-sm mt-1"><b>{NOME_TIPO[painel.formato_campeao.tipo]}</b> — média de <b>{num(painel.formato_campeao.media)}</b> {painel.formato_campeao.metrica} por post</p>
                      ) : <p className="text-sm mt-1 text-zinc-400">—</p>}
                    </div>
                  </div>
                </section>

                <div className="grid lg:grid-cols-2 gap-3">
                  <Bloco titulo="Engajamento por dia" sub="Curtidas e comentários dos posts publicados em cada dia">
                    <Barras dados={painel.por_dia.map(d => ({ rotulo: diaCurto(d.data), valores: [d.likes, d.comentarios] }))}
                      series={[{ nome: 'Curtidas', cor: '#818cf8' }, { nome: 'Comentários', cor: '#f472b6' }]} />
                  </Bloco>
                  <Bloco titulo={temViews ? 'Visualizações por dia' : 'Posts por dia'} sub={temViews ? 'Views dos posts publicados em cada dia' : 'A fonte não informa views — mostrando quantos posts saíram por dia'}>
                    <Barras dados={painel.por_dia.map(d => ({ rotulo: diaCurto(d.data), valores: [temViews ? d.views : d.posts] }))}
                      series={[{ nome: temViews ? 'Views' : 'Posts', cor: '#34d399' }]} />
                  </Bloco>
                </div>

                <Bloco titulo="Melhores dias e horários" sub="Engajamento médio dos posts por dia da semana e hora em que saíram">
                  <MapaCalor mapa={painel.mapa} />
                </Bloco>

                <Bloco titulo={`Top posts por ${temViews ? 'visualizações' : 'curtidas'}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {painel.top_posts.map((p, i) => (
                      <a key={p.id} href={p.permalink || '#'} target="_blank" rel="noreferrer" className="group rounded-2xl overflow-hidden border border-white/[0.08] bg-black/40">
                        <div className="relative aspect-[9/16] bg-white/[0.03]">
                          {p.thumbnail && <img src={p.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />}
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-bold">#{i + 1}</span>
                        </div>
                        <div className="p-2 text-[11px] text-zinc-300 space-y-0.5 tabular-nums">
                          <p className="flex items-center gap-2">
                            {p.views != null && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{num(p.views)}</span>}
                            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{num(p.likes)}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{num(p.comentarios)}</span>
                          </p>
                          {p.engajamento != null && <p className="text-zinc-500">{p.engajamento.toLocaleString('pt-BR')}% engaj.</p>}
                        </div>
                      </a>
                    ))}
                  </div>
                </Bloco>
              </>
            )}

            <Bloco titulo="Evolução de seguidores" sub="Guardamos a contagem uma vez por dia sempre que você abre o Raio-X desta conta">
              {painel.seguidores.length >= 2
                ? <Linha pontos={painel.seguidores.slice(-painel.dias).map(s => ({ rotulo: diaCurto(s.data), v: s.n }))} />
                : <p className="text-xs text-zinc-500">{painel.perfil.seguidores != null ? `Hoje: ${painel.perfil.seguidores.toLocaleString('pt-BR')} seguidores. O gráfico aparece a partir do segundo dia.` : 'A fonte desta conta não informa seguidores.'}</p>}
            </Bloco>
          </>
        )}
      </div>

      {modalOficial && <ModalInstagramOficial status={oficial} fechar={() => setModalOficial(false)} aoSalvar={recarregar} />}
    </div>
  )
}
