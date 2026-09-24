'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Check,
  RefreshCw,
  Play,
  Pause,
  Clock,
  Sliders,
  Type,
  Smartphone,
  Copy,
  ExternalLink,
  X,
  User,
  Download,
  Calendar,
  Zap,
  Edit3,
  Trash2,
  CheckCircle2,
  Eye
} from 'lucide-react'
import { formatDuration, downloadVideoFile } from '@/lib/utils'
import Link from 'next/link'
import { calculateViralityMetrics, type ViralityMetrics } from '@/lib/virality'
import { formatSubtitleWord, getSmartEmojiForWord } from '@/lib/emojis'

type SubtitleStyle = 'hormozi_yellow' | 'hormozi_orange' | 'clean_white' | 'dark_box' | 'neon_cyan' | 'neon_magenta' | 'neon_glow' | 'clean_box' | 'minimal_apple'
  | 'karaoke_amarelo' | 'karaoke_roxo' | 'palavra_unica' | 'revelacao' | 'pop_branco' | 'caixa_pop' | 'fade_suave'

interface WordItem {
  id: string
  word: string
  start: number
  end: number
}

const STYLES_CAROUSEL = [
  {
    id: 'hormozi_yellow' as SubtitleStyle,
    name: 'Hormozi Amarelo',
    accentColor: '#FACC15',
    textColor: '#000000',
    bgColor: '#facc15',
    border: 'border-yellow-400',
    font: 'font-black uppercase',
    desc: 'Amarelo ouro com texto preto (Mais Viral).'
  },
  {
    id: 'hormozi_orange' as SubtitleStyle,
    name: 'Hormozi Laranja',
    accentColor: '#EA580C',
    textColor: '#ffffff',
    bgColor: '#ea580c',
    border: 'border-orange-500',
    font: 'font-black uppercase',
    desc: 'Caixa laranja vibrante com texto branco.'
  },
  {
    id: 'clean_white' as SubtitleStyle,
    name: 'Clean White',
    accentColor: '#FFFFFF',
    textColor: '#09090b',
    bgColor: '#ffffff',
    border: 'border-white',
    font: 'font-black uppercase',
    desc: 'Caixa branca pura com texto escuro.'
  },
  {
    id: 'dark_box' as SubtitleStyle,
    name: 'Dark Box',
    accentColor: '#F97316',
    textColor: '#f97316',
    bgColor: '#18181b',
    border: 'border-zinc-700',
    font: 'font-black uppercase',
    desc: 'Caixa escura de alto contraste com texto laranja.'
  },
  {
    id: 'neon_cyan' as SubtitleStyle,
    name: 'Neon Cyan',
    accentColor: '#22D3EE',
    textColor: '#22d3ee',
    bgColor: 'rgba(0,0,0,0.85)',
    border: 'border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.5)]',
    font: 'font-extrabold uppercase',
    desc: 'Brilho ciano fluorescente tech.'
  },
  {
    id: 'neon_magenta' as SubtitleStyle,
    name: 'Neon Magenta',
    accentColor: '#F472B6',
    textColor: '#f472b6',
    bgColor: 'rgba(0,0,0,0.85)',
    border: 'border-pink-400/50 shadow-[0_0_12px_rgba(236,72,153,0.5)]',
    font: 'font-extrabold uppercase',
    desc: 'Rosa neon vibrante de alto hype.'
  },
  {
    id: 'neon_glow' as SubtitleStyle,
    name: 'Neon Glow',
    accentColor: '#06B6D4',
    textColor: '#06b6d4',
    bgColor: 'rgba(0,0,0,0.85)',
    border: 'border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]',
    font: 'font-extrabold uppercase',
    desc: 'Brilho ciano fluorescente.'
  },
  {
    id: 'clean_box' as SubtitleStyle,
    name: 'Clean Box',
    accentColor: '#FFFFFF',
    textColor: '#ffffff',
    bgColor: 'rgba(24,24,27,0.95)',
    border: 'border-white/10',
    font: 'font-semibold',
    desc: 'Caixa arredondada escura e discreta.'
  },
  {
    id: 'minimal_apple' as SubtitleStyle,
    name: 'Minimal Apple',
    accentColor: '#F4F4F5',
    textColor: '#f4f4f5',
    bgColor: 'transparent',
    border: 'border-transparent drop-shadow-md',
    font: 'font-sans font-medium',
    desc: 'Design limpo sem caixa pesada.'
  },
  ...([
    ['karaoke_amarelo', 'Karaokê Amarelo', '#FACC15', '#ffffff', 'A palavra falada acende em amarelo.'],
    ['karaoke_roxo', 'Karaokê Roxo', '#A855F7', '#ffffff', 'A palavra falada acende em roxo.'],
    ['palavra_unica', 'Palavra Única', '#FACC15', '#facc15', 'Uma palavra por vez, grande, com pop.'],
    ['revelacao', 'Revelação', '#FFFFFF', '#ffffff', 'As palavras surgem conforme são faladas.'],
    ['pop_branco', 'Pop Branco', '#FFFFFF', '#ffffff', 'Cada bloco entra com um salto.'],
    ['caixa_pop', 'Caixa Pop', '#FACC15', '#000000', 'Caixa amarela que salta a cada bloco.'],
    ['fade_suave', 'Fade Suave', '#F4F4F5', '#f4f4f5', 'Entrada suave e minimalista.'],
  ] as const).map(([id, name, accentColor, textColor, desc]) => ({
    id: id as SubtitleStyle,
    name,
    accentColor,
    textColor,
    bgColor: id === 'caixa_pop' ? '#facc15' : 'rgba(0,0,0,0.85)',
    border: 'border-indigo-500/40',
    font: 'font-black uppercase',
    desc: `${desc} (animada)`,
  })),
]

