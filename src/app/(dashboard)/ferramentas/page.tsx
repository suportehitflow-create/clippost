'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import EditorLegenda, { ContadorLegenda } from '@/components/ferramentas/EditorLegenda'
import { ResultadoRaioX } from '@/components/ferramentas/RaioX'
import YoutubeTexto from '@/components/ferramentas/YoutubeTexto'
import { FUSOS, horarioLocal, LIMITE_DIARIO, LIMITE_LEGENDA, MELHORES_DIAS, MELHORES_HORARIOS, NOME_REDE, quebrasSeguras } from '@/lib/publicacao'
import { Wrench, Sparkles, Activity, FileText, Clock, Type, WrapText, Gauge, Copy, Check, type LucideIcon } from 'lucide-react'

// Ferramentas avulsas que ajudam a publicar: cada uma também aparece dentro da tela onde é usada
// (Calendário, Autopilot, Roteiros), mas aqui dá para usar sozinha.

type Id = 'legenda' | 'raiox' | 'youtube' | 'horarios' | 'contador' | 'quebras' | 'limites'

const FERRAMENTAS: { id: Id; nome: string; desc: string; icone: LucideIcon; cor: string }[] = [
  { id: 'legenda', nome: 'Legenda e hashtags com IA', desc: '3 opções prontas a partir de um corte ou de uma ideia', icone: Sparkles, cor: '129,140,248' },
  { id: 'raiox', nome: 'Raio-X do perfil', desc: 'Nota de A a E com views, engajamento e frequência', icone: Activity, cor: '16,185,129' },
  { id: 'youtube', nome: 'YouTube → texto', desc: 'Tudo o que é falado num vídeo, para copiar ou baixar', icone: FileText, cor: '239,68,68' },
  { id: 'horarios', nome: 'Melhores horários', desc: 'Dias e horas de pico de cada rede, no fuso do público', icone: Clock, cor: '245,158,11' },
  { id: 'contador', nome: 'Contador e prévia', desc: 'Limite de cada rede e o corte do "...mais" do Instagram', icone: Type, cor: '59,130,246' },
  { id: 'quebras', nome: 'Quebra de linha segura', desc: 'Linhas em branco que não somem no Instagram', icone: WrapText, cor: '236,72,153' },
  { id: 'limites', nome: 'Limites das redes', desc: 'Quantos posts por dia cada API aceita e outros limites', icone: Gauge, cor: '161,161,170' },
]

const REDES = ['instagram', 'tiktok', 'youtube_shorts', 'facebook']
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const pilula = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${on ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'}`

function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" disabled={!texto}
      onClick={() => { navigator.clipboard?.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500) }}
      className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />} {ok ? 'Copiado' : rotulo}
    </button>
  )
}

// ---------------- cada ferramenta ----------------

