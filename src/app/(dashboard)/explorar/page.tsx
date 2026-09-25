'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { useExtensaoClipost, ModalExtensao } from '@/components/bulk/ExtensaoInstagram'
import { ModalInstagramOficial, useInstagramOficial } from '@/components/bulk/InstagramOficial'
import {
  Search, Loader2, Download, Heart, Eye, MessageCircle, Calendar as CalendarIcon, Check, FolderPlus, Wand2, Layers, Film, Image as ImageIcon, Images, AlertCircle, CheckCircle2, ExternalLink,
} from 'lucide-react'

// Explorador de perfis: busca os posts de um perfil (Instagram, TikTok, YouTube), mostra em grade com
// números e deixa baixar, salvar na Biblioteca, editar com o template ou abrir no Editor em Massa.

type Tipo = 'reel' | 'post' | 'carrossel'
interface Item {
  id: string
  tipo: Tipo
  url: string | null
  thumbnail: string | null
  permalink: string | null
  legenda: string
  views: number | null
  likes: number | null
  comentarios: number | null
  timestamp: number | null
  duracao: number | null
}
interface Resultado {
  perfil: { usuario: string; nome?: string | null; foto?: string | null; seguidores?: number | null; total_posts?: number | null; url: string }
  plataforma: string
  fonte: 'api_oficial' | 'servidor' | 'extensao'
  totais: { views: number | null; likes: number; comentarios: number; posts: number; reels: number; posts_imagem: number; carrosseis: number }
  itens: Item[]
}

const QUANTIDADES = [50, 100, 200, 500, 1000, 5000, 10000]
const ORDENS = [
  { v: 'recentes', l: 'Mais recentes' },
  { v: 'curtidos', l: 'Mais curtidos' },
  { v: 'visualizados', l: 'Mais visualizados' },
]
const PERIODOS = [
  { v: 0, l: 'Todo período' },
  { v: 7, l: 'Últimos 7 dias' },
  { v: 30, l: 'Últimos 30 dias' },
  { v: 90, l: 'Últimos 90 dias' },
]
const ABAS: { v: 'todos' | Tipo; l: string }[] = [
  { v: 'todos', l: 'Todos' },
  { v: 'reel', l: 'Reels' },
  { v: 'post', l: 'Posts' },
  { v: 'carrossel', l: 'Carrossel' },
]

