'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pagina, Intro, Cartao, Rotulo, Opcoes, BotaoPrincipal, Aviso, Divisoria } from '@/components/pagina/Base'
import { GalleryHorizontal, Sparkles, Download, Copy, Trash2, Check, Loader2, AlertCircle, Link2 } from 'lucide-react'

// Carrosséis automáticos: links (podcast/vídeo, artigo, site, Instagram) ou texto → insights →
// carrosséis prontos no template (textos do Content Machine + frames do próprio vídeo).
// O trabalho pesado roda no servidor (backend/services/carrosseis.py); aqui é o pedido, o andamento e a galeria.

type Template = 'principal' | 'twitter' | 'futurista' | 'autoral'
type Imagens = 'algumas' | 'capa' | 'nenhuma'
interface CarrosselJob { id?: string; titulo: string; status: 'processing' | 'done' | 'failed'; etapa: string; slides: string[]; erro: string | null; legenda?: string }
interface FonteJob { fonte: string; tipo: string; etapa: string; status: 'pending' | 'processing' | 'done' | 'failed'; erro: string | null; titulo: string | null; carrosseis: CarrosselJob[] }
interface Job { status: 'processing' | 'done' | 'failed'; fontes: FonteJob[]; erro?: string }
interface Carrossel { id: string; title: string; caption: string | null; template: Template; source_url: string | null; slides: { url: string; textos: string[] }[]; created_at: string }

const TEMPLATES: { id: Template; label: string; desc: string }[] = [
  { id: 'principal', label: 'Principal', desc: '18 textos · 9 slides' },
  { id: 'twitter', label: 'Twitter', desc: '21 textos · 7 slides' },
  { id: 'futurista', label: 'Futurista', desc: '14 textos · 10 slides' },
  { id: 'autoral', label: 'Autoral 2.0', desc: '18 textos · 9 slides' },
]
const QUANTIDADES: { id: string; label: string; desc: string }[] = [
  { id: 'auto', label: 'Automático', desc: '~1 a cada 10 min' },
  { id: '1', label: '1', desc: 'o melhor insight' },
  { id: '3', label: '3', desc: 'por link' },
  { id: '5', label: '5', desc: 'por link' },
]
const IMAGENS: { id: Imagens; label: string; desc: string }[] = [
  { id: 'algumas', label: 'Do vídeo', desc: 'capa + alguns slides' },
  { id: 'capa', label: 'Só na capa', desc: 'frame do vídeo' },
  { id: 'nenhuma', label: 'Sem imagem', desc: 'só texto' },
]
const NOME_TIPO: Record<string, string> = { video: 'Vídeo', instagram: 'Instagram', pagina: 'Artigo/site', texto: 'Texto' }

