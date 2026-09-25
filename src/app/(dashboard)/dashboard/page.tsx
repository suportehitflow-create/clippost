'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scissors, Loader2, Trash2, Play, Zap, Layers, Search, Download, AlertCircle, Film, FolderOpen } from 'lucide-react'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { urlArquivo } from '@/lib/editor-massa/client/api'
import { carregarResultados } from '@/components/editor-massa/persistencia'
import type { ResultadoJob } from '@/components/editor-massa/estado'

// Biblioteca: tudo o que foi criado no Clipost, com a função de origem de cada item
//  - Criar Cortes / Autopilot → projetos com os cortes gerados pela IA
//  - Edição em Massa / Estúdio → vídeos exportados pelo editor (guardados no servidor do editor)

interface Projeto {
  id: string
  title: string
  source_url: string
  status: string
  created_at: string
}
interface Corte {
  id: string
  project_id: string
  storage_url: string | null
}

type Origem = 'cortes' | 'autopilot' | 'editor'
type Filtro = 'tudo' | Origem

const ORIGENS: Record<Origem, { nome: string; icone: typeof Scissors; cor: string }> = {
  cortes: { nome: 'Criar Cortes', icone: Scissors, cor: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25' },
  autopilot: { nome: 'Autopilot', icone: Zap, cor: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  editor: { nome: 'Edição em Massa', icone: Layers, cor: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/25' },
}

const data = (d: string | number) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function Selo({ origem }: { origem: Origem }) {
  const o = ORIGENS[origem]
  const I = o.icone
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${o.cor}`}>
      <I className="w-3 h-3" /> {o.nome}
    </span>
  )
}


function extrairCapaVideo(sourceUrl?: string): string | null {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  if (match) {
    return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

/** Capa do vídeo original extraído (16:9), padrão biblioteca de mídia */
function CapaVideo({ capaUrl, videoUrl, processando }: { capaUrl: string | null; videoUrl: string | null; processando?: boolean }) {
  const [imgErro, setImgErro] = useState(false);
  return (
    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#15151c] to-[#0c0c10] border border-white/[0.08] shadow-md group-hover:border-indigo-500/40 transition-all">
      {capaUrl && !imgErro ? (
        <img
          src={capaUrl}
          alt=""
          loading="lazy"
          onError={() => setImgErro(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : videoUrl ? (
        <video src={`${videoUrl}#t=1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
          {processando ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : <Film className="w-7 h-7 text-zinc-600" />}
        </div>
      )}
    </div>
  )
}

