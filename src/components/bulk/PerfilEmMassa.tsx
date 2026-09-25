'use client'

import ProfileSwitcher from '@/components/ProfileSwitcher'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'
import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { ModalExtensao, useExtensaoClipost, type ListaExtensao } from './ExtensaoInstagram'
import {
  Layers, UploadCloud, Link2, X, Loader2, CheckCircle2, AlertCircle, Play, Sparkles, Wand2, FileVideo,
} from 'lucide-react'

type Source = 'files' | 'profile'
type SortBy = 'views' | 'likes' | 'engagement' | 'date'

interface BatchItem {
  url: string
  title: string
  thumbnail?: string | null
  view_count?: number | null
  like_count?: number | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  project_id?: string | null
  error?: string | null
  template_replaced?: boolean
}

interface Batch {
  id: string
  status: 'listing' | 'processing' | 'done' | 'failed'
  error?: string | null
  profile_url?: string
  items: BatchItem[]
}

const COUNT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 0, label: 'Todos' },
]

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'views', label: 'Visualizações' },
  { value: 'likes', label: 'Curtidas' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'date', label: 'Mais recentes' },
]

const SPEED_OPTIONS = [1, 1.05, 1.1]

const SUBTITLE_OPTIONS = [
  { id: '', name: 'Do meu template' },
  { id: 'hormozi_yellow', name: 'Hormozi Amarelo' },
  { id: 'hormozi_orange', name: 'Hormozi Laranja' },
  { id: 'clean_white', name: 'Clean White' },
  { id: 'dark_box', name: 'Dark Box' },
  { id: 'neon_cyan', name: 'Neon Cyan' },
  { id: 'neon_magenta', name: 'Neon Magenta' },
  { id: 'karaoke_amarelo', name: 'Karaokê Amarelo' },
  { id: 'karaoke_roxo', name: 'Karaokê Roxo' },
  { id: 'palavra_unica', name: 'Palavra Única' },
  { id: 'revelacao', name: 'Revelação' },
  { id: 'pop_branco', name: 'Pop Branco' },
  { id: 'caixa_pop', name: 'Caixa Pop' },
  { id: 'fade_suave', name: 'Fade Suave' },
]

const ACTIVE_BATCH_KEY = 'clippost_bulk_batch'

const pill = (active: boolean) =>
  `px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
    active
      ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/20'
      : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
  }`

function formatCount(n?: number | null) {
  if (n == null) return null
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function readActiveTemplate() {
  try {
    const saved = localStorage.getItem('clippost_active_template')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.config || parsed
    }
    const savedCfg = localStorage.getItem('clippost_template_config')
    if (savedCfg) return JSON.parse(savedCfg)
  } catch {}
  return null
}

