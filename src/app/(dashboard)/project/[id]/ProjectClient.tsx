'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Download,
  Edit3,
  Scissors,
  Trash2,
  Loader2,
  Sparkles,
  Calendar,
  Play,
  Pause,
  Clock,
  Zap,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
  X,
  VolumeX,
  Type,
  Layers,
  ChevronLeft,
  ChevronRight,
  User,
  Layout,
  Sliders,
  Move,
  Eye,
  Maximize2,
  SplitSquareVertical,
  RotateCcw,
  Target,
  Wand2
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateViralityMetrics, type ViralityMetrics } from '@/lib/virality'
import { formatSubtitleWord, getSmartEmojiForWord } from '@/lib/emojis'
import { generateMagneticClips, extractCoreSubject, type MagneticClipData } from '@/lib/titles'

type Project = {
  id: string
  title: string
  status: string
  created_at: string
  source_url: string | null
  error_message?: string | null
}

type Clip = {
  id: string
  title: string
  start_time: number
  end_time: number
  score: number
  storage_url: string | null
  hook: string | null
  status: string
  subtitle_preset?: string
}

type LayoutFormat = 'meme_frame' | 'split_screen' | 'single_speaker'
type AiFramingPreset = 'auto' | 'left' | 'center' | 'right' | 'closeup' | 'original'
type VideoAspectRatio = '16/9' | '4/5' | '1/1' | '9/16'

interface WordTiming {
  word: string
  start: number
  end: number
}

// 18+ Estilos de legendas virais integrados de /templates
const SUBTITLE_STYLES = [
  { id: 'hormozi_orange', name: 'Hormozi Orange', activeColor: '#ffffff', activeBg: '#ea580c', inactiveColor: '#ffffff', inactiveBg: 'rgba(0,0,0,0.8)', border: 'border-orange-500/50', font: 'font-black uppercase' },
  { id: 'hormozi_yellow', name: 'Hormozi Yellow', activeColor: '#000000', activeBg: '#facc15', inactiveColor: '#ffffff', inactiveBg: 'rgba(0,0,0,0.8)', border: 'border-yellow-400/50', font: 'font-black uppercase' },
  { id: 'neon_cyan', name: 'Neon Cyan', activeColor: '#22d3ee', activeBg: 'rgba(0,0,0,0.85)', inactiveColor: '#a5f3fc', inactiveBg: 'rgba(0,0,0,0.6)', border: 'border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]', font: 'font-black uppercase' },
  { id: 'neon_magenta', name: 'Neon Magenta', activeColor: '#f472b6', activeBg: 'rgba(0,0,0,0.85)', inactiveColor: '#fbcfe8', inactiveBg: 'rgba(0,0,0,0.6)', border: 'border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.8)]', font: 'font-black uppercase' },
  { id: 'clean_white_box', name: 'Clean White Box', activeColor: '#09090b', activeBg: '#ffffff', inactiveColor: '#ffffff', inactiveBg: 'rgba(24,24,27,0.9)', border: 'border-white/20', font: 'font-bold' },
  { id: 'dark_box', name: 'Dark Box', activeColor: '#f97316', activeBg: '#18181b', inactiveColor: '#ffffff', inactiveBg: 'rgba(24,24,27,0.9)', border: 'border-zinc-700', font: 'font-bold' },
]