function Legenda() {
  const supabase = createClient()
  const [cortes, setCortes] = useState<{ id: string; title: string | null; hook: string | null }[]>([])
  const [clip, setClip] = useState('')
  const [ideia, setIdeia] = useState('')
  const [rede, setRede] = useState('instagram')
  const [texto, setTexto] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return
      const { data: c } = await supabase.from('clips').select('id, title, hook').eq('user_id', data.user.id).not('storage_url', 'is', null).order('created_at', { ascending: false }).limit(60)
      setCortes((c as any[]) ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-[11px] text-zinc-500">A partir de um corte da Biblioteca (usa o que é falado nele)</span>
          <select id="ferr-legenda-corte" value={clip} onChange={e => setClip(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm">
            <option value="">Nenhum — usar só a ideia</option>
            {cortes.map(c => <option key={c.id} value={c.id}>{(c.hook || c.title || 'Corte').slice(0, 70)}</option>)}
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-[11px] text-zinc-500">Ou a ideia / assunto do vídeo</span>
          <input id="ferr-legenda-ideia" value={ideia} onChange={e => setIdeia(e.target.value)} placeholder="Ex: o erro que faz 90% dos iniciantes desistirem" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm placeholder-zinc-600" />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {REDES.map(r => <button key={r} type="button" className={pilula(rede === r)} onClick={() => setRede(r)}>{NOME_REDE[r]}</button>)}
      </div>
      <EditorLegenda id="ferr-legenda" valor={texto} mudar={setTexto} plataformas={[rede]} clipId={clip || undefined} titulo={ideia || undefined} linhas={7} />
      <div className="flex gap-2">
        <BotaoCopiar texto={texto} />
        <BotaoCopiar texto={quebrasSeguras(texto)} rotulo="Copiar com quebras seguras" />
      </div>
    </div>
  )
}

function RaioXFerramenta() {
  const [entrada, setEntrada] = useState('')
  const [perfil, setPerfil] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input id="ferr-raiox" value={entrada} onChange={e => setEntrada(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrada.trim() && setPerfil(entrada.trim())}
          placeholder="youtube.com/@canal, tiktok.com/@perfil, instagram.com/perfil"
          className="flex-1 px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm placeholder-zinc-600 outline-none focus:border-indigo-500" />
        <button type="button" onClick={() => entrada.trim() && setPerfil(entrada.trim())} disabled={!entrada.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold disabled:opacity-50">Analisar</button>
      </div>
      <p className="text-[11px] text-zinc-500">Serve para o seu perfil ou para o de um concorrente. Instagram precisa do Instagram conectado no <Link href="/autopilot" className="underline">Autopilot</Link>.</p>
      {perfil && <ResultadoRaioX perfil={perfil} />}
    </div>
  )
}

function Horarios() {
  const [rede, setRede] = useState('instagram')
  const [fuso, setFuso] = useState('America/Sao_Paulo')
  const horas = MELHORES_HORARIOS[rede] ?? []
  const dias = MELHORES_DIAS[rede] ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {REDES.map(r => <button key={r} type="button" className={pilula(rede === r)} onClick={() => setRede(r)}>{NOME_REDE[r]}</button>)}
        <select id="ferr-fuso" value={fuso} onChange={e => setFuso(e.target.value)} className="ml-auto px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs" aria-label="Fuso do público">
          {FUSOS.map(f => <option key={f.id} value={f.id}>Público: {f.nome}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-4">
          <span className="text-[11px] text-zinc-500">Melhores horários (no seu relógio)</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {horas.map(h => <span key={h} className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-sm font-semibold tabular-nums">{horarioLocal(h, fuso)}</span>)}
          </div>
          {fuso !== 'local' && <p className="text-[10px] text-zinc-500 mt-2">No horário do público: {horas.join(' · ')}</p>}
        </div>
        <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-4">
          <span className="text-[11px] text-zinc-500">Dias que costumam render mais</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {dias.map(d => <span key={d} className="px-3 py-1.5 rounded-lg bg-white/[0.08] text-sm font-semibold">{DIAS[d]}</span>)}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">São horários de pico gerais de cada rede (referência de mercado), não da sua conta. Teste e compare no Raio-X.</p>
      <Link href="/schedule" className="inline-flex px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-xs font-semibold">
        Agendar com esses horários →
      </Link>
    </div>
  )
}

function Contador() {
  const [texto, setTexto] = useState('')
  return (
    <div className="space-y-3">
      <textarea id="ferr-contador" value={texto} onChange={e => setTexto(e.target.value)} rows={8} placeholder="Cole ou escreva a legenda…" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
      <ContadorLegenda texto={texto} redes={REDES} />
      <p className="text-[11px] text-zinc-500 tabular-nums">
        {texto.trim() ? texto.trim().split(/\s+/).length : 0} palavras · {(texto.match(/#[\p{L}\p{N}_]+/gu) ?? []).length} hashtags
        {(texto.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30 && <span className="text-red-300"> · o Instagram aceita no máximo 30</span>}
      </p>
    </div>
  )
}

function Quebras() {
  const [texto, setTexto] = useState('')
  const saida = quebrasSeguras(texto)
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400">O Instagram, o TikTok e o Facebook juntam as linhas em branco da legenda. Aqui cada linha vazia vira um caractere invisível, e o espaçamento fica igual ao que você escreveu. (Os posts agendados pelo Clipost já saem assim.)</p>
      <div className="grid md:grid-cols-2 gap-3">
        <textarea id="ferr-quebras" value={texto} onChange={e => setTexto(e.target.value)} rows={10} placeholder="Cole a legenda aqui…" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3 text-sm text-zinc-200 whitespace-pre-line min-h-[220px]">{saida || <span className="text-zinc-600">O resultado aparece aqui.</span>}</div>
      </div>
      <BotaoCopiar texto={saida} rotulo="Copiar legenda corrigida" />
    </div>
  )
}

function Limites() {
  const linhas = [
    { rede: 'Instagram', posts: `${LIMITE_DIARIO.instagram.n} por dia (API)`, legenda: `${LIMITE_LEGENDA.instagram} caracteres`, extra: 'até 30 hashtags; vídeo de 3s a 15min, 9:16' },
    { rede: 'TikTok', posts: `~${LIMITE_DIARIO.tiktok.n} por dia (API)`, legenda: `${LIMITE_LEGENDA.tiktok} caracteres`, extra: 'vídeo vertical; posts em excesso podem ficar como rascunho' },
    { rede: 'YouTube Shorts', posts: `~${LIMITE_DIARIO.youtube_shorts.n} por dia (cota da API)`, legenda: `título com ${LIMITE_LEGENDA.youtube_shorts} caracteres`, extra: 'até 3 min; a descrição aceita 5.000 caracteres' },
    { rede: 'Facebook (Página)', posts: 'sem limite fixo publicado', legenda: `${LIMITE_LEGENDA.facebook}+ caracteres`, extra: 'Reels de 3s a 90s' },
  ]
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Rede</th>
              <th className="py-2 pr-3 font-semibold">Publicações</th>
              <th className="py-2 pr-3 font-semibold">Legenda</th>
              <th className="py-2 font-semibold">Outros</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.rede} className="border-t border-white/[0.06]">
                <td className="py-2.5 pr-3 font-semibold text-white">{l.rede}</td>
                <td className="py-2.5 pr-3 text-zinc-300">{l.posts}</td>
                <td className="py-2.5 pr-3 text-zinc-300">{l.legenda}</td>
                <td className="py-2.5 text-zinc-400">{l.extra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500">Limites por conta, pela API oficial de cada rede. O agendamento em massa do Calendário avisa quando um lote passa do limite do dia.</p>
    </div>
  )
}

// ---------------- página ----------------

function Conteudo() {
  const router = useRouter()
  const params = useSearchParams()
  const inicial = (params.get('t') as Id) || 'legenda'
  const [ativa, setAtiva] = useState<Id>(FERRAMENTAS.some(f => f.id === inicial) ? inicial : 'legenda')
  const f = FERRAMENTAS.find(x => x.id === ativa)!

  function abrir(id: Id) {
    setAtiva(id)
    router.replace(`/ferramentas?t=${id}`, { scroll: false })
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-indigo-300" />
          <h1 className="text-sm font-semibold tracking-wide">Ferramentas</h1>
        </div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <span />
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 grid lg:grid-cols-[300px_1fr] gap-5">
        <nav className="grid sm:grid-cols-2 lg:grid-cols-1 gap-2 content-start" aria-label="Ferramentas">
          {FERRAMENTAS.map(x => (
            <button key={x.id} type="button" onClick={() => abrir(x.id)} aria-current={ativa === x.id ? 'page' : undefined}
              className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${ativa === x.id ? 'bg-white/[0.06] border-white/[0.18]' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.14]'}`}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, rgba(${x.cor},1), rgba(${x.cor},0.5))` }}>
                <x.icone className="w-4 h-4 text-white" />
              </span>
              <span className="min-w-0">
                <span className="text-sm font-semibold block truncate">{x.nome}</span>
                <span className="text-[11px] text-zinc-500 block truncate">{x.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 space-y-4 min-w-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{f.nome}</h2>
            <p className="text-xs text-zinc-500">{f.desc}</p>
          </div>
          {ativa === 'legenda' && <Legenda />}
          {ativa === 'raiox' && <RaioXFerramenta />}
          {ativa === 'youtube' && <YoutubeTexto mostrarTexto />}
          {ativa === 'horarios' && <Horarios />}
          {ativa === 'contador' && <Contador />}
          {ativa === 'quebras' && <Quebras />}
          {ativa === 'limites' && <Limites />}
        </section>
      </div>
    </div>
  )
}

export default function FerramentasPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-zinc-500 min-h-screen">Carregando…</div>}>
      <Conteudo />
    </Suspense>
  )
}
