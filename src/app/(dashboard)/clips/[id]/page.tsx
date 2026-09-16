'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
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
  CheckCircle2
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'

type SubtitleStyle = 'hormozi_yellow' | 'neon_glow' | 'clean_box' | 'minimal_apple'

interface WordItem {
  id: string
  word: string
  start: number
  end: number
}

const STYLES_CAROUSEL = [
  {
    id: 'hormozi_yellow' as SubtitleStyle,
    name: 'Hormozi Viral',
    accentColor: '#FACC15',
    bgColor: 'rgba(0,0,0,0.85)',
    border: 'border-yellow-400/40',
    font: 'font-black uppercase',
    desc: 'Amarelo neon com borda preta grossa.'
  },
  {
    id: 'neon_glow' as SubtitleStyle,
    name: 'Neon Glow',
    accentColor: '#06B6D4',
    bgColor: 'rgba(0,0,0,0.85)',
    border: 'border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]',
    font: 'font-extrabold uppercase',
    desc: 'Brilho ciano fluorescente.'
  },
  {
    id: 'clean_box' as SubtitleStyle,
    name: 'Clean Box',
    accentColor: '#FFFFFF',
    bgColor: 'rgba(24,24,27,0.95)',
    border: 'border-white/10',
    font: 'font-semibold',
    desc: 'Caixa arredondada escura e discreta.'
  },
  {
    id: 'minimal_apple' as SubtitleStyle,
    name: 'Minimal Apple',
    accentColor: '#F4F4F5',
    bgColor: 'transparent',
    border: 'border-transparent drop-shadow-md',
    font: 'font-sans font-medium',
    desc: 'Design limpo sem caixa pesada.'
  }
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
  const [error, setError] = useState('')

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

      const { data: clipData, error: clipErr } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipId)
        .single()

      if (clipErr || !clipData) {
        setError('Clipe não encontrado.')
        setLoading(false)
        return
      }

      setClip(clipData)
      if (clipData.subtitle_preset) setSelectedStyle(clipData.subtitle_preset as SubtitleStyle)

      // Fetch parent project to get transcript
      if (clipData.project_id) {
        const { data: projData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', clipData.project_id)
          .single()

        if (projData) {
          setProject(projData)
          // Extract words matching clip start/end
          const rawWords = projData.transcript?.words || []
          const clipWords: WordItem[] = rawWords
            .filter((w: any) => w.start >= clipData.start_time - 0.5 && w.end <= clipData.end_time + 0.5)
            .map((w: any, idx: number) => ({
              id: `w-${idx}`,
              word: w.word || w.text || '',
              start: w.start,
              end: w.end
            }))

          if (clipWords.length > 0) {
            setWords(clipWords)
          } else {
            // Mock sample words if transcript words not granular
            setWords([
              { id: 'w-1', word: 'ESTE', start: 0, end: 1 },
              { id: 'w-2', word: 'MOMENTO', start: 1, end: 2 },
              { id: 'w-3', word: 'É', start: 2, end: 2.5 },
              { id: 'w-4', word: 'SIMPLESMENTE', start: 2.5, end: 3.5 },
              { id: 'w-5', word: 'SURREAL', start: 3.5, end: 4.5 },
            ])
          }
        }
      }

      // Fetch user profile username
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: bk } = await supabase
          .from('brand_kits')
          .select('username')
          .eq('user_id', user.id)
          .maybeSingle()
        if (bk?.username) setUsername(bk.username)
      }

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

  const handleSaveAndRerender = async () => {
    setSaving(true)
    setError('')
    setSavedSuccess(false)

    try {
      // 1. Update clip record in Supabase
      await supabase
        .from('clips')
        .update({
          subtitle_preset: selectedStyle,
          hook: clip.title,
        })
        .eq('id', clipId)

      // 2. Call backend re-render endpoint if available
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
      await fetch(`${apiUrl}/api/clips/${clipId}/re-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitle_preset: selectedStyle,
          subtitle_y: subtitleY,
          words: words.map(w => ({ word: w.word, start: w.start, end: w.end })),
        })
      }).catch(() => null)

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      setError('Erro ao salvar alterações: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Active word in current playback
  const activeWord = words.find(
    w => currentTime >= (w.start - (clip?.start_time || 0)) && currentTime <= (w.end - (clip?.start_time || 0))
  )

  const activeStyleObj = STYLES_CAROUSEL.find(s => s.id === selectedStyle) || STYLES_CAROUSEL[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
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
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all border border-white/[0.08]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold uppercase tracking-wider">
                Editor Rápido
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {clip && formatDuration(clip.end_time - clip.start_time)}
              </span>
            </div>
            <h1 className="text-lg lg:text-xl font-bold text-white line-clamp-1">
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
              Enviar para Celular
            </button>
          )}
          {clip?.storage_url && (
            <a
              href={clip.storage_url}
              download
              className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Vídeo
            </a>
          )}
          <button
            onClick={handleSaveAndRerender}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {saving ? 'Aplicando...' : savedSuccess ? 'Salvo!' : 'Salvar Alterações'}
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
                <video
                  ref={videoRef}
                  src={clip.storage_url}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-cover"
                  playsInline
                  loop
                />
              ) : (
                <div className="text-zinc-600 text-xs">Sem prévia disponível</div>
              )}

              {/* Author Badge Overlay */}
              {showAuthor && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-orange-500/80 flex items-center justify-center text-[8px] font-bold">
                    C
                  </div>
                  <span className="text-[10px] font-mono text-white/90 font-medium">
                    {username}
                  </span>
                </div>
              )}

              {/* Dynamic Caption Overlay */}
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
                    style={{ color: activeStyleObj.accentColor }}
                  >
                    {activeWord ? activeWord.word : (words[0]?.word || 'LEGENDA DINÂMICA')}
                  </span>
                </div>
              </div>

              {/* Play/Pause Center Button Overlay */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white/90 hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Bottom Carousel of 1-Click Styles */}
          <div className="w-full max-w-[420px] mt-6 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs font-semibold text-zinc-300 block mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Estilo de Legenda (1-Clique)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLES_CAROUSEL.map((st) => {
                const isCurrent = selectedStyle === st.id
                return (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStyle(st.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      isCurrent
                        ? 'bg-orange-500/15 border-orange-500/50 shadow-md ring-1 ring-orange-500/40'
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
                      Aa
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Word-by-word Transcript Editor & Layout Controls */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Transcript Word-by-Word Editor */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-orange-400" /> Edição de Palavras do Transcrito
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Clique em qualquer palavra para corrigir erros da IA ou pontuação.
                </p>
              </div>
            </div>

            {/* Words Pill Cloud */}
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-black/40 rounded-xl border border-white/[0.05]">
              {words.map((item) => {
                const isEditing = editingWordId === item.id
                const isCurrent = activeWord?.id === item.id

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
                      className="px-2 py-1 rounded bg-orange-500/20 border border-orange-500 text-xs text-white font-mono outline-none"
                    />
                    <button
                      onClick={() => handleSaveWordEdit(item.id)}
                      className="p-1 rounded bg-orange-500 text-white text-[10px]"
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                      isCurrent
                        ? 'bg-orange-500 text-white border-orange-400 font-bold scale-105 shadow-md shadow-orange-500/20'
                        : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {item.word}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subtitle Vertical Position Control */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-orange-400" /> Posicionamento da Legenda no Vídeo
            </h2>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-300 font-medium">Altura Vertical (Y)</span>
                <span className="text-xs font-mono text-orange-400">{subtitleY}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                value={subtitleY}
                onChange={(e) => setSubtitleY(Number(e.target.value))}
                className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
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
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  showAuthor ? 'bg-orange-500' : 'bg-zinc-800'
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
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{clip.title}</p>
            </div>

            {/* QR CODE BOX */}
            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(clip.storage_url)}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed px-2">
              Aponte a câmera do seu <strong>iPhone ou Android</strong> para salvar o vídeo 9:16 direto na sua galeria sem passar pelo computador!
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (clip.storage_url) navigator.clipboard.writeText(clip.storage_url)
                  setCopiedUrl(true)
                  setTimeout(() => setCopiedUrl(false), 2000)
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Copiado!' : 'Copiar Link'}
              </button>
              <a
                href={clip.storage_url}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}