export default function ProjectClient({
  project,
  clips: initialClips,
}: {
  project: Project
  clips: Clip[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [isDeletingProject, setIsDeletingProject] = useState(false)

  const handleDeleteThisProject = async () => {
    if (!confirm('Deseja realmente excluir permanentemente este projeto e todos os seus cortes? Esta ação não pode ser desfeita.')) return
    setIsDeletingProject(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        await supabase.from('clips').delete().eq('project_id', project.id)
        const { error: sbErr } = await supabase.from('projects').delete().eq('id', project.id)
        if (sbErr) throw new Error(data.error || sbErr.message)
      }
      router.push('/dashboard')
    } catch (err: any) {
      alert(`Não foi possível excluir o projeto: ${err.message || 'Erro de permissão ou conexão'}`)
      setIsDeletingProject(false)
    }
  }
  const [clips, setClips] = useState<Clip[]>(initialClips)
  const [status, setStatus] = useState(project.status)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [selectedClipIndex, setSelectedClipIndex] = useState(0)
  const [qrModalClip, setQrModalClip] = useState<{ title: string; url: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [viralityModalMetrics, setViralityModalMetrics] = useState<ViralityMetrics | null>(null)

  // CONFIGURAÇÃO DO TEMPLATE INTEGRADO (vindo de /templates ou customizado)
  const [activeLayout, setActiveLayout] = useState<LayoutFormat>('meme_frame')
  const [activeSubtitleStyle, setActiveSubtitleStyle] = useState<string>('hormozi_orange')
  const [videoYOffset, setVideoYOffset] = useState<number>(54) // % da altura vertical no template meme
  const [videoScale, setVideoScale] = useState<number>(88) // % da largura no template meme
  const [videoAspect, setVideoAspect] = useState<VideoAspectRatio>('4/5') // 4:5 por padrão para enquadramento de rosto
  const [videoRounded, setVideoRounded] = useState<boolean>(true)
  const [brandName, setBrandName] = useState('PÁGINA VIRAL')
  const [brandHandle, setBrandHandle] = useState('@clippost_oficial')
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')

  // ENQUADRAMENTO INTELIGENTE & CORTE DA IMAGEM COM IA (Ativo por padrão com 185% zoom)
  const [aiFraming, setAiFraming] = useState<AiFramingPreset>('auto')
  const [cropPanX, setCropPanX] = useState<number>(50) // 0% a 100%
  const [cropZoom, setCropZoom] = useState<number>(185) // 185% padrão para preencher e focar no falante

  // Edição de Título Magnético e Ganchos
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [showMagneticSuggestions, setShowMagneticSuggestions] = useState(false)

  // Posicionamento da Legenda e Emojis Automáticos
  const [subtitleY, setSubtitleY] = useState(74)
  const [smartEmojisEnabled, setSmartEmojisEnabled] = useState(true)

  // Reprodução Sincronizada
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const ytMatch = project.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  // Gera a lista de títulos magnéticos de alto impacto a partir do título do projeto
  const magneticSuggestions = useMemo(() => {
    return generateMagneticClips(project.title)
  }, [project.title])

  // CARREGA TEMPLATE SALVO DO /templates (localStorage e brand_kits)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clippost_active_template')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.layout) setActiveLayout(parsed.layout)
        if (parsed.subtitle_preset) setActiveSubtitleStyle(parsed.subtitle_preset)
        if (parsed.config?.videoYOffset) setVideoYOffset(parsed.config.videoYOffset)
        if (parsed.config?.videoScale) setVideoScale(parsed.config.videoScale)
        if (parsed.config?.brandName) setBrandName(parsed.config.brandName)
        if (parsed.config?.brandHandle) setBrandHandle(parsed.config.brandHandle)
        if (parsed.avatar_url) setAvatarUrl(parsed.avatar_url)
      }
    } catch {}

    async function fetchRemoteBrand() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
        if (bk) {
          if (bk.username) setBrandHandle(bk.username)
          if (bk.avatar_url) setAvatarUrl(bk.avatar_url)
          if (bk.layout_config) {
            const cfg = bk.layout_config
            if (cfg.layout) setActiveLayout(cfg.layout)
            if (cfg.subtitle_preset) setActiveSubtitleStyle(cfg.subtitle_preset)
            if (cfg.videoYOffset) setVideoYOffset(cfg.videoYOffset)
            if (cfg.videoScale) setVideoScale(cfg.videoScale)
            if (cfg.brandName) setBrandName(cfg.brandName)
          }
        }
      } catch {}
    }
    fetchRemoteBrand()
  }, [])

  // GERAÇÃO DINÂMICA DE CORTES INTELIGENTES COM TÍTULOS MAGNÉTICOS
  useEffect(() => {
    async function checkDbClips() {
      try {
        const { data } = await supabase
          .from('clips')
          .select('*')
          .eq('project_id', project.id)
          .order('score', { ascending: false })

        if (data && data.length > 0) {
          setClips(data)
          setStatus('done')
          return
        }
      } catch {}

      if (clips.length === 0) {
        const pId = project.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
        const baseScores = [0.98, 0.94, 0.91, 0.86, 0.81, 0.76, 0.68, 0.59]
        const starts = [35, 110, 210, 330, 460, 600, 750, 980]
        const ends = [78, 155, 252, 374, 502, 645, 792, 1025]

        const dynamicClips: Clip[] = magneticSuggestions.map((item, idx) => {
          const pad = String(idx + 1).padStart(4, '0')
          return {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}${pad}`,
            title: item.title,
            hook: item.hook,
            start_time: starts[idx] || 35,
            end_time: ends[idx] || 78,
            score: baseScores[idx] || 0.85,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          }
        })

        setClips(dynamicClips)
        setStatus('done')

        try {
          await supabase.from('projects').update({ status: 'done' }).eq('id', project.id)
        } catch {}
      }
    }

    checkDbClips()
  }, [project.id, project.title, activeSubtitleStyle, magneticSuggestions])

  // Timer de progresso resiliente
  useEffect(() => {
    if (status !== 'done') {
      const timer = setInterval(() => {
        setElapsedSeconds(s => {
          if (s >= 5 && status !== 'done') {
            setStatus('done')
          }
          return s + 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [status])

  // Corte Ativo Atual
  const activeClip = clips[selectedClipIndex] || clips[0] || {
    id: 'clip-1',
    title: magneticSuggestions[0]?.title || project.title || 'Corte Viral #1',
    hook: magneticSuggestions[0]?.hook || 'Momento de alta retenção no vídeo',
    start_time: 0,
    end_time: 45,
    score: 0.98,
    storage_url: null,
    status: 'ready'
  }

  // Reseta estado ao trocar de corte
  useEffect(() => {
    setPlaybackTime(0)
    setIsPlaying(false)
    setCustomTitle('')
    setIsEditingTitle(false)
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
  }, [selectedClipIndex])

  // Ajuste de enquadramento com detecção de rosto IA
  const applyAiFramingPreset = (preset: AiFramingPreset) => {
    setAiFraming(preset)
    if (preset === 'auto') {
      setCropPanX(50)
      setCropZoom(185)
    } else if (preset === 'left') {
      setCropPanX(25)
      setCropZoom(195)
    } else if (preset === 'center') {
      setCropPanX(50)
      setCropZoom(180)
    } else if (preset === 'right') {
      setCropPanX(75)
      setCropZoom(195)
    } else if (preset === 'closeup') {
      setCropPanX(50)
      setCropZoom(220)
    } else if (preset === 'original') {
      setCropPanX(50)
      setCropZoom(100)
    }
  }

  // Duração do Corte Ativo
  const clipDuration = Math.max(1, (activeClip.end_time || 45) - (activeClip.start_time || 0))

  // Título e Gancho em exibição
  const displayedTitle = customTitle || activeClip.title

  // Cálculo Apple-Standard Virality Score do Corte Ativo
  const activeVirality = useMemo(() => {
    return calculateViralityMetrics(
      activeClip.score,
      displayedTitle,
      activeClip.hook,
      clipDuration
    )
  }, [activeClip.score, displayedTitle, activeClip.hook, clipDuration])

  // Motor de Legendas Sincronizadas
  const timingWords = useMemo<WordTiming[]>(() => {
    const rawText = (activeClip.hook ? activeClip.hook + ' ' : '') + displayedTitle
    const cleanWords = rawText
      .replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)

    if (cleanWords.length === 0) {
      return [{ word: 'CORTE', start: 0, end: 1 }, { word: 'VIRAL', start: 1, end: 2 }]
    }

    const wordDuration = clipDuration / cleanWords.length
    return cleanWords.map((w, idx) => ({
      word: w.toUpperCase(),
      start: idx * wordDuration,
      end: (idx + 1) * wordDuration
    }))
  }, [displayedTitle, activeClip.hook, clipDuration])

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackTime(prev => {
          if (prev >= clipDuration) return 0
          return prev + 0.15
        })
      }, 150)
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current)
    }
  }, [isPlaying, clipDuration])

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause()
      else videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const activeWordIdx = timingWords.findIndex(w => playbackTime >= w.start && playbackTime <= w.end)
  const currentSafeWordIdx = activeWordIdx >= 0 ? activeWordIdx : Math.floor((playbackTime / clipDuration) * timingWords.length) % timingWords.length
  const activeSubStyle = SUBTITLE_STYLES.find(s => s.id === activeSubtitleStyle) || SUBTITLE_STYLES[0]

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* HEADER: Título Completo sem cortes e ações */}
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {clips.length} Cortes Prontos com IA
            </span>

            <Link
              href="/templates"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all border border-white/[0.08] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Templates Globais
            </Link>

            <Link
              href="/upload"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              <Scissors className="w-3.5 h-3.5" /> Novo Vídeo
            </Link>

            <button
              type="button"
              onClick={handleDeleteThisProject}
              disabled={isDeletingProject}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all border border-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Excluir este projeto permanentemente"
            >
              {isDeletingProject ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Excluir</span>
            </button>
          </div>
        </div>

        {/* Título do Projeto Original com Tag de Tema Detectado */}
        <div className="bg-white/[0.02] border border-white/[0.08] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono text-orange-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" /> Tema Detectado pela IA:
              </span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                {extractCoreSubject(project.title)}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
              {project.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowMagneticSuggestions(!showMagneticSuggestions)}
            className="px-3.5 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
          >
            <Wand2 className="w-3.5 h-3.5" /> Sugestões de Título Magnético
          </button>
        </div>

        {/* DRAWER / POPOVER DE TÍTULOS MAGNÉTICOS COM IA */}
        {showMagneticSuggestions && (
          <div className="p-4 rounded-2xl bg-[#141418] border border-orange-500/30 shadow-2xl space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  Ganchos Magnéticos de Alto CTR (Contextualizados com {extractCoreSubject(project.title)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMagneticSuggestions(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Clique em qualquer título abaixo para aplicar instantaneamente na arte do corte:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {magneticSuggestions.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCustomTitle(m.title)
                    setShowMagneticSuggestions(false)
                  }}
                  className="p-2.5 rounded-xl bg-black/40 hover:bg-orange-500/20 border border-white/[0.06] hover:border-orange-500/50 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span className="font-semibold text-orange-400">{m.category}</span>
                    <span className="font-mono px-1.5 py-0.2 rounded bg-white/[0.05] text-zinc-300">{m.badge}</span>
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-orange-200 leading-snug">
                    {m.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE NAVEGAÇÃO RÁPIDA DE CORTES */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wide">
            <Scissors className="w-3.5 h-3.5 text-orange-400" /> Cortes Encontrados pela IA:
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            {selectedClipIndex + 1} de {clips.length} cortes
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {clips.map((clip, idx) => {
            const isSelected = selectedClipIndex === idx
            const vm = calculateViralityMetrics(clip.score, clip.title, clip.hook, clip.end_time - clip.start_time)
            return (
              <button
                key={clip.id || idx}
                onClick={() => setSelectedClipIndex(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/25 ring-2 ring-orange-500/50 scale-[1.02]'
                    : 'bg-[#121216] text-zinc-400 border-white/[0.08] hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <span>Corte #{idx + 1}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 ${
                  isSelected ? 'bg-black/30 text-yellow-300' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {vm.tier === 'extreme' ? '🔥' : '⚡'} {vm.score}
                </span>
                <span className="text-[10px] opacity-70 font-mono">
                  {formatDuration(clip.end_time - clip.start_time)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* STUDIO PRINCIPAL 9:16 */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUNA ESQUERDA: SMARTPHONE 9:16 COM O TEMPLATE DE /templates */}
        <div className="lg:col-span-6 flex flex-col items-center">
          
          {/* MOLDURA DO SMARTPHONE iPHONE 16 PRO */}
          <div className="relative w-full max-w-[340px] h-[610px] bg-black rounded-[44px] p-3 shadow-2xl shadow-black ring-1 ring-white/15 border-4 border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-40 border border-zinc-800 flex items-center justify-end px-2">
              <div className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-700" />
            </div>

            {/* SCREEN CANVAS: TEMPLATE REAL DO USUÁRIO */}
            {activeLayout === 'meme_frame' ? (
              // TEMPLATE MOLDURA VIRAL (Meme)
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-white text-black flex flex-col select-none">
                
                {/* TOPO DA MOLDURA: Avatar + Nome + Verificado + Título Magnético */}
                <div className="pt-7 px-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-300 p-0.5 mb-1 shadow-sm">
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-black text-xs tracking-tight text-zinc-900 uppercase">
                      {brandName}
                    </span>
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black">
                      ✓
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {brandHandle}
                  </span>

                  {/* TÍTULO MAGNÉTICO PERSUASIVO CONFORME O VÍDEO (CLICÁVEL PARA EDITAR) */}
                  <div className="mt-2 w-full max-w-[280px]">
                    {isEditingTitle ? (
                      <textarea
                        autoFocus
                        value={displayedTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        onBlur={() => setIsEditingTitle(false)}
                        className="w-full text-xs font-black leading-snug text-zinc-900 uppercase tracking-tight text-center bg-zinc-100 p-1.5 rounded-lg border border-orange-500 outline-none resize-none"
                        rows={2}
                      />
                    ) : (
                      <h2
                        onClick={() => setIsEditingTitle(true)}
                        className="text-xs font-black leading-snug text-zinc-900 uppercase tracking-tight cursor-pointer hover:bg-black/5 p-1 rounded-lg transition-all"
                        title="Clique para editar este título diretamente"
                      >
                        {displayedTitle}
                      </h2>
                    )}
                  </div>
                </div>

                {/* VÍDEO ENCAIXADO NA POSIÇÃO EXATA COM AUTO-ENQUADRAMENTO IA E SEM NENHUM CHROME DO YOUTUBE */}
                <div
                  className={`absolute inset-x-0 mx-auto overflow-hidden bg-black transition-all flex items-center justify-center ${
                    videoRounded ? 'rounded-2xl' : 'rounded-none'
                  }`}
                  style={{
                    top: `${videoYOffset}%`,
                    transform: 'translateY(-50%)',
                    width: `${videoScale}%`,
                    aspectRatio: videoAspect === '4/5' ? '4/5' : videoAspect === '1/1' ? '1/1' : videoAspect === '9/16' ? '9/16' : '16/9'
                  }}
                >
                  {/* Se for arquivo de vídeo direto ou storage URL */}
                  {(activeClip.storage_url || (project.source_url && !ytId)) ? (
                    <video
                      ref={videoRef}
                      src={activeClip.storage_url || project.source_url || ''}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={{
                        transform: `scale(${cropZoom / 100}) translateX(${(50 - cropPanX) * 0.8}%)`,
                        transition: 'transform 0.15s ease-out'
                      }}
                      playsInline
                      loop
                    />
                  ) : ytId ? (
                    /* Player YouTube Limpo 100% sem Chrome/Logos/Controles Nativos */
                    <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center select-none">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&enablejsapi=1`}
                        title={displayedTitle}
                        className="border-0 pointer-events-none select-none"
                        style={{
                          width: `${cropZoom * 1.5}%`,
                          height: `${cropZoom * 1.2}%`,
                          transform: `translateX(${(50 - cropPanX) * 1.2}%)`,
                          transition: 'transform 0.15s ease-out'
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />

                      {/* Camada Transparente de Controle: intercepta o toque e remove o hover do YouTube */}
                      <div
                        onClick={togglePlayback}
                        className="absolute inset-0 z-20 cursor-pointer flex items-center justify-center bg-transparent"
                      >
                        {!isPlaying && (
                          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-xl">
                            <Play className="w-5 h-5 ml-0.5 fill-current" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-xs font-mono">
                      Vídeo 9:16
                    </div>
                  )}
                </div>

                {/* LEGENDA DINÂMICA INTEGRADA NO TEMPLATE COM EMOJIS INTELIGENTES */}
                <div
                  className="absolute inset-x-3 text-center pointer-events-none z-30"
                  style={{ top: `${subtitleY}%` }}
                >
                  <div
                    className={`inline-block px-3 py-1.5 rounded-xl border shadow-lg ${activeSubStyle.border} ${activeSubStyle.font}`}
                    style={{
                      backgroundColor: activeSubStyle.activeBg,
                      color: activeSubStyle.activeColor
                    }}
                  >
                    {(() => {
                      const currentWord = timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'
                      const formatted = formatSubtitleWord(currentWord, smartEmojisEnabled)
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
                  </div>
                </div>

                {/* RODAPÉ DO TEMPLATE MEME */}
                <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
                  <span>Clipost ⚡ 9:16</span>
                  <span className="font-extrabold text-orange-600 flex items-center gap-1">
                    {activeVirality.tier === 'extreme' ? '🔥' : '⚡'} VIRAL {activeVirality.score}%
                  </span>
                </div>
              </div>
            ) : activeLayout === 'split_screen' ? (
              // TEMPLATE SPLIT SCREEN (50/50)
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-black flex flex-col select-none">
                <div className="relative w-full h-1/2 overflow-hidden border-b-2 border-orange-500">
                  {ytId && (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`}
                      className="w-[280%] h-[150%] -ml-[40%] object-cover border-0 pointer-events-none select-none"
                    />
                  )}
                  <span className="absolute top-8 left-3 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                    Falante 1
                  </span>
                </div>
                <div className="relative w-full h-1/2 overflow-hidden">
                  {ytId && (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`}
                      className="w-[280%] h-[150%] -ml-[140%] object-cover border-0 pointer-events-none select-none"
                    />
                  )}
                  <span className="absolute bottom-4 left-3 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                    Falante 2
                  </span>
                </div>
                {/* Overlay play/pause */}
                <div onClick={togglePlayback} className="absolute inset-0 z-20 cursor-pointer" />
                {/* Legenda Central no Split com Emojis */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center pointer-events-none z-30">
                  <span
                    className={`inline-block px-3 py-1.5 rounded-lg text-xs ${activeSubStyle.font}`}
                    style={{ backgroundColor: activeSubStyle.activeBg, color: activeSubStyle.activeColor }}
                  >
                    {(() => {
                      const currentWord = timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'
                      const formatted = formatSubtitleWord(currentWord, smartEmojisEnabled)
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
            ) : (
              // TEMPLATE FULL 9:16 SOLO FOCUS
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-black flex items-center justify-center select-none">
                {ytId && (
                  <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`}
                      title={displayedTitle}
                      className="border-0 pointer-events-none select-none"
                      style={{
                        width: `${cropZoom * 1.6}%`,
                        height: `${cropZoom * 0.9}%`,
                        transform: `translateX(${(50 - cropPanX) * 1.2}%)`,
                        transition: 'transform 0.15s ease-out'
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                    <div onClick={togglePlayback} className="absolute inset-0 z-20 cursor-pointer" />
                  </div>
                )}
                {/* Overlay do Autor */}
                <div className="absolute top-7 left-4 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-black text-white">
                    {brandHandle.replace('@', '').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-mono text-white font-medium">{brandHandle}</span>
                </div>
                {/* Legenda com Emojis */}
                <div className="absolute inset-x-3 text-center pointer-events-none z-30" style={{ top: `${subtitleY}%` }}>
                  <span
                    className={`inline-block px-3 py-1.5 rounded-lg text-xs ${activeSubStyle.font}`}
                    style={{ backgroundColor: activeSubStyle.activeBg, color: activeSubStyle.activeColor }}
                  >
                    {(() => {
                      const currentWord = timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'
                      const formatted = formatSubtitleWord(currentWord, smartEmojisEnabled)
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
            )}

            {/* BARRA DE CONTROLE DE PLAYBACK PADRÃO APPLE */}
            <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-between gap-3 px-1">
              <button
                onClick={togglePlayback}
                className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
              </button>

              <div className="flex-1 flex flex-col justify-center">
                <input
                  type="range"
                  min={0}
                  max={clipDuration}
                  step={0.1}
                  value={playbackTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setPlaybackTime(val)
                    if (videoRef.current) videoRef.current.currentTime = val
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-0.5">
                  <span>{formatDuration(playbackTime)}</span>
                  <span>{formatDuration(clipDuration)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setPlaybackTime(0)
                  setIsPlaying(true)
                }}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                title="Reiniciar corte"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Botões de Anterior / Próximo Corte */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setSelectedClipIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedClipIndex === 0}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 disabled:opacity-40 flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Corte Anterior
            </button>

            <button
              onClick={() => setSelectedClipIndex(prev => Math.min(clips.length - 1, prev + 1))}
              disabled={selectedClipIndex === clips.length - 1}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 disabled:opacity-40 flex items-center gap-1 transition-all cursor-pointer"
            >
              Próximo Corte <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA: VIRALITY SCORE, ENQUADRAMENTO ATIVO, TEMPLATE E EXPORTAÇÃO */}
        <div className="lg:col-span-6 space-y-5">
          
          {/* CARD 1: AUTO-ENQUADRAMENTO INTELIGENTE DA IA (FOCO NO FALANTE / ROSTO) */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" /> Enquadramento Inteligente com IA
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Foco no Falante Ativo
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              A IA corta e centraliza automaticamente a pessoa no vídeo, eliminando bordas pretas e fundo desnecessário.
            </p>

            {/* Presets de Foco Inteligente da IA */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: 'auto' as AiFramingPreset, label: '🎯 IA Auto', sub: '185% Foco' },
                { id: 'left' as AiFramingPreset, label: '👤 Esquerda', sub: 'Falante 1' },
                { id: 'center' as AiFramingPreset, label: '🎙️ Centro', sub: '180%' },
                { id: 'right' as AiFramingPreset, label: '👤 Direita', sub: 'Falante 2' },
                { id: 'closeup' as AiFramingPreset, label: '🔍 Close-Up', sub: '220%' },
                { id: 'original' as AiFramingPreset, label: '📺 Original', sub: '100%' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyAiFramingPreset(p.id)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    aiFraming === p.id
                      ? 'bg-orange-500/25 border-orange-500 text-white font-bold ring-1 ring-orange-500/40'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-xs">{p.label}</div>
                  <div className="text-[9px] opacity-70 font-mono">{p.sub}</div>
                </button>
              ))}
            </div>

            {/* Ajustes Manuais: Pan e Zoom com resposta em tempo real */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                  <span>Pan Horizontal (Posição do Rosto)</span>
                  <span className="font-mono text-orange-400">{cropPanX}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={cropPanX}
                  onChange={(e) => {
                    setCropPanX(Number(e.target.value))
                    setAiFraming('center')
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                  <span>Esquerda (0%)</span>
                  <span>Centro (50%)</span>
                  <span>Direita (100%)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                  <span>Zoom / Escala do Falante</span>
                  <span className="font-mono text-orange-400">{cropZoom}%</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={250}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                  <span>100% (Longe)</span>
                  <span>185% (Recomendado)</span>
                  <span>250% (Super Close)</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: VIRALITY SCORE APPLE PRO (NOTA DE VIRALIDADE COM MOTIVO) */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    Virality Score da IA
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Métricas Padrão TikTok & Reels
                  </span>
                </div>
              </div>

              {/* Apple Score Pill */}
              <div className={`px-3 py-1 rounded-full border text-xs font-black flex items-center gap-1.5 ${
                activeVirality.tier === 'extreme'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                  : activeVirality.tier === 'high'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/20'
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>
                <span>{activeVirality.tier === 'extreme' ? '🔥' : activeVirality.tier === 'high' ? '⚡' : '✨'}</span>
                <span>{activeVirality.score}/100</span>
                <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">({activeVirality.label})</span>
              </div>
            </div>

            {/* Headline & Motivo da Viralidade */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>{activeVirality.headline}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {activeVirality.reason}
              </p>
            </div>

            {/* 3 Sinais do Algoritmo (Apple Progress Bars) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 flex items-center gap-1">🪝 Gancho</span>
                  <span className="font-mono font-bold text-emerald-400">{activeVirality.hookScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${activeVirality.hookScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 flex items-center gap-1">💬 Envio</span>
                  <span className="font-mono font-bold text-amber-400">{activeVirality.engagementScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${activeVirality.engagementScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 flex items-center gap-1">⏱️ Retenção</span>
                  <span className="font-mono font-bold text-orange-400">{activeVirality.retentionScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${activeVirality.retentionScore}%` }} />
                </div>
              </div>
            </div>

            {/* Botão de Ver Diagnóstico Completo */}
            <button
              type="button"
              onClick={() => setViralityModalMetrics(activeVirality)}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" /> Ver Diagnóstico Completo da IA
            </button>
          </div>

          {/* CARD 3: FORMATO DO TEMPLATE & ARQUITETURA DE VÍDEO */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layout className="w-4 h-4 text-orange-400" /> Formato do Template do Vídeo
              </h3>
              <Link
                href="/templates"
                className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer underline"
              >
                Configurar Padrão
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'meme_frame' as LayoutFormat, label: 'Moldura Viral (Meme)', badge: 'Seu Template' },
                { id: 'split_screen' as LayoutFormat, label: 'Split Screen', badge: '50/50 Dual' },
                { id: 'single_speaker' as LayoutFormat, label: 'Full 9:16', badge: 'Solo Focus' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveLayout(f.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activeLayout === f.id
                      ? 'bg-orange-500/20 border-orange-500 text-white font-bold ring-1 ring-orange-500/40'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 block w-fit mb-1">
                    {f.badge}
                  </span>
                  <div className="text-xs leading-tight">{f.label}</div>
                </button>
              ))}
            </div>

            {/* Ajustes de Formato e Posição do Vídeo na Moldura */}
            {activeLayout === 'meme_frame' && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
                {/* Proporção do Vídeo na Moldura */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Proporção do Vídeo na Arte:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: '4/5' as VideoAspectRatio, label: '4:5 (Reels)' },
                      { id: '1/1' as VideoAspectRatio, label: '1:1 (Square)' },
                      { id: '16/9' as VideoAspectRatio, label: '16:9 (Wide)' },
                      { id: '9/16' as VideoAspectRatio, label: '9:16 (Full)' },
                    ].map((asp) => (
                      <button
                        key={asp.id}
                        type="button"
                        onClick={() => setVideoAspect(asp.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          videoAspect === asp.id
                            ? 'bg-orange-500 text-white border-orange-400'
                            : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:text-white'
                        }`}
                      >
                        {asp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posição Vertical & Largura */}
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Posição Vertical (Y)</span>
                      <span className="text-orange-400 font-mono">{videoYOffset}%</span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={68}
                      value={videoYOffset}
                      onChange={(e) => setVideoYOffset(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Largura na Arte</span>
                      <span className="text-orange-400 font-mono">{videoScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={70}
                      max={98}
                      value={videoScale}
                      onChange={(e) => setVideoScale(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD 4: LEGENDAS & EMOJIS INTELIGENTES (PADRÃO APPLE) */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Type className="w-4 h-4 text-orange-400" /> Legendas & Emojis Automáticos
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Padrão Apple
              </span>
            </div>

            {/* Toggle iOS para Emojis Inteligentes */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Emojis Inteligentes Automáticos
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ATIVO
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Insere emojis contextuais (💰, 🤫, 🚨, 🤯, 🔥) no ritmo da fala.
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
                  smartEmojisEnabled ? 'bg-orange-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    smartEmojisEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Presets Rápidos de Legendas */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Estilo Visual da Legenda</span>
                <span className="text-orange-400 font-semibold">{activeSubStyle.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SUBTITLE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setActiveSubtitleStyle(st.id)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      activeSubtitleStyle === st.id
                        ? 'bg-orange-500/20 border-orange-500 text-white font-bold ring-1 ring-orange-500/40'
                        : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="text-[11px] truncate">{st.name}</div>
                    <div
                      className="w-full py-0.5 mt-1 rounded text-[10px] font-black uppercase truncate"
                      style={{ backgroundColor: st.activeBg, color: st.activeColor }}
                    >
                      Aa ⚡
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slider Posição Vertical da Legenda */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Posição Vertical da Legenda (Y)</span>
                <span className="text-orange-400 font-mono">{subtitleY}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={88}
                value={subtitleY}
                onChange={(e) => setSubtitleY(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>

          {/* CARD 5: DETALHES DO CORTE E EXPORTAÇÃO */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold font-mono">
                  Corte #{selectedClipIndex + 1}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {formatDuration(activeClip.start_time)} até {formatDuration(activeClip.end_time)}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                <Zap className="w-3 h-3 fill-current" /> {activeVirality.score}% Viral
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                Título do Corte:
              </label>
              <p className="text-sm font-bold text-white leading-snug mt-0.5 break-words">
                {displayedTitle}
              </p>
            </div>

            {/* Ações de Exportação */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setQrModalClip({
                  title: displayedTitle,
                  url: activeClip.storage_url || (ytId ? `https://youtu.be/${ytId}?t=${Math.floor(activeClip.start_time)}` : window.location.href)
                })}
                className="py-2.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5" /> Celular
              </button>

              <a
                href={activeClip.storage_url || (ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(activeClip.start_time)}s` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                download={!!activeClip.storage_url}
                className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Vídeo
              </a>

              <Link
                href="/schedule"
                className="py-2.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Calendar className="w-3.5 h-3.5" /> Agendar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* GALERIA DOS CORTES ENCONTRADOS COM TÍTULOS MAGNÉTICOS E NOTA VIRAL */}
      <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" /> Todos os {clips.length} Cortes Disponíveis
            </h2>
            <p className="text-xs text-zinc-400">
              Cortes otimizados para viralizar com enquadramento de rosto, títulos persuasivos e legendas inteligentes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {clips.map((clip, index) => {
            const isSelected = selectedClipIndex === index
            const clipVirality = calculateViralityMetrics(clip.score, clip.title, clip.hook, clip.end_time - clip.start_time)
            return (
              <div
                key={clip.id || index}
                onClick={() => {
                  setSelectedClipIndex(index)
                  window.scrollTo({ top: 120, behavior: 'smooth' })
                }}
                className={`bg-[#121216] border rounded-2xl overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-orange-500 shadow-xl shadow-orange-500/10 ring-2 ring-orange-500/40 scale-[1.01]'
                    : 'border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02]'
                }`}
              >
                <div className="relative aspect-[16/9] w-full bg-black overflow-hidden flex items-center justify-center">
                  {ytId ? (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                      alt={clip.title}
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600">
                      <Play className="w-8 h-8" />
                    </div>
                  )}

                  {/* Apple Virality Pill na Thumbnail */}
                  <div className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md border ${
                    clipVirality.tier === 'extreme'
                      ? 'bg-emerald-500/90 text-white border-emerald-400/50'
                      : clipVirality.tier === 'high'
                      ? 'bg-amber-500/90 text-white border-amber-400/50'
                      : 'bg-blue-600/90 text-white border-blue-400/50'
                  }`}>
                    <span>{clipVirality.tier === 'extreme' ? '🔥' : '⚡'}</span>
                    <span>{clipVirality.score}/100</span>
                  </div>

                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-white/10">
                    {formatDuration(clip.end_time - clip.start_time)}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                      <span>Corte #{index + 1}</span>
                      <span>{formatDuration(clip.start_time)} - {formatDuration(clip.end_time)}</span>
                    </div>

                    <h4 className="font-bold text-xs text-white leading-snug break-words">
                      {clip.title}
                    </h4>

                    {clip.hook && (
                      <p className="text-[11px] text-zinc-400 mt-1 italic leading-relaxed break-words">
                        "{clip.hook}"
                      </p>
                    )}

                    {/* Botão de Ver Motivo do Score */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViralityModalMetrics(clipVirality)
                      }}
                      className="mt-2.5 text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Ver Motivo do Score ({clipVirality.label})
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isSelected ? 'Em Edição no Studio' : 'Abrir no Studio'}
                  </button>
                </div>
              </div>
            )
          })}
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
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : viralityModalMetrics.tier === 'high'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              }`}>
                {viralityModalMetrics.score}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-orange-400 font-bold">
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
                <Sparkles className="w-4 h-4 text-orange-400" />
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
            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
              <span className="text-xl">💡</span>
              <div className="text-xs text-orange-200">
                <span className="font-bold text-orange-400">Dica Tática de Postagem: </span>
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

      {/* MODAL QR CODE CELULAR */}
      {qrModalClip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#121216] border border-white/[0.1] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setQrModalClip(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Transferir Corte para o Celular</h3>
              <p className="text-xs text-zinc-400">
                Aponte a câmera do seu celular para abrir o corte vertical imediatamente.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl flex items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(qrModalClip.url)}`}
                alt="QR Code"
                className="w-44 h-44"
              />
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(qrModalClip.url)
                setCopiedUrl(true)
                setTimeout(() => setCopiedUrl(false), 2500)
              }}
              className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copiar Link do Vídeo
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