export default function Biblioteca() {
  const router = useRouter()
  const supabase = createClient()
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [doAutopilot, setDoAutopilot] = useState<Set<string>>(new Set())
  const [exportados, setExportados] = useState<ResultadoJob[]>([])
  const [carregando, setCarregando] = useState(true)
  const [apagando, setApagando] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [busca, setBusca] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // o servidor do editor guarda os exportados por 24h: os mais antigos não abrem mais
    setExportados(carregarResultados().filter(r => Date.now() - r.criadoEm < 24 * 3600 * 1000))
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.push('/login')
        setUserId(user.id)
        const [p, c, a] = await Promise.all([
          supabase.from('projects').select('id, title, source_url, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('clips').select('id, project_id, storage_url').eq('user_id', user.id).limit(2000),
          supabase.from('autopilot_processed').select('project_id').eq('user_id', user.id).limit(2000),
        ])
        setProjetos((p.data as Projeto[]) ?? [])
        setCortes((c.data as Corte[]) ?? [])
        setDoAutopilot(new Set(((a.data as { project_id: string | null }[]) ?? []).map(x => x.project_id).filter(Boolean) as string[]))
      } catch (e) {
        console.warn('Erro ao carregar a biblioteca:', e)
      } finally {
        setCarregando(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cortesPorProjeto = useMemo(() => {
    const m = new Map<string, Corte[]>()
    for (const c of cortes) m.set(c.project_id, [...(m.get(c.project_id) ?? []), c])
    return m
  }, [cortes])

  const origemProjeto = (id: string): Origem => (doAutopilot.has(id) ? 'autopilot' : 'cortes')
  const termo = busca.trim().toLowerCase()
  const projetosVisiveis = projetos.filter(
    p => (filtro === 'tudo' || filtro === origemProjeto(p.id)) && (!termo || p.title?.toLowerCase().includes(termo)),
  )
  const exportadosVisiveis = exportados.filter(
    r => (filtro === 'tudo' || filtro === 'editor') && r.itens.some(i => i.saida) && (!termo || r.aba.toLowerCase().includes(termo)),
  )

  const contagem: Record<Filtro, number> = {
    tudo: projetos.length + exportados.filter(r => r.itens.some(i => i.saida)).length,
    cortes: projetos.filter(p => origemProjeto(p.id) === 'cortes').length,
    autopilot: projetos.filter(p => origemProjeto(p.id) === 'autopilot').length,
    editor: exportados.filter(r => r.itens.some(i => i.saida)).length,
  }

  async function apagarProjeto(id: string) {
    if (!window.confirm('Excluir este projeto e os cortes dele?')) return
    setApagando(id)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) {
        await supabase.from('clips').delete().eq('project_id', id)
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) throw new Error(d.error || error.message)
      }
      setProjetos(ps => ps.filter(p => p.id !== id))
      setCortes(cs => cs.filter(c => c.project_id !== id))
    } catch (err: any) {
      alert(`Não foi possível excluir o projeto: ${err.message || 'erro inesperado'}`)
    } finally {
      setApagando(null)
    }
  }

  function esquecerExportado(jobId: string) {
    const resto = exportados.filter(r => r.jobId !== jobId)
    setExportados(resto)
    try { localStorage.setItem('clipost:editor-massa:resultados', JSON.stringify(resto)) } catch {}
  }

  const vazio = !carregando && projetosVisiveis.length === 0 && exportadosVisiveis.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c]">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Biblioteca</h1>
        </div>
        <div className="flex justify-center">{userId && <ProfileSwitcher userId={userId} align="center" />}</div>
        <div className="flex items-center justify-end gap-2">
          <Link href="/bulk" className="hidden sm:flex px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-semibold items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Edição em Massa
          </Link>
          <Link href="/upload" className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5" /> Criar cortes
          </Link>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* filtros por função + busca */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por função">
            {(['tudo', 'cortes', 'autopilot', 'editor'] as Filtro[]).map(f => {
              const ativo = filtro === f
              const I = f === 'tudo' ? FolderOpen : ORIGENS[f].icone
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                    ativo ? 'bg-white text-zinc-900 border-white' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  <I className="w-3.5 h-3.5" />
                  {f === 'tudo' ? 'Tudo' : ORIGENS[f].nome}
                  <span className={`tabular-nums text-[10px] ${ativo ? 'text-zinc-500' : 'text-zinc-600'}`}>{contagem[f]}</span>
                </button>
              )
            })}
          </div>
          <label className="sm:ml-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] focus-within:border-indigo-500/60 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              id="biblioteca-busca"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar pelo título"
              className="bg-transparent outline-none text-xs text-white placeholder-zinc-500 w-full"
            />
          </label>
        </div>

        {carregando && (
          <div className="flex items-center justify-center gap-2 py-20 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Carregando sua biblioteca…
          </div>
        )}

        {vazio && (
          <div className="text-center py-16 px-6 bg-white/[0.02] border border-white/[0.08] rounded-3xl space-y-4">
            <Film className="w-8 h-8 text-indigo-400 mx-auto" />
            <div>
              <h2 className="text-sm font-semibold text-white">{termo || filtro !== 'tudo' ? 'Nada encontrado' : 'Sua biblioteca está vazia'}</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Os cortes gerados pela IA, os vídeos do Autopilot e o que você exportar na Edição em Massa aparecem aqui.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Link href="/upload" className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-xs font-semibold">Criar cortes</Link>
              <Link href="/bulk" className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs font-semibold">Edição em Massa</Link>
            </div>
          </div>
        )}

        {/* projetos (Criar Cortes / Autopilot) */}
        {projetosVisiveis.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Projetos · cortes com IA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {projetosVisiveis.map(p => {
                const cs = cortesPorProjeto.get(p.id) ?? []
                const prontos = cs.filter(c => c.storage_url)
                const processando = p.status === 'processing' || p.status === 'pending'
                const falhou = p.status === 'failed'
                return (
                  <article key={p.id} className="group relative flex flex-col gap-2.5 bg-white/[0.02] hover:bg-white/[0.04] p-3 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] transition-all">
                    <Link href={`/project/${p.id}`} className="block relative" title="Abrir no estúdio">
                      <CapaVideo capaUrl={extrairCapaVideo(p.source_url)} videoUrl={prontos[0]?.storage_url ?? null} processando={processando} />
                      <span className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3.5 py-1.5 rounded-xl bg-white text-zinc-900 text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                          <Play className="w-3.5 h-3.5 fill-current" /> Abrir no estúdio
                        </span>
                      </span>
                      <span className="absolute top-2.5 left-2.5">
                        <Selo origem={origemProjeto(p.id)} />
                      </span>
                      <span className={`absolute bottom-2.5 left-2.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10 shadow-sm ${
                        falhou ? 'bg-red-500/80 text-white' : processando ? 'bg-black/75 text-indigo-300' : 'bg-black/75 text-white'
                      }`}>
                        {falhou ? (
                          <span className="inline-flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-red-300" /> Falhou</span>
                        ) : processando ? (
                          <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> Gerando{prontos.length ? ` · ${prontos.length}` : ''}</span>
                        ) : (
                          `${cs.length || prontos.length} corte${(cs.length || prontos.length) === 1 ? '' : 's'}`
                        )}
                      </span>
                    </Link>
                    <div className="min-w-0 px-1">
                      <h3 className="text-xs font-semibold text-white leading-snug line-clamp-2" title={p.title}>{p.title}</h3>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                        <span className="text-[10px] text-zinc-500 tabular-nums">{data(p.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => apagarProjeto(p.id)}
                          disabled={apagando === p.id}
                          className="p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                          title="Excluir projeto"
                        >
                          {apagando === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* exportados no editor (Edição em Massa / estúdio) */}
        {exportadosVisiveis.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Exportados no editor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exportadosVisiveis.map(r => {
                const prontos = r.itens.filter(i => i.saida)
                return (
                  <article key={r.jobId} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Selo origem="editor" />
                        <h3 className="text-sm font-semibold text-white truncate mt-1.5" title={r.aba}>{r.aba}</h3>
                        <p className="text-[10px] text-zinc-500 tabular-nums">{data(r.criadoEm)} · {prontos.length} vídeo{prontos.length === 1 ? '' : 's'}</p>
                      </div>
                      <a
                        href={urlArquivo(r.jobId, 'todos.zip')}
                        download
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar .zip
                      </a>
                      <button type="button" onClick={() => esquecerExportado(r.jobId)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10" title="Tirar da biblioteca">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ul className="divide-y divide-white/[0.05]">
                      {prontos.slice(0, 6).map((i, idx) => (
                        <li key={idx} className="flex items-center gap-2 py-1.5">
                          <Film className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          <span className="text-xs text-zinc-300 truncate flex-1" title={i.nome}>{i.nome}</span>
                          <a href={urlArquivo(r.jobId, i.saida!)} target="_blank" rel="noreferrer" className="p-1 rounded text-zinc-500 hover:text-white" title="Assistir">
                            <Play className="w-3.5 h-3.5" />
                          </a>
                          <a href={urlArquivo(r.jobId, i.saida!, true)} download className="p-1 rounded text-zinc-500 hover:text-white" title="Baixar">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </li>
                      ))}
                      {prontos.length > 6 && <li className="py-1.5 text-[11px] text-zinc-500">+ {prontos.length - 6} no .zip</li>}
                    </ul>
                  </article>
                )
              })}
            </div>
            <p className="text-[11px] text-zinc-600">Os vídeos exportados ficam disponíveis por 24 horas. Baixe os que quiser guardar.</p>
          </section>
        )}
      </div>
    </div>
  )
}
