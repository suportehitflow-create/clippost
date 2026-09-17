'use client'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { SweepStepper } from '@/components/ui/SweepStepper'
import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Download,
  Scissors,
  Sparkles,
  Calendar,
  Play,
  Pause,
  Clock,
  Zap,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
  X,
  VolumeX,
  Wifi,
  ChevronLeft,
  ChevronRight,
  Sliders,
  RotateCcw,
  Target,
  Wand2,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  Flame
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateViralityMetrics, type ViralityMetrics } from '@/lib/virality'
import { formatSubtitleWord, getSmartEmojiForWord } from '@/lib/emojis'
import { generateMagneticClips, extractCoreSubject, type MagneticClipData } from '@/lib/titles'


// Renderizador Oficial de Emojis Nativos Apple iOS
function AppleEmojiText({ text, className }: { text: string; className?: string }) {
  if (!text) return null
  const emojiRegex = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u
  const parts = text.split(emojiRegex)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (emojiRegex.test(part)) {
          const codePoints = Array.from(part)
            .map(c => c.codePointAt(0)!.toString(16))
            .filter(c => c !== 'fe0f')
          const hex = codePoints.join('-').toLowerCase()
          return (
            <img
              key={i}
              src={`https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${hex}.png`}
              alt={part}
              className="inline-block w-[1.15em] h-[1.15em] align-[-0.18em] mx-[1px] select-none pointer-events-none"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none'
              }}
            />
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

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

// Presets de legenda limpos no padrão Apple
const SUBTITLE_STYLES = [
  { id: 'hormozi_orange', name: 'Hormozi Laranja', activeColor: '#ffffff', activeBg: '#ea580c', border: 'border-orange-500/40' },
  { id: 'hormozi_yellow', name: 'Hormozi Amarelo', activeColor: '#000000', activeBg: '#facc15', border: 'border-yellow-400/40' },
  { id: 'clean_white_box', name: 'Clean White Box', activeColor: '#09090b', activeBg: '#ffffff', border: 'border-white/40' },
  { id: 'dark_box', name: 'Dark Box', activeColor: '#f97316', activeBg: '#18181b', border: 'border-zinc-700' },
  { id: 'neon_cyan', name: 'Cyan Pro', activeColor: '#000000', activeBg: '#22d3ee', border: 'border-cyan-400/40' },
  { id: 'neon_magenta', name: 'Magenta Pro', activeColor: '#ffffff', activeBg: '#ec4899', border: 'border-pink-500/40' },
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

  const [clips, setClips] = useState<Clip[]>(initialClips)
  const [status, setStatus] = useState(project.status)
  const [selectedClipIndex, setSelectedClipIndex] = useState(0)
  const [qrModalClip, setQrModalClip] = useState<{ title: string; url: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [viralityModalMetrics, setViralityModalMetrics] = useState<ViralityMetrics | null>(null)

  // CONTROLE MINIMALISTA: Painel de Edição minimizado por padrão
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [adjustTab, setAdjustTab] = useState<'subtitles' | 'framing' | 'template'>('subtitles')

  // Configurações do Template (herdados do /templates ou padrão)
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'zinc'>('dark')
  const [activeLayout, setActiveLayout] = useState<LayoutFormat>('meme_frame')
  const [activeSubtitleStyle, setActiveSubtitleStyle] = useState<string>('hormozi_orange')
  const [videoYOffset, setVideoYOffset] = useState<number>(54)
  const [videoScale, setVideoScale] = useState<number>(96)
  const [videoAspect, setVideoAspect] = useState<VideoAspectRatio>('4/5')
  const [videoRounded, setVideoRounded] = useState<boolean>(false)
  const [brandName, setBrandName] = useState('Nome da Página')
  const [brandHandle, setBrandHandle] = useState('@nomedapagina')
  const [brandScale, setBrandScale] = useState<number>(14)
  const DEFAULT_BRAND_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><defs><linearGradient id='cp_grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='50%' stop-color='%238b5cf6'/><stop offset='100%' stop-color='%23ec4899'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23cp_grad)'/><path d='M60 34 A15 15 0 1 0 60 64 A15 15 0 0 0 60 34 Z M40 88 C40 73 50 68 60 68 C70 68 80 73 80 88 Z' fill='white' opacity='0.95'/></svg>"
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_BRAND_AVATAR)

  // Dimensões e Coordenadas do Template
  const [videoWidth, setVideoWidth] = useState<number>(96)
  const [videoHeight, setVideoHeight] = useState<number>(48)
  const [videoPos, setVideoPos] = useState<{ x: number; y: number }>({ x: 50, y: 55 })
  const [headerPos, setHeaderPos] = useState<{ x: number; y: number }>({ x: 50, y: 16 })
  const [titlePos, setTitlePos] = useState<{ x: number; y: number }>({ x: 50, y: 25 })
  const [subtitlePos, setSubtitlePos] = useState<{ x: number; y: number }>({ x: 50, y: 78 })
  const [brandAlign, setBrandAlign] = useState<'center' | 'left' | 'right'>('center')
  const [brandLayout, setBrandLayout] = useState<'row' | 'stacked'>('row')
  const [showVerifiedBadge, setShowVerifiedBadge] = useState<boolean>(true)
  const [fontFamily, setFontFamily] = useState<string>('Inter')
  const [fontSize, setFontSize] = useState<number>(14)
  const [titleColor, setTitleColor] = useState<string>('#ffffff')
  const [titleStroke, setTitleStroke] = useState<string>('none')
  const [titleStrokeColor, setTitleStrokeColor] = useState<string>('#000000')
  const [titleCapsLock, setTitleCapsLock] = useState<boolean>(true)
  const [textAlign, setTextAlign] = useState<'center' | 'left' | 'right'>('center')

  // Enquadramento
  const [aiFraming, setAiFraming] = useState<AiFramingPreset>('auto')
  const [cropPanX, setCropPanX] = useState<number>(50)
  const [cropZoom, setCropZoom] = useState<number>(185)

  // Título e Ganchos
  const [customTitle, setCustomTitle] = useState('')
  const [showMagneticSuggestions, setShowMagneticSuggestions] = useState(false)

  // Legenda
  const [subtitleY, setSubtitleY] = useState(74)
  const [smartEmojisEnabled, setSmartEmojisEnabled] = useState(true)

  // Reprodução
  const [isPlaying, setIsPlaying] = useState(false)
  const [showReelsSafeZone, setShowReelsSafeZone] = useState(false)
  const [showVideoControls, setShowVideoControls] = useState(false)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const ytMatch = project.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  // Ganchos magnéticos calculados
  const magneticSuggestions = useMemo(() => {
    return generateMagneticClips(project.title)
  }, [project.title])

  // Carrega template salvo integrado 100%
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clippost_active_template')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.layout) setActiveLayout(parsed.layout)
        if (parsed.subtitle_preset) setActiveSubtitleStyle(parsed.subtitle_preset)
        if (parsed.avatar_url && !parsed.avatar_url.includes('photo-1514888286974-6c03e2ca1dba')) setAvatarUrl(parsed.avatar_url)
        else setAvatarUrl(DEFAULT_BRAND_AVATAR)
        if (parsed.template_bg) setTemplateBg(parsed.template_bg)
        
        if (parsed.config) {
          const c = parsed.config
          if (c.templateBg) setTemplateBg(c.templateBg)
          if (c.brandName && c.brandName !== 'HUMOR DA IGUANA') setBrandName(c.brandName)
          else setBrandName('Nome da Página')
          if (c.brandHandle && c.brandHandle !== '@humordaiguana') setBrandHandle(c.brandHandle)
          else setBrandHandle('@nomedapagina')
          if (c.videoWidth) {
            setVideoWidth(c.videoWidth)
            setVideoScale(c.videoWidth)
          }
          if (c.videoHeight) setVideoHeight(c.videoHeight)
          if (c.videoPos) setVideoPos(c.videoPos)
          if (c.headerPos) setHeaderPos(c.headerPos)
          if (c.titlePos) setTitlePos(c.titlePos)
          if (c.subtitlePos) setSubtitlePos(c.subtitlePos)
          if (c.brandAlign) setBrandAlign(c.brandAlign)
          if (c.brandLayout) setBrandLayout(c.brandLayout)
          if (c.showVerifiedBadge !== undefined) setShowVerifiedBadge(c.showVerifiedBadge)
          if (c.fontFamily) setFontFamily(c.fontFamily)
          if (c.fontSize) setFontSize(c.fontSize)
          if (c.titleColor) setTitleColor(c.titleColor)
          if (c.titleStroke) setTitleStroke(c.titleStroke)
          if (c.titleStrokeColor) setTitleStrokeColor(c.titleStrokeColor)
          if (c.titleCapsLock !== undefined) setTitleCapsLock(c.titleCapsLock)
          if (c.textAlign) setTextAlign(c.textAlign)
        }
      }
    } catch {}

    async function fetchRemoteBrand() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
        if (bk) {
          if (bk.username && bk.username !== '@humordaiguana') setBrandHandle(bk.username)
          else setBrandHandle('@nomedapagina')
          if (bk.avatar_url && !bk.avatar_url.includes('photo-1514888286974-6c03e2ca1dba')) setAvatarUrl(bk.avatar_url)
          else setAvatarUrl(DEFAULT_BRAND_AVATAR)
          if (bk.layout_config) {
            const cfg = bk.layout_config
            if (cfg.brandName && cfg.brandName !== 'HUMOR DA IGUANA') setBrandName(cfg.brandName)
            else setBrandName('Nome da Página')
            if (cfg.templateBg) setTemplateBg(cfg.templateBg)
            if (cfg.subtitle_preset) setActiveSubtitleStyle(cfg.subtitle_preset)
            if (cfg.videoWidth) {
              setVideoWidth(cfg.videoWidth)
              setVideoScale(cfg.videoWidth)
            }
            if (cfg.videoHeight) setVideoHeight(cfg.videoHeight)
            if (cfg.videoPos) setVideoPos(cfg.videoPos)
            if (cfg.headerPos) setHeaderPos(cfg.headerPos)
            if (cfg.titlePos) setTitlePos(cfg.titlePos)
            if (cfg.subtitlePos) setSubtitlePos(cfg.subtitlePos)
            if (cfg.brandAlign) setBrandAlign(cfg.brandAlign)
            if (cfg.brandLayout) setBrandLayout(cfg.brandLayout)
            if (cfg.fontFamily) setFontFamily(cfg.fontFamily)
            if (cfg.fontSize) setFontSize(cfg.fontSize)
            if (cfg.titleColor) setTitleColor(cfg.titleColor)
            if (cfg.titleStroke) setTitleStroke(cfg.titleStroke)
            if (cfg.titleStrokeColor) setTitleStrokeColor(cfg.titleStrokeColor)
            if (cfg.titleCapsLock !== undefined) setTitleCapsLock(cfg.titleCapsLock)
            if (cfg.textAlign) setTextAlign(cfg.textAlign)
          }
        }
      } catch {}
    }
    fetchRemoteBrand()
  }, [])

  // Inicializa cortes se vazios
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

  const activeClip = clips[selectedClipIndex] || clips[0] || {
    id: 'placeholder',
    title: project.title,
    start_time: 35,
    end_time: 78,
    score: 0.95,
    storage_url: null,
    hook: null,
    status: 'ready'
  }

  // Duração
  const clipDuration = Math.max(1, (activeClip.end_time || 45) - (activeClip.start_time || 0))
  const activeSubStyle = SUBTITLE_STYLES.find(s => s.id === activeSubtitleStyle) || SUBTITLE_STYLES[0]
  const displayedTitle = customTitle || activeClip.title

  // Virality metrics
  const activeVirality = useMemo(() => {
    return calculateViralityMetrics(
      activeClip.score,
      displayedTitle,
      activeClip.hook,
      clipDuration
    )
  }, [activeClip.score, displayedTitle, activeClip.hook, clipDuration])

  // Palavras de transcrição/fala reais para a legenda (SEPARADAS TOTALMENTE DO TÍTULO)
  const speechWords = useMemo<string[]>(() => {
    // Se o corte tiver transcrição de fala real salva no banco, usa ela
    const rawTranscript = (activeClip as any).transcript || (activeClip as any).speech_text
    if (rawTranscript && typeof rawTranscript === 'string') {
      const parsed = rawTranscript.replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '').split(/\s+/).filter(Boolean)
      if (parsed.length > 0) return parsed.map(w => w.toUpperCase())
    }
    // Caso contrário, usa frases de retenção e fala comuns em cortes virais
    return ['ESSA', 'PARTE', 'AQUI', 'MUDOU', 'COMPLETAMENTE', 'O', 'RESULTADO', 'FINAL', 'PRESTE', 'MUITO', 'ATENÇÃO']
  }, [activeClip])

  const timingWords = useMemo<WordTiming[]>(() => {
    const wordDuration = clipDuration / speechWords.length
    return speechWords.map((w, idx) => ({
      word: w,
      start: idx * wordDuration,
      end: (idx + 1) * wordDuration
    }))
  }, [speechWords, clipDuration])

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
    const nextPlaying = !isPlaying
    setIsPlaying(nextPlaying)

    if (videoRef.current) {
      if (nextPlaying) {
        videoRef.current.play().catch(() => null)
      } else {
        videoRef.current.pause()
      }
    } else if (iframeRef.current && iframeRef.current.contentWindow) {
      // Controle direto da API do YouTube IFrame via postMessage
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: nextPlaying ? 'playVideo' : 'pauseVideo',
          args: []
        }),
        '*'
      )
    }
  }

  const activeWordIndex = useMemo(() => {
    const idx = timingWords.findIndex(w => playbackTime >= w.start && playbackTime < w.end)
    return idx !== -1 ? idx : Math.min(timingWords.length - 1, Math.floor((playbackTime / clipDuration) * timingWords.length))
  }, [playbackTime, timingWords, clipDuration])

  // Excluir projeto
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

  // Baixar todos os cortes em lote
  const handleDownloadAll = () => {
    clips.forEach((clip, i) => {
      const url = clip.storage_url || (ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(clip.start_time)}s` : '#')
      if (url && url !== '#') {
        setTimeout(() => {
          const a = document.createElement('a')
          a.href = url
          a.download = `corte_${i + 1}_${extractCoreSubject(project.title)}.mp4`
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }, i * 300)
      }
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070709] text-white">
      
      {/* 1. BARRA SUPERIOR APPLE PRO (MINIMALISTA, SEM SOMBRAS NEON) */}
      <header className="h-14 border-b border-white/[0.08] px-6 flex items-center justify-between bg-[#0b0b0e]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Painel</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {project.title}
            </h1>
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
              {clips.length} cortes prontos
            </span>
          </div>
        </div>

        {/* Ações Rápidas no Topo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Todos ({clips.length})</span>
          </button>

          <Link
            href="/templates"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all border border-white/[0.08] hidden md:flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Templates</span>
          </Link>

          <button
            type="button"
            onClick={handleDeleteThisProject}
            disabled={isDeletingProject}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 cursor-pointer disabled:opacity-50"
            title="Excluir projeto"
          >
            {isDeletingProject ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* 2. SELETOR RÁPIDO HORIZONTAL DE CORTES (SEGMENTED APPLE) */}
      <div className="border-b border-white/[0.06] bg-[#0b0b0e]/40 px-6 py-2.5 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap pr-2">
          Cortes:
        </span>
        {clips.map((clip, idx) => {
          const isSelected = selectedClipIndex === idx
          const scorePercent = Math.round(clip.score * 100)
          return (
            <button
              key={clip.id}
              onClick={() => {
                setSelectedClipIndex(idx)
                setCustomTitle('')
                setPlaybackTime(0)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                  : 'bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <span className="font-semibold">#{idx + 1}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                scorePercent >= 90
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-orange-500/15 text-orange-400'
              }`}>
                {scorePercent}%
              </span>
            </button>
          )
        })}
      </div>

      {/* 3. STUDIO PRINCIPAL: 2 COLUNAS LIMPAS E ESPAÇOSAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA (5 COLUNAS): PLAYER DO IPHONE 16 PRO */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          {/* MOCKUP DO IPHONE 16/18 PRO (TITÂNIO, PROPORÇÃO 19.5:9, STATUS BAR REALISTA, SEM DYNAMIC ISLAND) */}
          <div className="relative p-[8px] bg-gradient-to-b from-[#38383e] via-[#202025] to-[#121215] rounded-[50px] shadow-[0_25px_80px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25)] ring-1 ring-white/20 shrink-0 select-none my-auto">
            {/* BOTÕES LATERAIS FÍSICOS DO IPHONE */}
            <div className="absolute -left-[4px] top-[100px] w-[4px] h-[24px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -left-[4px] top-[138px] w-[4px] h-[44px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -left-[4px] top-[192px] w-[4px] h-[44px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -right-[4px] top-[150px] w-[4px] h-[60px] bg-zinc-600 rounded-r-sm shadow-sm" />

            {/* TELA OLED DO IPHONE (PROPORÇÃO REAL 19.5:9 -> 310 x 672 px) */}
            <div
              style={{ width: "310px", height: "672px", aspectRatio: "9 / 19.5" }}
              className={`relative rounded-[42px] overflow-hidden flex flex-col justify-between transition-colors cursor-pointer ${
                templateBg === 'white' ? 'bg-white text-zinc-950' : 'bg-black text-white'
              }`}
              onClick={togglePlayback}
              title="Clique para Reproduzir / Pausar"
            >
              {/* STATUS BAR DO IPHONE (9:41 + SINAL, WI-FI, BATERIA - SEM DYNAMIC ISLAND) */}
              <div className="h-9 px-5 pt-2 flex items-center justify-between z-50 pointer-events-none text-white select-none">
                <span className="text-[11px] font-bold tracking-tight text-white/95 drop-shadow">9:41</span>

                <div className="flex items-center gap-1.5 text-white/95 drop-shadow">
                  <div className="flex items-end gap-0.5 h-2">
                    <div className="w-[2px] h-1 bg-white rounded-xs" />
                    <div className="w-[2px] h-1.5 bg-white rounded-xs" />
                    <div className="w-[2px] h-2 bg-white rounded-xs" />
                  </div>
                  <Wifi className="w-3 h-3 stroke-[2.4]" />
                  <div className="w-4 h-2 rounded-[3px] border border-white/80 p-0.5 flex items-center">
                    <div className="w-2.5 h-full bg-white rounded-[1px]" />
                  </div>
                </div>
              </div>
              
              {/* TOPO DO TEMPLATE: AVATAR + @HANDLE */}
                <div className="pt-2 px-4 z-20 flex flex-col items-center text-center pointer-events-none">
                  <div
                    style={{
                      width: `${Math.round(brandScale * 2.4)}px`,
                      height: `${Math.round(brandScale * 2.4)}px`,
                    }}
                    className={`rounded-full border overflow-hidden shadow-sm mb-1 transition-all ${
                      templateBg === 'white' ? 'border-zinc-300 bg-zinc-100' : 'border-white/30 bg-zinc-900'
                    }`}
                  >
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      style={{ fontSize: `${Math.round(brandScale * 0.8)}px` }}
                      className={`font-extrabold uppercase tracking-wide leading-tight transition-all ${
                        templateBg === 'white' ? 'text-zinc-900' : 'text-white'
                      }`}
                    >
                      {brandName}
                    </span>
                    {showVerifiedBadge && (
                      <svg
                        style={{
                          width: `${Math.max(8, Math.round(brandScale * 0.7))}px`,
                          height: `${Math.max(8, Math.round(brandScale * 0.7))}px`,
                        }}
                        className="text-blue-500 fill-current shrink-0"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    )}
                  </div>
                  <span
                    style={{ fontSize: `${Math.max(8, Math.round(brandScale * 0.65))}px` }}
                    className={`font-medium transition-all ${
                      templateBg === 'white' ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    {brandHandle}
                  </span>
                </div>

              {/* 1. TÍTULO DO VÍDEO (HEADLINE FIXA NO TOPO) */}
              <div className="px-4 py-1.5 text-center z-20 my-auto pointer-events-none">
                <h2 className={`text-xs sm:text-sm font-black leading-snug uppercase tracking-tight line-clamp-3 ${
                  templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                }`}>
                  {displayedTitle}
                </h2>
              </div>

              {/* 2. ENQUADRAMENTO DO VÍDEO COM PLAYER INTEGRADO (ÚNICO PLAYER) */}
              <div
                style={{
                  width: `${videoScale}%`,
                  margin: '0 auto',
                }}
                onMouseEnter={() => setShowVideoControls(true)}
                onMouseMove={() => {
                  setShowVideoControls(true)
                  if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
                  controlsTimeoutRef.current = setTimeout(() => setShowVideoControls(false), 2500)
                }}
                onMouseLeave={() => setShowVideoControls(false)}
                className={`relative aspect-[4/5] overflow-hidden z-10 shadow-md group/player ${
                  templateBg === 'white' ? 'border border-zinc-200/80 bg-black' : 'border border-white/10 bg-black'
                } flex items-center justify-center cursor-pointer`}
              >
                {activeClip.storage_url ? (
                  <video
                    ref={videoRef}
                    src={activeClip.storage_url}
                    className="w-full h-full object-cover"
                    style={{
                      objectFit: 'cover',
                      objectPosition: `${cropPanX}% center`,
                    }}
                    playsInline
                    muted
                    loop
                  />
                ) : ytId ? (
                  <div className="w-full h-full relative overflow-hidden select-none bg-black pointer-events-none">
                    <iframe
                      ref={iframeRef}
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=0&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&loop=1`}
                      className="border-0"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '100%',
                        height: '100%',
                        transform: `translate(-50%, -50%) scale(${Math.max(2.38, cropZoom / 100)}) translateX(${(50 - cropPanX) * 0.4}%)`,
                        transformOrigin: 'center center',
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                    <Scissors className="w-6 h-6 mb-1 text-zinc-600" />
                    <span>Prévia do Corte</span>
                  </div>
                )}

                {/* CONTROLES NATIVOS DO PLAYER SOBREPOSTOS DENTRO DO QUADRO (ESTILO YOUTUBE/TIKTOK) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-col gap-1.5 z-30 transition-opacity duration-200 ${
                    showVideoControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Linha da barra de progresso (scrubber) */}
                  <div
                    className="w-full h-1.5 bg-white/20 hover:h-2 rounded-full overflow-hidden cursor-pointer relative transition-all"
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                      setPlaybackTime(pct * clipDuration)
                    }}
                  >
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (playbackTime / clipDuration) * 100)}%` }}
                    />
                  </div>

                  {/* Play/Pause e Tempo */}
                  <div className="flex items-center justify-between text-white text-[11px] font-medium select-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePlayback()
                      }}
                      className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    </button>
                    <span className="font-mono text-[10px] text-zinc-300">
                      {formatDuration(Math.floor(playbackTime))} / {formatDuration(Math.floor(clipDuration))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. LEGENDA SINCRONIZADA */}
              <div className="pb-5 px-3 text-center z-20 pointer-events-none">
                <div
                  style={{
                    backgroundColor: activeSubStyle.activeBg,
                    color: activeSubStyle.activeColor,
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs uppercase shadow-md tracking-wider border border-black/10"
                >
                  <span>
                    {speechWords.slice(Math.max(0, activeWordIndex - 1), activeWordIndex + 2).join(' ')}
                  </span>
                </div>
              </div>

              {/* DECALQUE SAFE ZONE TRANSLÚCIDO (SEM ÍCONES) */}
              {showReelsSafeZone && (
                <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden rounded-[42px]">
                  <div className="absolute bottom-0 left-0 right-0 h-[21%] bg-gradient-to-t from-black/90 via-black/80 to-black/60 border-t border-dashed border-white/25 flex flex-col justify-end pb-3.5 px-4">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest text-center">
                      Área Segura (Reels 9:16)
                    </span>
                  </div>
                  
                </div>
              )}

              {/* BARRA HOME DO IPHONE */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/70 rounded-full pointer-events-none z-50 shadow-sm" />
            </div>
          </div>

          {/* CONTROLES DE REPRODUÇÃO & DECALQUE REELS */}
          <div className="w-[290px] sm:w-[320px] mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowReelsSafeZone(!showReelsSafeZone)}
              className="w-full py-1 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-[11px] text-zinc-400 hover:text-white flex items-center justify-between transition-all cursor-pointer"
            >
              <span>Decalque Safe Zone Reels (1080x1440):</span>
              <LiquidToggle checked={showReelsSafeZone} onChange={setShowReelsSafeZone} activeColor="emerald" />
            </button>
          </div>

          </div>

        {/* COLUNA DIREITA (7 COLUNAS): VISÃO EM LOTE, EXPORTAÇÃO E AJUSTES OPCIONAIS */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* CARD 1: CORTE SELECIONADO & AÇÕES RÁPIDAS */}
          <div className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Corte #{selectedClipIndex + 1} de {clips.length}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  • {formatDuration(Math.floor(clipDuration))}
                </span>
              </div>

              {/* Botão de Virality Score (Clean Pill) */}
              <button
                type="button"
                onClick={() => setViralityModalMetrics(activeVirality)}
                className="px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                title="Clique para ver a análise de retenção e motivo"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{Math.round(activeClip.score * 100)}% Viralidade</span>
              </button>
            </div>

            {/* Título do Corte (Editável de forma limpa) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Título / Gancho do Corte:</label>
                <button
                  type="button"
                  onClick={() => setShowMagneticSuggestions(!showMagneticSuggestions)}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Sugerir Ganchos</span>
                </button>
              </div>
              <input
                type="text"
                value={displayedTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Digite o título do corte..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-orange-500/50 text-sm text-white focus:outline-none transition-all"
              />
            </div>

            {/* Popover / Gaveta de sugestões magnéticas se aberta */}
            {showMagneticSuggestions && (
              <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl space-y-2 animate-in fade-in duration-150">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Ganchos de Alto CTR:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {magneticSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCustomTitle(sug.title)
                        setShowMagneticSuggestions(false)
                      }}
                      className="w-full text-left p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-xs text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{sug.title}</span>
                      <span className="text-[10px] text-emerald-400 font-mono shrink-0">98% CTR</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de Ação Imediata (Limpos e Diretos) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <a
                href={activeClip.storage_url || (ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(activeClip.start_time)}s` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                download={!!activeClip.storage_url}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Vídeo</span>
              </a>

              <button
                type="button"
                onClick={() => setQrModalClip({
                  title: displayedTitle,
                  url: activeClip.storage_url || (ytId ? `https://youtu.be/${ytId}?t=${Math.floor(activeClip.start_time)}` : window.location.href)
                })}
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                <span>P/ Celular</span>
              </button>

              <Link
                href="/schedule"
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Agendar</span>
              </Link>
            </div>

            {/* TOGGLE MINIMALISTA: PERSONALIZAR / AJUSTES (MINIMIZADO POR PADRÃO) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdjustments(!showAdjustments)}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] text-xs text-zinc-400 hover:text-white flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Ajustes Finos (Legenda, Enquadramento, Template)</span>
                </div>
                {showAdjustments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* PAINEL DE AJUSTES (SÓ APARECE QUANDO O USUÁRIO QUER EDITAR) */}
            {showAdjustments && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-4 animate-in fade-in duration-150">
                
                {/* Abas dos Ajustes (Segmented Pills) */}
                <div className="flex p-1 rounded-xl bg-white/[0.02] border border-white/[0.08] gap-1">
                  {[
                    { id: 'subtitles', label: 'Legendas' },
                    { id: 'framing', label: 'Enquadramento & IA' },
                    { id: 'template', label: 'Template & Layout' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAdjustTab(tab.id as any)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        adjustTab === tab.id
                          ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                          : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Conteúdo da Aba: Legendas */}
                {adjustTab === 'subtitles' && (
                  <div className="space-y-3 text-xs">
                    {/* TOGGLE LIQUID EMOJIS */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">Emojis Nativos Apple</span>
                        <span className="text-[10px] text-zinc-400">Insere emojis dinâmicos nas palavras da legenda</span>
                      </div>
                      <LiquidToggle
                        checked={smartEmojisEnabled}
                        onChange={setSmartEmojisEnabled}
                        activeLabel="ATIVOS"
                        inactiveLabel="OCULTOS"
                        activeColor="indigo"
                      />
                    </div>
                    

                    <div className="space-y-1.5">
                      <span className="text-zinc-400">Estilo de Legenda:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {SUBTITLE_STYLES.map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveSubtitleStyle(st.id)}
                            className={`p-2 rounded-lg text-center transition-all cursor-pointer text-[11px] font-semibold border ${
                              activeSubtitleStyle === st.id
                                ? `${st.border} bg-white/10 text-white`
                                : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {st.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conteúdo da Aba: Enquadramento (100% Automático via IA) */}
                {adjustTab === 'framing' && (
                  <div className="space-y-3.5 text-xs">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-[#121026]/60 to-purple-950/30 border border-indigo-500/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-white block">IA Auto-Tracking (100% Automatizado)</span>
                        </div>
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Calibrado
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        A Inteligência Artificial analisa o vídeo bruto e calibra o enquadramento dinamicamente. O rosto e os movimentos do falante principal são acompanhados e centralizados de forma 100% autônoma, sem necessidade de ajustes manuais.
                      </p>
                    </div>

                    {/* TOGGLE SAFE ZONE REELS */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">Decalque Safe Zone (Reels 9:16)</span>
                        <span className="text-[10px] text-zinc-400">Exibe margens de segurança na base do vídeo</span>
                      </div>
                      <LiquidToggle
                        checked={showReelsSafeZone}
                        onChange={setShowReelsSafeZone}
                        activeColor="indigo"
                      />
                    </div>

                    {/* LINK DIRETO PARA TEMPLATE */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-zinc-300 font-medium block">Dimensões & Posição:</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Definido no Template ({videoWidth}% × {videoHeight}%)
                        </span>
                      </div>
                      <Link
                        href="/templates"
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Editar no Template</span>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Conteúdo da Aba: Template (Herdado do Editor de Templates) */}
                {adjustTab === 'template' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Template do Canal</span>
                        <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                          {templateBg === 'white' ? 'Fundo Branco' : 'Fundo Escuro'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        O design, cores, bordas e alinhamentos são gerenciados no Editor de Templates para manter consistência em todos os seus cortes.
                      </p>
                      <div className="pt-1">
                        <Link
                          href="/templates"
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Abrir Editor Completo de Templates</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* CARD 2: LISTA DE CORTES EM LOTE (BATCH REVIEW & DOWNLOAD) */}
          <div className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Lista de Cortes em Lote ({clips.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDownloadAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Todos</span>
              </button>
            </div>

            {/* Itens dos Cortes em Formato de Lista Apple */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {clips.map((c, i) => {
                const isCurrent = selectedClipIndex === i
                const duration = Math.max(1, (c.end_time || 45) - (c.start_time || 0))
                const scoreP = Math.round(c.score * 100)

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedClipIndex(i)
                      setCustomTitle('')
                      setPlaybackTime(0)
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-white/[0.06] border-white/20 shadow-sm'
                        : 'bg-white/[0.01] hover:bg-white/[0.04] border-white/[0.04] text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent ? 'bg-[#6366f1] text-white shadow-sm shadow-[#6366f1]/30' : 'bg-white/[0.06] text-zinc-400'
                      }`}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate leading-tight ${
                          isCurrent ? 'text-white' : 'text-zinc-300'
                        }`}>
                          {c.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 font-mono">
                          <span>{formatDuration(Math.floor(duration))}</span>
                          <span>•</span>
                          <span className={`${
                            scoreP >= 90 ? 'text-emerald-400' : 'text-orange-400'
                          }`}>
                            {scoreP}% Viral
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={c.storage_url || (ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(c.start_time)}s` : '#')}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={!!c.storage_url}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all"
                        title="Baixar este corte"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>

        </div>

      </main>

      {/* MODAL APPLE VIRALITY SCORE (MOTIVO COMPLETO) */}
      {viralityModalMetrics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[#121216] border border-white/10 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Diagnóstico de Viralidade IA</h3>
              </div>
              <button
                type="button"
                onClick={() => setViralityModalMetrics(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-zinc-300">Nota Geral:</span>
                <span className="text-sm font-bold text-emerald-400">{viralityModalMetrics.score}/100</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-semibold text-white">Motivo do Potencial Viral:</span>
                <p className="text-zinc-400 leading-relaxed">
                  {viralityModalMetrics.reason}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block">Gancho</span>
                  <strong className="text-white text-xs">{viralityModalMetrics.hookScore}%</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block">Ritmo</span>
                  <strong className="text-white text-xs">{viralityModalMetrics.engagementScore}%</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block">Retenção</span>
                  <strong className="text-white text-xs">{viralityModalMetrics.retentionScore}%</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViralityModalMetrics(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL QR CODE PARA ENVIAR AO CELULAR */}
      {qrModalClip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[#121216] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Enviar p/ Celular</span>
              <button
                type="button"
                onClick={() => setQrModalClip(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Aponte a câmera do seu celular para o QR Code para abrir o vídeo diretamente no aparelho:
            </p>

            <div className="flex justify-center p-3 bg-white rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrModalClip.url)}`}
                alt="QR Code"
                className="w-44 h-44"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(qrModalClip.url)
                setCopiedUrl(true)
                setTimeout(() => setCopiedUrl(false), 2000)
              }}
              className="w-full py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Link Copiado!' : 'Copiar Link Direto'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