export default function ClipEditorPage() {
  const params = useParams()
  const router = useRouter()
  const clipId = params.id as string

  const [clip, setClip] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showMobileQr, setShowMobileQr] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isRerendering, setIsRerendering] = useState(false)
  const [error, setError] = useState('')
  const [viralityModalMetrics, setViralityModalMetrics] = useState<ViralityMetrics | null>(null)
  const [smartEmojisEnabled, setSmartEmojisEnabled] = useState(true)

  const ytMatch = project?.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  // Editor states
  const [selectedStyle, setSelectedStyle] = useState<SubtitleStyle>('hormozi_yellow')
  const [subtitleY, setSubtitleY] = useState(80) // percentage
  const [showAuthor, setShowAuthor] = useState(true)
  const [username, setUsername] = useState('@seuperfil')
  const [words, setWords] = useState<WordItem[]>([])
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editWordText, setEditWordText] = useState('')

  // Video playback
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    async function loadClipData() {
      if (!clipId) return
      setLoading(true)

      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clipId)
      let clipData = null
      if (isValidUuid) {
        try {
          const { data } = await supabase
            .from('clips')
            .select('*')
            .eq('id', clipId)
            .maybeSingle()
          clipData = data
        } catch {}
      }

      if (!clipData) {
        setClip({
          id: clipId,
          title: 'Corte Viral - Momento de Alta Retenção',
          start_time: 42,
          end_time: 87,
          score: 0.96,
          status: 'ready',
          storage_url: null
        })
        setWords([
          { id: '1', word: 'O', start: 42.0, end: 42.3 },
          { id: '2', word: 'MOMENTO', start: 42.3, end: 42.9 },
          { id: '3', word: 'QUE', start: 42.9, end: 43.1 },
          { id: '4', word: 'O', start: 43.1, end: 43.3 },
          { id: '5', word: 'SEGREDO', start: 43.3, end: 43.8 },
          { id: '6', word: 'FOI', start: 43.8, end: 44.1 },
          { id: '7', word: 'REVELADO', start: 44.1, end: 44.8 },
          { id: '8', word: 'COM', start: 44.8, end: 45.1 },
          { id: '9', word: 'MUITO', start: 45.1, end: 45.4 },
          { id: '10', word: 'LUCRO', start: 45.4, end: 46.0 }
        ])
      } else {
        setClip(clipData)
        if (clipData.subtitle_preset && STYLES_CAROUSEL.some(s => s.id === clipData.subtitle_preset)) {
          setSelectedStyle(clipData.subtitle_preset as SubtitleStyle)
        }

        // Buscar projeto pai
        if (clipData.project_id) {
          try {
            const { data: proj } = await supabase
              .from('projects')
              .select('*')
              .eq('id', clipData.project_id)
              .maybeSingle()
            if (proj) setProject(proj)
          } catch {}
        }

        // Simula ou mapeia palavras do clipe
        const wordsArr: WordItem[] = [
          { id: '1', word: 'O', start: (clipData.start_time || 0) + 0.1, end: (clipData.start_time || 0) + 0.4 },
          { id: '2', word: 'SEGREDO', start: (clipData.start_time || 0) + 0.4, end: (clipData.start_time || 0) + 1.0 },
          { id: '3', word: 'QUE', start: (clipData.start_time || 0) + 1.0, end: (clipData.start_time || 0) + 1.2 },
          { id: '4', word: 'TODOS', start: (clipData.start_time || 0) + 1.2, end: (clipData.start_time || 0) + 1.6 },
          { id: '5', word: 'ESPERAVAM', start: (clipData.start_time || 0) + 1.6, end: (clipData.start_time || 0) + 2.3 }
        ]
        setWords(wordsArr)
      }

      // Buscar perfil
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: bk } = await supabase
            .from('brand_kits')
            .select('username')
            .eq('user_id', user.id)
            .maybeSingle()
          if (bk?.username) setUsername(bk.username)
        }
      } catch {}

      setLoading(false)
    }

    loadClipData()
  }, [clipId])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSaveWordEdit = (id: string) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, word: editWordText } : w))
    setEditingWordId(null)
  }

  const handleDownloadVideo = async () => {
    if (!clip?.storage_url) return
    setDownloading(true)
    const fname = `corte_${clip.title ? clip.title.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_') : clipId}.mp4`
    await downloadVideoFile(clip.storage_url, fname)
    setDownloading(false)
  }

  // Polling para detectar quando a re-renderização do backend estiver concluída
  useEffect(() => {
    if (!isRerendering || !clipId) return

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('clips')
          .select('*')
          .eq('id', clipId)
          .maybeSingle()

        if (data) {
          if (data.status === 'ready' && data.storage_url) {
            // Adiciona timestamp para forçar recarregamento do player de vídeo
            const cacheBusterUrl = data.storage_url.includes('?')
              ? `${data.storage_url}&t=${Date.now()}`
              : `${data.storage_url}?t=${Date.now()}`
            setClip({ ...data, storage_url: cacheBusterUrl })
            setIsRerendering(false)
            setSaving(false)
            setSavedSuccess(true)
            setTimeout(() => setSavedSuccess(false), 4000)
            clearInterval(interval)
          } else if (data.status === 'failed') {
            setError('Falha ao processar novo vídeo no backend. Tente novamente.')
            setIsRerendering(false)
            setSaving(false)
            clearInterval(interval)
          }
        }
      } catch (e) {
        console.error('Erro no polling de re-render:', e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isRerendering, clipId, supabase])

  const handleSaveAndRerender = async () => {
    setSaving(true)
    setIsRerendering(true)
    setError('')
    setSavedSuccess(false)

    try {
      await supabase
        .from('clips')
        .update({
          subtitle_preset: selectedStyle,
          hook: clip.title,
        })
        .eq('id', clipId)

      const rerenderRes = await fetch(`/api/clips/${clipId}/re-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitle_preset: selectedStyle,
          subtitle_y: subtitleY,
          smart_emojis: smartEmojisEnabled,
          // pass null so backend uses the project's real transcript words
          words: null,
        })
      })
      if (!rerenderRes.ok) {
        const errData = await rerenderRes.json().catch(() => ({}))
        throw new Error(errData.detail || errData.error || 'Erro no re-render')
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      setError('Erro ao salvar alterações: ' + err.message)
      setIsRerendering(false)
    } finally {
      setSaving(false)
    }
  }

  // Active word in current playback
  const activeWord = words.find(
    w => currentTime >= (w.start - (clip?.start_time || 0)) && currentTime <= (w.end - (clip?.start_time || 0))
  )

  const activeStyleObj = STYLES_CAROUSEL.find(s => s.id === selectedStyle) || STYLES_CAROUSEL[0]

  const viralityMetrics = useMemo(() => {
    if (!clip) return null
    return calculateViralityMetrics(
      clip.score,
      clip.title,
      clip.hook,
      (clip.end_time || 30) - (clip.start_time || 0)
    )
  }, [clip])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all border border-white/[0.08] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-wider">
                Editor Rápido
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {clip && formatDuration(clip.end_time - clip.start_time)}
              </span>

              {/* Apple Virality Pill */}
              {viralityMetrics && (
                <button
                  type="button"
                  onClick={() => setViralityModalMetrics(viralityMetrics)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer border ${
                    viralityMetrics.tier === 'extreme'
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : viralityMetrics.tier === 'high'
                      ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                      : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  }`}
                >
                  <span>{viralityMetrics.tier === 'extreme' ? '🔥' : '⚡'}</span>
                  <span>{viralityMetrics.score}/100</span>
                  <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">({viralityMetrics.label})</span>
                </button>
              )}
            </div>
            <h1 className="text-lg lg:text-xl font-bold text-white leading-snug break-words mt-1">
              {clip?.title || 'Editor de Clipe'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {clip?.storage_url && (
            <button
              type="button"
              onClick={() => setShowMobileQr(true)}
              className="px-4 py-2 text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-purple-950/40"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Celular
            </button>
          )}
          {clip?.storage_url && (
            <button
              type="button"
              onClick={handleDownloadVideo}
              disabled={downloading}
              className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloading ? 'Baixando...' : 'Baixar Vídeo'}</span>
            </button>
          )}
          <button
            onClick={handleSaveAndRerender}
            disabled={saving || isRerendering}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving || isRerendering ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5 text-indigo-300" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isRerendering ? 'Renderizando corte...' : saving ? 'Aplicando...' : savedSuccess ? 'Salvo!' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: 9:16 Video Player with Overlays & Carousel */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Smartphone 9:16 Container */}
          <div className="relative w-[310px] h-[550px] bg-black rounded-[40px] p-2.5 shadow-2xl shadow-black ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
            <div className="relative flex-1 w-full rounded-[30px] overflow-hidden bg-black flex items-center justify-center">
              {clip?.storage_url ? (
                <>
                  <video
                    ref={videoRef}
                    key={clip.storage_url}
                    src={clip.storage_url}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-full object-cover"
                    playsInline
                    loop
                  />
                  {isRerendering && (
                    <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                      <span className="text-sm font-bold text-white tracking-wide">Re-renderizando Vídeo 9:16</span>
                      <span className="text-xs text-zinc-400 font-mono mt-1">Aplicando novo estilo e legendas dinâmicas...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#0c0a1a] via-[#161233] to-[#251b4d] flex flex-col items-center justify-center p-4 text-center select-none">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center mb-2 animate-pulse">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide">Vídeo 9:16</span>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Renderizando corte nativo...</span>
                </div>
              )}

              {/* Author Badge Overlay */}
              {showAuthor && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/80 flex items-center justify-center text-[8px] font-bold">
                    C
                  </div>
                  <span className="text-[10px] font-mono text-white/90 font-medium">
                    {username}
                  </span>
                </div>
              )}

              {/* Dynamic Caption Overlay com Emojis Inteligentes */}
              <div
                className="absolute inset-x-3 text-center z-20 pointer-events-none transition-all duration-150"
                style={{ top: `${subtitleY}%` }}
              >
                <div
                  className={`inline-block px-3 py-1.5 rounded-xl border ${activeStyleObj.border}`}
                  style={{ backgroundColor: activeStyleObj.bgColor }}
                >
                  <span
                    className={`text-xs ${activeStyleObj.font}`}
                    style={{ color: (activeStyleObj as any).textColor || activeStyleObj.accentColor }}
                  >
                    {(() => {
                      const rawWord = activeWord ? activeWord.word : (words[0]?.word || 'LEGENDA DINÂMICA')
                      const formatted = formatSubtitleWord(rawWord, smartEmojisEnabled)
                      return (
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span>{formatted.displayWord}</span>
                          {formatted.emoji && (
                            <span className="text-base select-none animate-bounce inline-block">
                              {formatted.emoji}
                            </span>
                          )}
                        </span>
                      )
                    })()}
                  </span>
                </div>
              </div>

              {/* Play/Pause Center Button Overlay */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white/90 hover:scale-105 transition-transform cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Bottom Carousel of 1-Click Styles */}
          <div className="w-full max-w-[420px] mt-6 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs font-semibold text-zinc-300 block mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Estilo de Legenda (1-Clique)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLES_CAROUSEL.map((st) => {
                const isCurrent = selectedStyle === st.id
                return (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStyle(st.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-500/15 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-white truncate w-full">
                      {st.name}
                    </span>
                    <div
                      className="w-full py-1 rounded bg-black/50 text-[10px] font-bold uppercase truncate"
                      style={{ color: st.accentColor }}
                    >
                      Aa ⚡
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Virality Card, Subtitles Controls & Word-by-word Transcript */}
        <div className="lg:col-span-6 flex flex-col gap-6">

          {/* Virality Score Card Apple Pro */}
          {viralityMetrics && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Virality Score da IA
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Algoritmo de Retenção & Engajamento
                    </span>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full border text-xs font-black flex items-center gap-1.5 ${
                  viralityMetrics.tier === 'extreme'
                    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                    : viralityMetrics.tier === 'high'
                    ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                    : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                }`}>
                  <span>{viralityMetrics.tier === 'extreme' ? '🔥' : '⚡'}</span>
                  <span>{viralityMetrics.score}/100</span>
                  <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">({viralityMetrics.label})</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{viralityMetrics.headline}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {viralityMetrics.reason}
                </p>
              </div>

              {/* 3 Sinais do Algoritmo */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">🪝 Gancho</span>
                    <span className="font-mono font-bold text-indigo-400">{viralityMetrics.hookScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${viralityMetrics.hookScore}%` }} />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">💬 Envio</span>
                    <span className="font-mono font-bold text-zinc-400">{viralityMetrics.engagementScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${viralityMetrics.engagementScore}%` }} />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">⏱️ Retenção</span>
                    <span className="font-mono font-bold text-indigo-400">{viralityMetrics.retentionScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${viralityMetrics.retentionScore}%` }} />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViralityModalMetrics(viralityMetrics)}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" /> Ver Diagnóstico Completo da IA
              </button>
            </div>
          )}

          {/* Emojis Inteligentes Toggle Padrão iOS */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Emojis Inteligentes Automáticos
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      PADRÃO APPLE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Insere emojis dinâmicos (💰, 🤫, 🚨, 🤯, 🔥) no ritmo da fala.
                  </p>
                </div>
              </div>

              {/* iOS Switch Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={smartEmojisEnabled}
                onClick={() => setSmartEmojisEnabled(!smartEmojisEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  smartEmojisEnabled ? 'bg-indigo-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    smartEmojisEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Transcript Word-by-Word Editor */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" /> Edição de Palavras do Transcrito
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Clique em qualquer palavra para corrigir texto ou pontuação.
                </p>
              </div>
            </div>

            {/* Words Pill Cloud */}
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-black/40 rounded-xl border border-white/[0.05]">
              {words.map((item) => {
                const isEditing = editingWordId === item.id
                const isCurrent = activeWord?.id === item.id
                const smartEmoji = smartEmojisEnabled ? getSmartEmojiForWord(item.word) : null

                return isEditing ? (
                  <div key={item.id} className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={editWordText}
                      onChange={(e) => setEditWordText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveWordEdit(item.id)
                        if (e.key === 'Escape') setEditingWordId(null)
                      }}
                      className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500 text-xs text-white font-mono outline-none"
                    />
                    <button
                      onClick={() => handleSaveWordEdit(item.id)}
                      className="p-1 rounded bg-indigo-500 text-white text-[10px]"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => {
                      setEditingWordId(item.id)
                      setEditWordText(item.word)
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border flex items-center gap-1 cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-500 text-white border-indigo-400 font-bold scale-105 shadow-md shadow-indigo-500/20'
                        : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span>{item.word}</span>
                    {smartEmoji && (
                      <span className="text-xs select-none">{smartEmoji}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subtitle Vertical Position Control */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-indigo-400" /> Posicionamento da Legenda no Vídeo
            </h2>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-300 font-medium">Altura Vertical (Y)</span>
                <span className="text-xs font-mono text-indigo-400">{subtitleY}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                value={subtitleY}
                onChange={(e) => setSubtitleY(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>Centro (50%)</span>
                <span>Inferior Seguro (80%)</span>
                <span>Rodapé (90%)</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-medium">Exibir @username no topo</span>
              <button
                onClick={() => setShowAuthor(!showAuthor)}
                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                  showAuthor ? 'bg-indigo-500' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    showAuthor ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL APPLE HIG VIRALITY SCORE (MOTIVO COMPLETO) */}
      {viralityModalMetrics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141418] border border-white/[0.12] rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative text-zinc-100 ring-1 ring-white/10">
            <button
              onClick={() => setViralityModalMetrics(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header com Score Ring */}
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border ${
                viralityModalMetrics.tier === 'extreme'
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                  : viralityModalMetrics.tier === 'high'
                  ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40'
                  : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
              }`}>
                {viralityModalMetrics.score}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-indigo-400 font-bold">
                    Diagnóstico de Viralidade
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-semibold border border-white/[0.08]">
                    {viralityModalMetrics.label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {viralityModalMetrics.headline}
                </h3>
              </div>
            </div>

            {/* O Motivo Principal (IA Reason) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Por que este corte tem alta probabilidade de viralizar:</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {viralityModalMetrics.reason}
              </p>
            </div>

            {/* As 3 Métricas Detalhadas */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Sinais do Algoritmo:
              </span>
              {viralityModalMetrics.keyFactors.map((kf, i) => (
                <div key={i} className="p-3 rounded-xl bg-black/40 border border-white/[0.05] flex items-start gap-3">
                  <span className="text-lg select-none">{kf.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{kf.title}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{kf.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dica de Ação */}
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3">
              <span className="text-xl">💡</span>
              <div className="text-xs text-indigo-200">
                <span className="font-bold text-indigo-400">Dica Tática de Postagem: </span>
                {viralityModalMetrics.actionTip}
              </div>
            </div>

            {/* Fechar */}
            <button
              type="button"
              onClick={() => setViralityModalMetrics(null)}
              className="w-full py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR PARA O CELULAR (ESTILO LOCALSEND) */}
      {showMobileQr && clip?.storage_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <button
              onClick={() => setShowMobileQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Enviar para o Celular</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed break-words">{clip.title}</p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(clip.storage_url)}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed px-2">
              Aponte a câmera do seu <strong>iPhone ou Android</strong> para salvar o vídeo 9:16 direto na sua galeria!
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (clip.storage_url) navigator.clipboard.writeText(clip.storage_url)
                  setCopiedUrl(true)
                  setTimeout(() => setCopiedUrl(false), 2000)
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-indigo-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Link Copiado' : 'Copiar Link'}
              </button>
              <a
                href={clip.storage_url}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-xs font-semibold text-purple-300 flex items-center justify-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