function fontesDoCampo(texto: string): string[] {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const links = linhas.filter(l => /^https?:\/\//i.test(l))
  // só links → um por linha; texto colado (com ou sem link junto) → vira uma fonte só
  if (links.length === linhas.length) return links.slice(0, 10)
  return [texto.trim()]
}

export default function CarrosseisPage() {
  const [campo, setCampo] = useState('')
  const [template, setTemplate] = useState<Template>('principal')
  const [quantidade, setQuantidade] = useState('auto')
  const [imagens, setImagens] = useState<Imagens>('algumas')
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [lista, setLista] = useState<Carrossel[] | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const carregarLista = useCallback(async () => {
    const r = await fetch('/api/carrosseis', { cache: 'no-store' }).catch(() => null)
    if (r?.ok) setLista((await r.json()).carrosseis || [])
    else setLista(l => l ?? [])
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])

  // retoma o acompanhamento se a página recarregar no meio
  useEffect(() => {
    try { const j = localStorage.getItem('clipost:carrossel-job'); if (j) setJobId(j) } catch { /* ignora */ }
  }, [])

  useEffect(() => {
    if (!jobId) return
    let vivo = true
    let falhas = 0
    const olhar = async () => {
      const r = await fetch(`/api/carrosseis?job=${jobId}`, { cache: 'no-store' }).catch(() => null)
      if (!vivo) return
      if (r?.status === 404) { setJobId(null); try { localStorage.removeItem('clipost:carrossel-job') } catch { /* */ } return }
      // erro de rede / sessão caída / servidor fora: desiste depois de ~1 min em vez de ficar "Criando…" para sempre
      if (!r?.ok && ++falhas >= 30) {
        setJobId(null); setErro('Perdi a conexão com o servidor. Entre de novo e confira a lista abaixo.')
        try { localStorage.removeItem('clipost:carrossel-job') } catch { /* */ }
        carregarLista()
        return
      }
      if (r?.ok) {
        falhas = 0
        const j: Job = await r.json()
        setJob(j)
        if (j.status !== 'processing') {
          try { localStorage.removeItem('clipost:carrossel-job') } catch { /* */ }
          carregarLista()
          return
        }
      }
      timer.current = setTimeout(olhar, 2000)
    }
    olhar()
    return () => { vivo = false; if (timer.current) clearTimeout(timer.current) }
  }, [jobId, carregarLista])

  const gerar = async () => {
    const fontes = fontesDoCampo(campo)
    if (!fontes.length || !fontes[0]) return setErro('Cole pelo menos um link ou um texto.')
    setErro(null); setEnviando(true); setJob(null)
    try {
      const r = await fetch('/api/carrosseis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontes, template, quantidade, imagens }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `Erro ${r.status}`)
      setJobId(d.job_id)
      try { localStorage.setItem('clipost:carrossel-job', d.job_id) } catch { /* */ }
    } catch (e: any) {
      setErro(e.message || 'Não foi possível começar.')
    } finally {
      setEnviando(false)
    }
  }

  const apagar = async (id: string) => {
    if (!window.confirm('Apagar este carrossel?')) return
    setLista(l => (l || []).filter(c => c.id !== id))
    await fetch(`/api/carrosseis?id=${id}`, { method: 'DELETE' }).catch(() => null)
  }

  const copiar = async (c: Carrossel) => {
    try { await navigator.clipboard.writeText(c.caption || ''); setCopiado(c.id); setTimeout(() => setCopiado(null), 1500) } catch { /* */ }
  }

  const rodando = !!jobId && job?.status !== 'done' && job?.status !== 'failed'
  const nFontes = fontesDoCampo(campo).filter(Boolean).length

  return (
    <Pagina icone={GalleryHorizontal} titulo="Carrosséis" largura="max-w-5xl">
      <Intro titulo="Carrosséis automáticos"
        descricao="Cole o link de um podcast, vídeo, artigo, site ou post do Instagram. A IA acha os insights e entrega cada um como carrossel pronto, com o seu template e imagens do próprio vídeo." />

      <Cartao className="max-w-3xl mx-auto">
        <div className="space-y-2.5">
          <Rotulo direita={nFontes > 1 ? <span className="text-[11px] text-zinc-500">{nFontes} links</span> : undefined}>
            <Link2 className="w-3.5 h-3.5 text-indigo-400" /> Links ou texto
          </Rotulo>
          <textarea aria-label="Links ou texto para os carrosséis" value={campo} onChange={e => setCampo(e.target.value)} rows={4} disabled={rodando}
            placeholder={'https://www.youtube.com/watch?v=...\nhttps://site.com/artigo\n(um link por linha — ou cole um texto inteiro)'}
            className="w-full px-4 py-3.5 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-y disabled:opacity-60" />
        </div>
        <Divisoria />
        <div className="space-y-2.5">
          <Rotulo>Template</Rotulo>
          <Opcoes valor={template} mudar={setTemplate} opcoes={TEMPLATES} colunas={4} />
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <Rotulo>Carrosséis por link</Rotulo>
            <Opcoes valor={quantidade} mudar={setQuantidade} opcoes={QUANTIDADES} colunas={2} />
          </div>
          <div className="space-y-2.5">
            <Rotulo>Imagens</Rotulo>
            <Opcoes valor={imagens} mudar={setImagens} opcoes={IMAGENS} colunas={2} />
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <BotaoPrincipal icone={Sparkles} carregando={enviando || rodando} textoCarregando={rodando ? 'Criando os carrosséis…' : 'Começando…'} onClick={gerar}>
          Gerar carrosséis
        </BotaoPrincipal>
      </Cartao>

      {job?.status === 'failed' && job.erro && <div className="max-w-3xl mx-auto"><Aviso>{job.erro}</Aviso></div>}
      {job && <Andamento job={job} />}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-white">Seus carrosséis</h3>
          {lista && lista.length > 0 && <span className="text-xs text-zinc-500">{lista.length}</span>}
        </div>
        {lista === null && <div className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>}
        {lista && lista.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-zinc-500">
            Os carrosséis que você gerar aparecem aqui, prontos para baixar.
          </div>
        )}
        <div className="space-y-5">
          {lista?.map(c => (
            <article key={c.id} className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">{c.title}</h4>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {TEMPLATES.find(t => t.id === c.template)?.label || c.template} · {c.slides?.length || 0} slides
                    {c.source_url && <> · <a href={c.source_url} target="_blank" rel="noreferrer" className="hover:text-zinc-300 underline-offset-2 hover:underline">origem</a></>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a href={`/api/carrosseis?zip=${c.id}`} aria-label={`Baixar ${c.title} em ZIP`} className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> ZIP
                  </a>
                  {c.caption && (
                    <button type="button" onClick={() => copiar(c)} title="Copiar legenda"
                      className="h-9 px-3 rounded-xl border border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.05] text-xs font-semibold flex items-center gap-1.5">
                      {copiado === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Legenda
                    </button>
                  )}
                  <button type="button" onClick={() => apagar(c.id)} title="Apagar" aria-label={`Apagar ${c.title}`}
                    className="h-9 w-9 rounded-xl border border-white/[0.1] text-zinc-500 hover:text-rose-300 hover:border-rose-500/30 flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x">
                {c.slides?.map((s, i) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="shrink-0 snap-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={`Slide ${i + 1}`} loading="lazy"
                      className="h-56 sm:h-64 aspect-[4/5] object-cover rounded-xl border border-white/[0.06] bg-zinc-900" />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </Pagina>
  )
}

function Andamento({ job }: { job: Job }) {
  const todos = job.fontes.flatMap(f => f.carrosseis)
  const prontos = todos.filter(c => c.status === 'done').length
  return (
    <section className="max-w-3xl mx-auto rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{job.status === 'processing' ? 'Criando os carrosséis' : 'Pronto'}</h3>
        <span className="text-xs text-zinc-400 tabular-nums">{prontos} {prontos === 1 ? 'carrossel pronto' : 'carrosséis prontos'}</span>
      </div>
      <div className="space-y-3">
        {job.fontes.map((f, i) => (
          <div key={i} className="rounded-2xl bg-[#0c0c10] border border-white/[0.06] p-3.5 space-y-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Estado status={f.status} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-200 truncate">{f.titulo || (f.tipo === 'texto' ? 'Texto colado' : f.fonte)}</div>
                <div className={`text-[11px] ${f.status === 'failed' ? 'text-rose-300' : 'text-zinc-500'}`}>
                  {NOME_TIPO[f.tipo] || f.tipo} · {f.status === 'failed' ? f.erro || 'falhou' : f.etapa}
                </div>
              </div>
            </div>
            {f.carrosseis.length > 0 && (
              <ul className="space-y-1.5 pl-7">
                {f.carrosseis.map((c, k) => (
                  <li key={k} className="flex items-center gap-2 text-[11px] min-w-0">
                    <Estado status={c.status} pequeno />
                    <span className="text-zinc-300 truncate flex-1">{c.titulo}</span>
                    <span className={c.status === 'failed' ? 'text-rose-300' : 'text-zinc-500'}>{c.status === 'failed' ? (c.erro || 'falhou') : c.etapa}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function Estado({ status, pequeno }: { status: string; pequeno?: boolean }) {
  const t = pequeno ? 'w-3.5 h-3.5' : 'w-4 h-4'
  if (status === 'done') return <Check className={`${t} text-emerald-400 shrink-0`} />
  if (status === 'failed') return <AlertCircle className={`${t} text-rose-400 shrink-0`} />
  if (status === 'pending') return <span className={`${t} rounded-full border border-zinc-600 shrink-0 inline-block`} />
  return <Loader2 className={`${t} text-indigo-300 animate-spin shrink-0`} />
}