// Aba "Baixar de um perfil" da edição em massa: arquivos enviados ficam com o editor completo
export default function PerfilEmMassa() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [source] = useState<Source>('profile')
  const [files, setFiles] = useState<File[]>([])
  const [showCookieModal, setShowCookieModal] = useState(false)
  const [showExtractorModal, setShowExtractorModal] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [cookieInput, setCookieInput] = useState('')
  const [savingCookies, setSavingCookies] = useState(false)
  const [cookieMsg, setCookieMsg] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [count, setCount] = useState(10)
  const [sortBy, setSortBy] = useState<SortBy>('views')

  const [replaceTemplate, setReplaceTemplate] = useState(true)
  const [subtitles, setSubtitles] = useState(true)
  const [subtitlePreset, setSubtitlePreset] = useState('')
  const [removeSilence, setRemoveSilence] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [hflip, setHflip] = useState(false)

  const [starting, setStarting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [batch, setBatch] = useState<Batch | null>(null)
  const { instalada: extensaoInstalada, lista: listaExtensao, consumir: consumirExtensao } = useExtensaoClipost()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_BATCH_KEY)
      if (saved) setBatchId(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!batchId) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const res = await fetch(`/api/bulk/${batchId}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (!res.ok) {
          setError(data.error || 'Não foi possível acompanhar o lote.')
          try { localStorage.removeItem(ACTIVE_BATCH_KEY) } catch {}
          setBatchId(null)
          return
        }
        setBatch(data)
        if (data.status === 'done' || data.status === 'failed') return
      } catch {}
      if (active) timer = setTimeout(poll, 3000)
    }
    poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [batchId])

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(prev => [...prev, ...Array.from(list).filter(f => f.type.startsWith('video/'))])
    if (fileRef.current) fileRef.current.value = ''
  }


  async function handleSaveCookies() {
    if (!cookieInput.trim()) return
    setSavingCookies(true)
    setCookieMsg('')
    try {
      const res = await fetch('/api/social/instagram-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setCookieMsg('Cookies do Instagram salvos com sucesso no servidor! Tente baixar o perfil novamente.')
        setTimeout(() => {
          setShowCookieModal(false)
          setCookieMsg('')
        }, 2000)
      } else {
        setCookieMsg(data.error || 'Falha ao salvar cookies.')
      }
    } catch (e: any) {
      setCookieMsg('Erro de conexão ao salvar cookies.')
    } finally {
      setSavingCookies(false)
    }
  }

  async function start(daExtensao?: ListaExtensao) {
    setError('')
    if (!daExtensao && source === 'profile' && !profileUrl.trim()) {
      setError('Cole o link do perfil.')
      return
    }
    if (source === 'files' && files.length === 0) {
      setError('Selecione pelo menos um vídeo.')
      return
    }
    setStarting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Faça login para continuar.')

      let videos: Array<{ url: string; title: string; thumbnail?: string | null; view_count?: number | null; like_count?: number | null }> = []
      if (daExtensao) {
        // links diretos dos vídeos que a extensão pegou com o login do navegador
        videos = daExtensao.itens.map(i => ({ url: i.url, title: i.title, thumbnail: i.thumbnail, view_count: i.view_count, like_count: i.like_count }))
      } else if (source === 'files') {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          setUploadProgress(`Enviando ${i + 1} de ${files.length}: ${f.name}`)
          const ext = (f.name.split('.').pop() || 'mp4').toLowerCase()
          const path = `${user.id}/bulk/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage.from('videos').upload(path, f, { contentType: f.type })
          if (upErr) throw new Error(`Falha ao enviar ${f.name}: ${upErr.message}`)
          videos.push({ url: supabase.storage.from('videos').getPublicUrl(path).data.publicUrl, title: f.name.replace(/\.[^.]+$/, '') })
        }
        setUploadProgress(null)
      }

      const res = await fetch('/api/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: daExtensao ? 'files' : source,
          profile_url: daExtensao ? null : source === 'profile' ? profileUrl.trim() : null,
          limit: count,
          sort_by: sortBy,
          videos,
          template_config: readActiveTemplate(),
          options: {
            replace_template: replaceTemplate,
            subtitles,
            subtitle_preset: subtitlePreset || null,
            remove_silence: removeSilence,
            speed,
            hflip,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.batch_id) throw new Error(data.error || 'Não foi possível iniciar o lote.')
      try { localStorage.setItem(ACTIVE_BATCH_KEY, data.batch_id) } catch {}
      if (daExtensao) consumirExtensao()
      setBatch(null)
      setBatchId(data.batch_id)
      setFiles([])
    } catch (e: any) {
      setError(e.message || 'Falha ao iniciar a edição em massa.')
    } finally {
      setStarting(false)
      setUploadProgress(null)
    }
  }

  function newBatch() {
    try { localStorage.removeItem(ACTIVE_BATCH_KEY) } catch {}
    setBatchId(null)
    setBatch(null)
  }

  const doneCount = batch?.items.filter(i => i.status === 'done').length ?? 0
  const failedCount = batch?.items.filter(i => i.status === 'failed').length ?? 0
  const totalItems = batch?.items.length ?? 0
  const finished = batch?.status === 'done' || batch?.status === 'failed'

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0c]">
      <div className="max-w-3xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center mx-auto text-white mb-4 shadow-lg shadow-indigo-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white text-balance">Um perfil inteiro com o seu template</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Cole o link de um perfil do Instagram, TikTok, Facebook ou YouTube. Baixamos os vídeos e cada um sai com a sua identidade, título e legenda — sem limite de quantidade.
          </p>
        </div>

        {batchId ? (
          <section className="space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {finished ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {!batch || batch.status === 'listing'
                        ? 'Buscando os vídeos do perfil…'
                        : batch.status === 'processing'
                        ? `Editando ${doneCount + failedCount + 1 > totalItems ? totalItems : doneCount + failedCount + 1} de ${totalItems}`
                        : batch.status === 'failed'
                        ? 'O lote parou'
                        : 'Lote concluído'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {batch?.profile_url || (totalItems ? `${doneCount} prontos${failedCount ? ` · ${failedCount} com erro` : ''}` : 'Preparando…')}
                    </p>
                  </div>
                </div>
                {finished && (
                  <button type="button" onClick={newBatch} className={pill(false)}>
                    Novo lote
                  </button>
                )}
              </div>

              {totalItems > 0 && (
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round(((doneCount + failedCount) / totalItems) * 100)}%` }}
                  />
                </div>
              )}

              {batch?.status === 'failed' && batch.error && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-semibold">O Instagram bloqueia a listagem automática de perfis sem login (Erro 429).</strong>
                      <p className="text-zinc-300 leading-relaxed text-xs">
                        Para proteger as contas, o Instagram exige cookies de autenticação para listar páginas inteiras a partir do servidor. Escolha uma das soluções abaixo:
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowExtractorModal(true)}
                      className="p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-left transition-all cursor-pointer"
                    >
                      <span className="font-semibold text-purple-300 block text-xs">🧩 Extensão do Clipost (recomendado)</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">Baixa os Reels do perfil com o seu login do navegador, sem bloqueio.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try { localStorage.setItem('clippost_bulk_aba', 'editor') } catch {}
                        window.location.reload()
                      }}
                      className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-left transition-all cursor-pointer"
                    >
                      <span className="font-semibold text-white block text-xs">📁 Enviar Arquivos no Editor</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">Arraste os vídeos baixados no seu PC para aplicar o template sem bloqueio.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCookieModal(true)}
                      className="p-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-left transition-all cursor-pointer"
                    >
                      <span className="font-semibold text-indigo-300 block text-xs">🍪 Conectar Cookies</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">Libera a listagem automática direta pelo servidor.</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono pt-1">Detalhes técnicos: {batch.error}</p>
                </div>
              )}
            </div>

            {batch?.items.length ? (
              <ul className="space-y-2">
                {batch.items.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                    <div className="w-10 h-14 rounded-lg bg-white/[0.04] overflow-hidden shrink-0 flex items-center justify-center">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileVideo className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.title || item.url}</p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {item.status === 'failed'
                          ? item.error || 'Falhou'
                          : [
                              formatCount(item.view_count) && `${formatCount(item.view_count)} views`,
                              formatCount(item.like_count) && `${formatCount(item.like_count)} curtidas`,
                              item.template_replaced && 'template trocado',
                            ].filter(Boolean).join(' · ') || ' '}
                      </p>
                    </div>
                    {item.status === 'done' && item.project_id ? (
                      <Link
                        href={`/project/${item.project_id}`}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-semibold text-white flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 fill-current" /> Abrir
                      </Link>
                    ) : item.status === 'processing' ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : item.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <span className="text-[10px] text-zinc-600 font-mono uppercase">Na fila</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : (
          <>
            {/* lista que a extensão montou no Instagram */}
            {listaExtensao && (
              <section className="rounded-2xl bg-indigo-500/[0.07] border border-indigo-500/25 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{listaExtensao.itens.length} vídeos de @{listaExtensao.usuario} recebidos da extensão</p>
                    <p className="text-[11px] text-zinc-400">Eles saem com o seu template e as opções abaixo. Os links do Instagram valem por algumas horas: comece logo.</p>
                  </div>
                  <button type="button" onClick={consumirExtensao} className="text-[11px] text-zinc-500 hover:text-white shrink-0">Descartar</button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {listaExtensao.itens.slice(0, 14).map(i => (
                    <div key={i.permalink} className="w-12 h-[84px] rounded-lg bg-white/[0.04] overflow-hidden shrink-0" title={i.title}>
                      {i.thumbnail && <img src={i.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    </div>
                  ))}
                  {listaExtensao.itens.length > 14 && <span className="text-[11px] text-zinc-500 self-center px-2">+{listaExtensao.itens.length - 14}</span>}
                </div>
                <button type="button" onClick={() => start(listaExtensao)} disabled={starting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-xs font-semibold disabled:opacity-50">
                  {starting ? 'Enviando…' : `Editar os ${listaExtensao.itens.length} vídeos com o meu template`}
                </button>
              </section>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-zinc-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-zinc-400" />
                <span>{error}</span>
              </div>
            )}

            {source === 'profile' ? (
              <section className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label htmlFor="bulk-profile" className="text-xs font-medium text-zinc-300">
                      Link do perfil ou Links diretos de Reels/Vídeos (um por linha)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowExtractorModal(true)}
                        className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Como copiar 10+ reels do perfil em 1 clique"
                      >
                        🧩 Extensão do Instagram{extensaoInstalada ? ' ✓' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCookieModal(true)}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        🍪 Cookies
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      id="bulk-profile"
                      rows={2}
                      value={profileUrl}
                      onChange={e => setProfileUrl(e.target.value)}
                      placeholder="Cole o link do perfil (ex: instagram.com/perfil) OU múltiplos links de Reels (um por linha)..."
                      className="w-full p-3 rounded-xl bg-[#121216] border border-white/[0.1] text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Você pode colar o perfil inteiro (TikTok, YouTube, Instagram) ou uma lista de links de Reels individuais.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-300">Quantos vídeos</span>
                  <div className="flex flex-wrap gap-2">
                    {COUNT_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setCount(opt.value)} className={pill(count === opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-300">Ordenar por</span>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setSortBy(opt.value)} className={pill(sortBy === opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
                  className="border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]"
                >
                  <UploadCloud className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">Clique ou arraste os vídeos aqui</p>
                  <p className="text-[11px] text-zinc-500 mt-1">MP4 ou MOV · quantos quiser</p>
                  <input ref={fileRef} type="file" accept="video/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <ul className="space-y-1.5">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2">
                        <FileVideo className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span className="text-xs text-white truncate flex-1">{f.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06]"
                          aria-label={`Remover ${f.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">Estúdio</h3>
                </div>
                <Link href="/templates" className="text-[11px] text-zinc-400 hover:text-white underline-offset-2 hover:underline">
                  Editar meu template
                </Link>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Wand2 className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">Trocar o template de outras páginas</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">A IA detecta vídeos que já vêm com moldura de outra página, recorta só o vídeo e aplica o seu template.</p>
                  </div>
                </div>
                <LiquidToggle checked={replaceTemplate} onChange={setReplaceTemplate} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-white">Legendas automáticas</p>
                    <p className="text-[11px] text-zinc-500">Transcreve a fala e queima a legenda no vídeo.</p>
                  </div>
                  <LiquidToggle checked={subtitles} onChange={setSubtitles} />
                </div>
                {subtitles && (
                  <div className="flex flex-wrap gap-2">
                    {SUBTITLE_OPTIONS.map(opt => (
                      <button key={opt.id || 'template'} type="button" onClick={() => setSubtitlePreset(opt.id)} className={pill(subtitlePreset === opt.id)}>
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-white">Remover pausas e silêncios</p>
                  <p className="text-[11px] text-zinc-500">Deixa o ritmo mais rápido.</p>
                </div>
                <LiquidToggle checked={removeSilence} onChange={setRemoveSilence} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-white">Espelhar vídeo</p>
                  <p className="text-[11px] text-zinc-500">Inverte a imagem horizontalmente.</p>
                </div>
                <LiquidToggle checked={hflip} onChange={setHflip} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-white">Velocidade</p>
                <div className="flex gap-2">
                  {SPEED_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => setSpeed(s)} className={pill(speed === s)}>
                      {s.toLocaleString('pt-BR')}x
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => start()}
              disabled={starting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress || 'Iniciando…'}
                </>
              ) : source === 'profile' ? (
                <>
                  <Layers className="w-4 h-4" /> Editar {count ? `${count} vídeos` : 'todos os vídeos'} do perfil
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" /> Editar {files.length || ''} {files.length === 1 ? 'vídeo' : 'vídeos'}
                </>
              )}
            </button>
          </>
        )}
      </div>
    
      {showExtractorModal && <ModalExtensao instalada={extensaoInstalada} fechar={() => setShowExtractorModal(false)} />}

      {/* MODAL DE COOKIES DO INSTAGRAM */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121218] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="text-lg">🍪</span>
                <h3 className="text-sm font-bold text-white">Conectar Cookies do Instagram</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCookieModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              O Instagram exige login para robôs listarem perfis completos sem o erro 429. Cole o conteúdo do arquivo <code>cookies.txt</code> do seu navegador (exportado via extensão como <em>Get cookies.txt LOCALLY</em>) abaixo:
            </p>

            <textarea
              rows={6}
              value={cookieInput}
              onChange={e => setCookieInput(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;.instagram.com	TRUE	/	TRUE	...	sessionid	..."
              className="w-full p-3 rounded-xl bg-[#09090c] border border-white/[0.1] text-zinc-200 text-[11px] font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />

            {cookieMsg && (
              <p className={`text-xs p-2.5 rounded-lg ${cookieMsg.includes('sucesso') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {cookieMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCookieModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCookies}
                disabled={savingCookies || !cookieInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                {savingCookies ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Salvar Cookies no Servidor</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