const num = (n: number | null | undefined) => (n == null ? '—' : Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n))
const data = (t: number | null) => (t ? new Date(t * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')

function lerTemplate() {
  try {
    const salvo = JSON.parse(localStorage.getItem('clippost_active_template') || 'null')
    return salvo?.config || salvo || JSON.parse(localStorage.getItem('clippost_template_config') || 'null')
  } catch {
    return null
  }
}

async function postarJson(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.detail || d.error || 'Não foi possível concluir.')
  return d
}

export default function ExplorarPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState('')
  const [limite, setLimite] = useState(50)
  const [ordem, setOrdem] = useState('recentes')
  const [periodo, setPeriodo] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const [aba, setAba] = useState<'todos' | Tipo>('todos')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [acao, setAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [modalOficial, setModalOficial] = useState(false)
  const [modalExtensao, setModalExtensao] = useState(false)
  const { status: oficial, recarregar } = useInstagramOficial()
  const { instalada, lista, consumir } = useExtensaoClipost()

  // lista enviada pela extensão (Instagram com o login do navegador)
  useEffect(() => {
    if (!lista) return
    const itens: Item[] = lista.itens.map(i => ({
      id: i.permalink, tipo: 'reel', url: i.url, thumbnail: i.thumbnail, permalink: i.permalink, legenda: i.title,
      views: i.view_count, likes: i.like_count, comentarios: i.comment_count, timestamp: i.timestamp, duracao: null,
    }))
    const soma = (k: keyof Item) => itens.reduce((t, i) => t + ((i[k] as number) || 0), 0)
    setRes({
      perfil: { usuario: lista.usuario, url: lista.perfil },
      plataforma: 'instagram',
      fonte: 'extensao',
      totais: { views: soma('views') || null, likes: soma('likes'), comentarios: soma('comentarios'), posts: itens.length, reels: itens.length, posts_imagem: 0, carrosseis: 0 },
      itens,
    })
    setPerfil(lista.usuario)
    setSel(new Set())
    consumir()
  }, [lista, consumir])

  function avisar(tipo: 'ok' | 'erro', texto: string) {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 7000)
  }

  async function buscar() {
    if (!perfil.trim()) return
    setBuscando(true)
    setErro('')
    setRes(null)
    setSel(new Set())
    try {
      setRes(await postarJson('/api/tools/explorar', { perfil: perfil.trim(), limite, ordem, periodo_dias: periodo }))
      setAba('todos')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  const visiveis = useMemo(() => (res ? res.itens.filter(i => aba === 'todos' || i.tipo === aba) : []), [res, aba])
  const selecionados = (res?.itens ?? []).filter(i => sel.has(i.id))
  const videosSel = selecionados.filter(i => i.tipo === 'reel' && i.url)
  const alternar = (id: string) => setSel(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  async function baixar(itens: Item[]) {
    const videos = itens.filter(i => i.tipo === 'reel' && (i.url || i.permalink))
    const imagens = itens.filter(i => i.tipo !== 'reel' && i.url)
    imagens.slice(0, 10).forEach(i => window.open(i.url!, '_blank', 'noopener'))
    if (!videos.length) return
    setAcao('baixar')
    try {
      const d = await postarJson('/api/tools/baixar-link', {
        itens: videos.slice(0, 100).map(i => ({ url: i.url || i.permalink, nome: i.legenda.slice(0, 40) || `@${res?.perfil.usuario}` })),
      })
      window.location.href = d.url
      avisar('ok', videos.length > 1 ? `Preparando o .zip com ${Math.min(videos.length, 100)} vídeos — o download começa sozinho.` : 'Baixando o vídeo…')
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setAcao(null)
    }
  }

  const paraLote = (itens: Item[]) =>
    itens.filter(i => i.tipo === 'reel' && (i.url || i.permalink)).map(i => ({
      url: i.url || i.permalink, permalink: i.permalink, title: i.legenda.slice(0, 200) || `@${res?.perfil.usuario}`,
      thumbnail: i.thumbnail, view_count: i.views, like_count: i.likes,
    }))

  async function salvarBiblioteca() {
    const videos = paraLote(selecionados)
    if (!videos.length) return avisar('erro', 'Selecione pelo menos um Reel.')
    setAcao('salvar')
    try {
      const d = await postarJson('/api/bulk/start', { source: 'files', videos, options: { download_only: true, salvar_biblioteca: true } })
      avisar('ok', `Salvando ${videos.length} vídeo(s) na Biblioteca. Eles aparecem lá em alguns minutos, prontos para agendar.`)
      void d
      setSel(new Set())
    } catch (e: any) {
      avisar('erro', e.message)
    } finally {
      setAcao(null)
    }
  }

  async function agendarComTemplate() {
    const videos = paraLote(selecionados)
    if (!videos.length) return avisar('erro', 'Selecione pelo menos um Reel.')
    setAcao('template')
    try {
      const d = await postarJson('/api/bulk/start', {
        source: 'files', videos, template_config: lerTemplate(),
        options: { replace_template: true, subtitles: true, subtitle_preset: null, remove_silence: false, speed: 1, hflip: false },
      })
      try { localStorage.setItem('clippost_bulk_batch', d.batch_id) } catch {}
      router.push('/bulk?aba=perfil')
    } catch (e: any) {
      avisar('erro', e.message)
      setAcao(null)
    }
  }

  async function abrirNoEditor() {
    const videos = paraLote(selecionados)
    if (!videos.length) return avisar('erro', 'Selecione pelo menos um Reel.')
    setAcao('editor')
    try {
      const d = await postarJson('/api/bulk/start', { source: 'files', videos, options: { download_only: true } })
      try { localStorage.setItem('clipost:editor-importar-lote', d.batch_id) } catch {}
      router.push('/bulk?aba=editor')
    } catch (e: any) {
      avisar('erro', e.message)
      setAcao(null)
    }
  }

  const instagram = /instagram\.com/i.test(perfil) || (!!perfil && !/[./]/.test(perfil.replace(/^@/, '')))

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2"><Search className="w-4 h-4 text-sky-300" /><h1 className="text-sm font-semibold tracking-wide">Explorar perfis</h1></div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <span />
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Busque, baixe e reposte de qualquer perfil</h2>
          <p className="text-sm text-zinc-400">Reels, posts e carrosséis do Instagram — e vídeos do TikTok e YouTube. Baixe, salve na Biblioteca ou edite com o seu template.</p>
        </div>

        {/* busca */}
        <section className="flex flex-col lg:flex-row gap-2">
          <input id="explorar-perfil" value={perfil} onChange={e => setPerfil(e.target.value)} onKeyDown={e => e.key === 'Enter' && !buscando && buscar()}
            placeholder="@perfil, instagram.com/perfil, tiktok.com/@perfil, youtube.com/@canal"
            className="flex-1 px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm placeholder-zinc-600 outline-none focus:border-indigo-500" />
          <div className="flex gap-2">
            <select id="explorar-limite" value={limite} onChange={e => setLimite(Number(e.target.value))} className="px-3 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm" aria-label="Quantidade">
              {QUANTIDADES.map(q => <option key={q} value={q}>{q.toLocaleString('pt-BR')}</option>)}
            </select>
            <select id="explorar-ordem" value={ordem} onChange={e => setOrdem(e.target.value)} className="px-3 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm" aria-label="Ordem">
              {ORDENS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select id="explorar-periodo" value={periodo} onChange={e => setPeriodo(Number(e.target.value))} className="px-3 py-3 rounded-2xl bg-black/40 border border-white/[0.1] text-sm" aria-label="Período">
              {PERIODOS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
            <button type="button" onClick={buscar} disabled={buscando || !perfil.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
            </button>
          </div>
        </section>

        {/* Instagram: de onde vem */}
        {instagram && !res && (
          <p className="text-[11px] text-zinc-500">
            Instagram:{' '}
            {oficial?.configurado
              ? <span className="text-emerald-300">API oficial conectada — busca direto, sem bloqueio (perfis profissionais).</span>
              : <><button type="button" onClick={() => setModalOficial(true)} className="underline text-zinc-300">conecte a API oficial</button> para buscar direto no site, </>}
            {!oficial?.configurado && <>ou <button type="button" onClick={() => setModalExtensao(true)} className="underline text-zinc-300">use a extensão{instalada ? ' (instalada ✓)' : ''}</button>.</>}
          </p>
        )}

        {buscando && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-300" /> Lendo os posts do perfil… (perfis grandes podem levar alguns minutos)
          </div>
        )}
        {erro && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-100 space-y-2">
            <p className="flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" /> {erro}</p>
            {instagram && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setModalOficial(true)} className="px-3 py-1.5 rounded-lg bg-white/[0.08] font-semibold">🔐 Conectar API oficial</button>
                <button type="button" onClick={() => setModalExtensao(true)} className="px-3 py-1.5 rounded-lg bg-white/[0.08] font-semibold">🧩 Usar a extensão</button>
              </div>
            )}
          </div>
        )}
        {aviso && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-2xl border text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-red-500/10 border-red-500/25 text-red-200'}`}>
            {aviso.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />} {aviso.texto}
          </div>
        )}

        {res && (
          <>
            {/* cabeçalho do perfil */}
            <section className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-purple-600 shrink-0 flex items-center justify-center text-sm font-bold">
                  {res.perfil.foto ? <img src={res.perfil.foto} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : res.perfil.usuario.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <a href={res.perfil.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline flex items-center gap-1">@{res.perfil.usuario} <ExternalLink className="w-3 h-3 text-zinc-500" /></a>
                  <p className="text-[11px] text-zinc-500">
                    {res.perfil.seguidores != null ? `${num(res.perfil.seguidores)} seguidores · ` : ''}
                    {res.fonte === 'api_oficial' ? 'API oficial da Meta' : res.fonte === 'extensao' ? 'via extensão' : 'leitura do servidor'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { i: Eye, v: num(res.totais.views), l: 'Views total' },
                  { i: Heart, v: num(res.totais.likes), l: 'Likes total' },
                  { i: MessageCircle, v: num(res.totais.comentarios), l: 'Comentários' },
                  { i: Film, v: res.totais.posts.toLocaleString('pt-BR'), l: res.perfil.total_posts ? `de ${num(res.perfil.total_posts)} posts` : 'posts' },
                ].map(x => (
                  <div key={x.l}>
                    <p className="text-sm font-bold tabular-nums flex items-center justify-center gap-1"><x.i className="w-3.5 h-3.5 text-zinc-500" />{x.v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{x.l}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* filtros + ações */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex gap-1.5">
                {ABAS.map(a => {
                  const n = a.v === 'todos' ? res.itens.length : res.itens.filter(i => i.tipo === a.v).length
                  return (
                    <button key={a.v} type="button" onClick={() => setAba(a.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${aba === a.v ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'}`}>
                      {a.l} <span className="opacity-60 tabular-nums">{n}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 lg:ml-auto">
                <button type="button" onClick={() => setSel(sel.size === visiveis.length ? new Set() : new Set(visiveis.map(i => i.id)))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08]">
                  {sel.size && sel.size === visiveis.length ? 'Limpar seleção' : 'Selecionar todos'}
                </button>
                <button type="button" onClick={() => baixar(visiveis)} disabled={!!acao} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> Baixar todos ({visiveis.length})
                </button>
                <button type="button" onClick={() => baixar(selecionados)} disabled={!selecionados.length || !!acao} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-40">
                  <Download className="w-3.5 h-3.5" /> Baixar selecionados ({selecionados.length})
                </button>
                <button type="button" onClick={salvarBiblioteca} disabled={!videosSel.length || !!acao} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-40">
                  {acao === 'salvar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />} Salvar na Biblioteca ({videosSel.length})
                </button>
                <button type="button" onClick={agendarComTemplate} disabled={!videosSel.length || !!acao} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 flex items-center gap-1.5 disabled:opacity-40">
                  {acao === 'template' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Editar com template ({videosSel.length})
                </button>
                <button type="button" onClick={abrirNoEditor} disabled={!videosSel.length || !!acao} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-40">
                  {acao === 'editor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Editor ({videosSel.length})
                </button>
              </div>
            </div>

            {/* grade */}
            {visiveis.length === 0 ? (
              <p className="text-sm text-zinc-500 py-10 text-center">Nada nesse filtro.</p>
            ) : (
              <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {visiveis.map(i => {
                  const marcado = sel.has(i.id)
                  const Icone = i.tipo === 'reel' ? Film : i.tipo === 'carrossel' ? Images : ImageIcon
                  return (
                    <article key={i.id} className={`rounded-2xl overflow-hidden border bg-[#101014] flex flex-col ${marcado ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-white/[0.07]'}`}>
                      <button type="button" onClick={() => alternar(i.id)} className="relative aspect-[9/14] bg-black block" aria-pressed={marcado} aria-label="Selecionar">
                        {i.thumbnail && <img src={i.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                        <span className={`absolute top-2 left-2 w-5 h-5 rounded-md border flex items-center justify-center ${marcado ? 'bg-indigo-500 border-indigo-400' : 'bg-black/50 border-white/40'}`}>
                          {marcado && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-semibold flex items-center gap-1 capitalize"><Icone className="w-3 h-3" />{i.tipo}</span>
                      </button>
                      <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
                        <p className="text-[11px] text-zinc-300 leading-snug line-clamp-2 min-h-[28px]">{i.legenda || '—'}</p>
                        <div className="flex items-center gap-2.5 text-[10px] text-zinc-400 tabular-nums">
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{num(i.likes)}</span>
                          {i.views != null && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{num(i.views)}</span>}
                          <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{num(i.comentarios)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-auto">
                          <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{data(i.timestamp)}</span>
                          <span className="flex items-center gap-1.5">
                            {dur(i.duracao) && <span className="tabular-nums">{dur(i.duracao)}</span>}
                            <button type="button" onClick={() => baixar([i])} className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white" title="Baixar"><Download className="w-3.5 h-3.5" /></button>
                          </span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </>
        )}

        {!res && !buscando && !erro && (
          <div className="rounded-3xl border border-dashed border-white/[0.1] p-10 text-center text-sm text-zinc-500 space-y-1">
            <p>Digite um @ e clique em Buscar.</p>
            <p className="text-[11px]">Depois é só marcar os posts e escolher: baixar, salvar na <Link href="/dashboard" className="underline">Biblioteca</Link>, editar com o seu template ou abrir no Editor.</p>
          </div>
        )}
      </div>

      {modalOficial && <ModalInstagramOficial status={oficial} fechar={() => setModalOficial(false)} aoSalvar={recarregar} />}
      {modalExtensao && <ModalExtensao instalada={instalada} fechar={() => setModalExtensao(false)} />}
    </div>
  )
}
