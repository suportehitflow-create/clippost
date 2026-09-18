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
        if (!part) return null
        if (emojiRegex.test(part)) {
          return (
            <span
              key={i}
              className="inline-block mx-[1.5px] align-[-0.12em] font-['Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji',sans-serif] leading-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] transform hover:scale-110 transition-transform duration-150"
            >
              {part}
            </span>
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
  raw_video_url?: string | null
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
  { id: 'clean_white', name: 'Clean White', activeColor: '#000000', activeBg: '#ffffff', border: 'border-white/40' },
  { id: 'clean_white_box', name: 'Clean White Box', activeColor: '#000000', activeBg: '#ffffff', border: 'border-white/40' },
  { id: 'dark_box', name: 'Dark Box', activeColor: '#f97316', activeBg: '#18181b', border: 'border-zinc-700' },
  { id: 'neon_cyan', name: 'Cyan Pro', activeColor: '#22d3ee', activeBg: 'rgba(0,0,0,0.85)', glow: '0 0 12px rgba(6,182,212,0.8)', border: 'border-cyan-400/40' },
  { id: 'neon_magenta', name: 'Magenta Pro', activeColor: '#f472b6', activeBg: 'rgba(0,0,0,0.85)', glow: '0 0 12px rgba(236,72,153,0.8)', border: 'border-pink-500/40' },
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
  const [videoRounded, setVideoRounded] = useState<boolean>(true)
  const [brandName, setBrandName] = useState('Nome da Página')
  const [brandHandle, setBrandHandle] = useState('@nomedapagina')
  const [brandScale, setBrandScale] = useState<number>(14)
  const DEFAULT_BRAND_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><defs><linearGradient id='cp_grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='50%' stop-color='%238b5cf6'/><stop offset='100%' stop-color='%23ec4899'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23cp_grad)'/><path d='M60 34 A15 15 0 1 0 60 64 A15 15 0 0 0 60 34 Z M40 88 C40 73 50 68 60 68 C70 68 80 73 80 88 Z' fill='white' opacity='0.95'/></svg>"
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_BRAND_AVATAR)

  // Dimensões e Coordenadas do Template
  const [videoWidth, setVideoWidth] = useState<number>(92)
  const [videoHeight, setVideoHeight] = useState<number>(48)
  const [videoPos, setVideoPos] = useState<{ x: number; y: number }>({ x: 50, y: 52 })
  const [headerPos, setHeaderPos] = useState<{ x: number; y: number }>({ x: 50, y: 16 })
  const [titlePos, setTitlePos] = useState<{ x: number; y: number }>({ x: 50, y: 24 })
  const [subtitlePos, setSubtitlePos] = useState<{ x: number; y: number }>({ x: 50, y: 75 })
  const [brandAlign, setBrandAlign] = useState<'center' | 'left' | 'right'>('center')
  const [brandLayout, setBrandLayout] = useState<'inline' | 'row' | 'stacked'>('inline')
  const [showVerifiedBadge, setShowVerifiedBadge] = useState<boolean>(true)
  const [fontFamily, setFontFamily] = useState<string>("'Instagram Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif")
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
      const savedCfgOnly = localStorage.getItem('clippost_template_config')
      if (savedCfgOnly) {
        try {
          const cfg = JSON.parse(savedCfgOnly)
          if (cfg.templateBg) setTemplateBg(cfg.templateBg)
          if (cfg.brandName && cfg.brandName !== 'HUMOR DA IGUANA') setBrandName(cfg.brandName)
          if (cfg.brandHandle && cfg.brandHandle !== '@humordaiguana') setBrandHandle(cfg.brandHandle)
          if (cfg.videoWidth) { setVideoWidth(cfg.videoWidth); setVideoScale(cfg.videoWidth); }
          if (cfg.videoHeight) setVideoHeight(cfg.videoHeight)
          if (cfg.videoPos) setVideoPos(cfg.videoPos)
          if (cfg.headerPos) setHeaderPos(cfg.headerPos)
          if (cfg.titlePos) setTitlePos(cfg.titlePos)
          if (cfg.subtitlePos) setSubtitlePos(cfg.subtitlePos)
          if (cfg.brandAlign) setBrandAlign(cfg.brandAlign)
          if (cfg.brandLayout) setBrandLayout(cfg.brandLayout)
          if (cfg.showVerifiedBadge !== undefined) setShowVerifiedBadge(cfg.showVerifiedBadge)
          if (cfg.fontFamily) setFontFamily(cfg.fontFamily)
          if (cfg.fontSize) setFontSize(cfg.fontSize)
          if (cfg.titleColor) setTitleColor(cfg.titleColor)
          if (cfg.titleStroke) setTitleStroke(cfg.titleStroke)
          if (cfg.titleStrokeColor) setTitleStrokeColor(cfg.titleStrokeColor)
          if (cfg.brandScale) setBrandScale(cfg.brandScale)
          if (cfg.videoRounded !== undefined) setVideoRounded(cfg.videoRounded)
          if (cfg.titleCapsLock !== undefined) setTitleCapsLock(cfg.titleCapsLock)
          if (cfg.textAlign) setTextAlign(cfg.textAlign)
          if (cfg.subtitle_preset) setActiveSubtitleStyle(cfg.subtitle_preset)
        } catch {}
      }
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
          if (c.brandScale) setBrandScale(c.brandScale)
          if (c.videoRounded !== undefined) setVideoRounded(c.videoRounded)
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
            if (cfg.videoRounded !== undefined) setVideoRounded(cfg.videoRounded)
            if (cfg.videoPos) setVideoPos(cfg.videoPos)
            if (cfg.headerPos) setHeaderPos(cfg.headerPos)
            if (cfg.titlePos) setTitlePos(cfg.titlePos)
            if (cfg.subtitlePos) setSubtitlePos(cfg.subtitlePos)
            if (cfg.brandAlign) setBrandAlign(cfg.brandAlign)
            if (cfg.brandLayout) setBrandLayout(cfg.brandLayout)
            if (cfg.brandScale) setBrandScale(cfg.brandScale)
            if (cfg.showVerifiedBadge !== undefined) setShowVerifiedBadge(cfg.showVerifiedBadge)
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

  // Polling em tempo real para carregar os cortes REAIS gerados pelo backend
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    async function fetchClipsAndStatus() {
      try {
        const { data: dbClips } = await supabase
          .from('clips')
          .select('*')
          .eq('project_id', project.id)
          .order('score', { ascending: false })

        const { data: projData } = await supabase
          .from('projects')
          .select('status, raw_video_url')
          .eq('id', project.id)
          .maybeSingle()

        if (projData?.status) {
          setStatus(projData.status)
        }

        if (dbClips && dbClips.length > 0) {
          setClips(dbClips)
          if (projData?.status === 'done' || projData?.status === 'completed' || dbClips.some(c => !!c.storage_url)) {
            setStatus('done')
            if (timer) {
              clearInterval(timer)
              timer = null
            }
            return
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar cortes:', err)
      }
    }

    fetchClipsAndStatus()

    // Mantém polling a cada 3 segundos enquanto processa
    timer = setInterval(fetchClipsAndStatus, 3000)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [project.id])

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
    const readyClips = clips.filter(c => !!c.storage_url)
    if (readyClips.length === 0) {
      alert('Os arquivos de vídeo finais em 9:16 estão sendo renderizados pelo backend. Aguarde alguns instantes!')
      return
    }
    readyClips.forEach((clip, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = clip.storage_url!
        a.download = `corte_${i + 1}_${extractCoreSubject(project.title)}.mp4`
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, i * 350)
    })
  }

  // 0. TELA DE PROCESSAMENTO MINIMALISTA ENQUANTO OS CORTES ESTÃO SENDO MINERADOS
  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#070709] text-white">
        {/* Header minimalista */}
        <header className="h-14 border-b border-white/[0.08] px-6 flex items-center justify-between bg-[#0b0b0e]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Painel</span>
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {project.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Minerando com IA...
            </span>
          </div>
        </header>

        {/* Card Central Minimalista com as Etapas Reais */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0e0e12] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                <Scissors className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Minerando Cortes 9:16
              </h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto line-clamp-2">
                {project.title}
              </p>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-[pulse_2s_ease-in-out_infinite] w-3/4" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>IA em execução</span>
                <span>Tempo Real</span>
              </div>
            </div>

            {/* Etapas do Processamento */}
            <div className="space-y-2.5 pt-1">
              {[
                { title: 'Download & extração de áudio', desc: 'Processando fluxo do vídeo original', done: true },
                { title: 'Transcrição Whisper & timestamps', desc: 'Mapeando cada palavra para a legenda', active: true },
                { title: 'Mineração narrativa de ganchos virais', desc: 'Analisando retenção e tópicos magnéticos', pending: true },
                { title: 'Renderização 9:16 & template oficial', desc: 'Aplicando cortes verticais e legendas', pending: true },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    step.done
                      ? 'bg-white/[0.02] border-emerald-500/20 text-zinc-300'
                      : step.active
                      ? 'bg-indigo-500/[0.06] border-indigo-500/30 text-white'
                      : 'bg-transparent border-white/[0.04] text-zinc-600 opacity-50'
                  }`}
                >
                  <div className="shrink-0">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : step.active ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-[9px] font-mono">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${step.active ? 'text-white' : step.done ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-zinc-500">
              O estúdio abrirá automaticamente assim que os cortes ficarem prontos.
            </p>
          </div>
        </div>
      </div>
    )
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
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {clips.length} cortes prontos
            </span>
          </div>
        </div>

        {/* Ações Rápidas no Topo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={clips.length === 0 || status === 'processing'}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5 shadow-sm ${
              clips.length === 0 || status === 'processing'
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer'
            }`}
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
      <div className="border-b border-white/[0.06] bg-[#0b0b0e]/40 px-6 py-2 overflow-x-auto scrollbar-none flex items-center gap-2">
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
                  : 'bg-indigo-500/15 text-indigo-400'
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
          
          {/* MOCKUP DO IPHONE 16 PRO (MINIMALISTA, MENOS SOMBRAS) */}
          <div className="relative p-[8px] bg-[#1a1a20] rounded-[52px] border border-white/15 shadow-xl shrink-0 select-none my-auto">
            {/* BOTÕES LATERAIS FÍSICOS DO IPHONE */}
            <div className="absolute -left-[4px] top-[100px] w-[3px] h-[24px] bg-zinc-600 rounded-l-sm" />
            <div className="absolute -left-[4px] top-[138px] w-[3px] h-[44px] bg-zinc-600 rounded-l-sm" />
            <div className="absolute -left-[4px] top-[192px] w-[3px] h-[44px] bg-zinc-600 rounded-l-sm" />
            <div className="absolute -right-[4px] top-[150px] w-[3px] h-[60px] bg-zinc-600 rounded-r-sm" />

            {/* TELA OLED DO IPHONE (PROPORÇÃO REAL 19.5:9 -> 310 x 672 px) */}
            <div
              style={{ width: "324px", height: "702px", aspectRatio: "9 / 19.5" }}
              className={`relative rounded-[44px] overflow-hidden select-none transition-colors cursor-pointer ${
                templateBg === 'white' ? 'bg-white text-zinc-950' : 'bg-black text-white'
              }`}
              onClick={togglePlayback}
              title="Clique para Reproduzir / Pausar"
            >
              {/* 1. STATUS BAR DO IPHONE */}
              <div className="h-9 px-5 pt-2 flex items-center justify-between z-50 pointer-events-none select-none">
                <span className={`text-[11px] font-bold tracking-tight ${templateBg === 'white' ? 'text-zinc-900' : 'text-white'}`}>9:41</span>

                <div className={`flex items-center gap-1.5 ${templateBg === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                  <div className="flex items-end gap-0.5 h-2">
                    <div className={`w-[2px] h-1 rounded-xs ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                    <div className={`w-[2px] h-1.5 rounded-xs ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                    <div className={`w-[2px] h-2 rounded-xs ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                  </div>
                  <Wifi className="w-3 h-3 stroke-[2.4]" />
                  <div className={`w-4 h-2 rounded-[3px] border p-0.5 flex items-center ${templateBg === 'white' ? 'border-zinc-900' : 'border-white/80'}`}>
                    <div className={`w-2.5 h-full rounded-[1px] ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                  </div>
                </div>
              </div>

              {/* 2. CABEÇALHO DO TEMPLATE: AVATAR + @HANDLE (100% VINCULADO AO TEMPLATE) */}
              <div
                style={{ top: `${headerPos.y}%` }}
                className={`absolute left-5 right-5 -translate-y-1/2 z-30 flex items-center select-none pointer-events-none transition-all ${
                  brandAlign === 'left' ? 'justify-start' : brandAlign === 'right' ? 'justify-end' : 'justify-center'
                }`}
              >
                <div
                  className={`flex items-center max-w-full ${brandLayout === 'stacked' ? 'flex-col text-center' : 'flex-row'}`}
                  style={{ gap: `${Math.max(6, Math.round(brandScale * 0.65))}px` }}
                >
                  <div
                    style={{
                      width: `${Math.round(brandScale * 2.85)}px`,
                      height: `${Math.round(brandScale * 2.85)}px`,
                    }}
                    className={`rounded-full border-2 overflow-hidden shadow-sm shrink-0 transition-all ${
                      templateBg === 'white' ? 'border-zinc-300 bg-zinc-100' : 'border-white/60 bg-zinc-900'
                    }`}
                  >
                    <img
                      src={avatarUrl}
                      alt={brandName}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                  <div className={`flex flex-col min-w-0 ${brandAlign === 'center' ? 'items-center text-center' : brandAlign === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ fontSize: `${brandScale}px` }}
                        className={`font-bold tracking-tight truncate leading-snug transition-all ${
                          templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                        }`}
                      >
                        {brandName}
                      </span>
                      {showVerifiedBadge && (
                        <svg
                          style={{
                            width: `${Math.max(10, Math.round(brandScale * 0.85))}px`,
                            height: `${Math.max(10, Math.round(brandScale * 0.85))}px`,
                          }}
                          className="text-blue-500 fill-current shrink-0"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      )}
                    </div>
                    <span
                      style={{ fontSize: `${Math.max(9, Math.round(brandScale * 0.75))}px` }}
                      className={`font-medium truncate leading-tight transition-all ${
                        templateBg === 'white' ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      {brandHandle}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. TÍTULO DO VÍDEO (100% VINCULADO AO TEMPLATE) */}
              <div
                style={{
                  left: `${titlePos.x}%`,
                  top: `${titlePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '88%',
                  fontFamily: fontFamily,
                  fontSize: `${fontSize}px`,
                  color: templateBg === 'white' && titleColor.toLowerCase() === '#ffffff' ? '#000000' : titleColor,
                  textAlign: textAlign,
                  textTransform: titleCapsLock ? 'uppercase' : 'none',
                  paintOrder: titleStroke !== 'none' ? 'stroke fill' : 'normal',
                  textShadow: titleStroke !== 'none'
                    ? (() => {
                        const r = titleStroke === 'thin' ? 1.0 : titleStroke === 'medium' ? 1.8 : 2.6
                        const pts = []
                        for (let i = 0; i < 16; i++) {
                          const a = (i * Math.PI) / 8
                          pts.push(`${(Math.cos(a) * r).toFixed(1)}px ${(Math.sin(a) * r).toFixed(1)}px 0 ${titleStrokeColor}`)
                        }
                        return pts.join(', ')
                      })()
                    : 'none',
                  WebkitTextStroke: titleStroke !== 'none'
                    ? `${titleStroke === 'thin' ? '1px' : titleStroke === 'medium' ? '2px' : '3px'} ${titleStrokeColor}`
                    : '0px transparent',
                }}
                className="absolute pointer-events-none z-30 font-black leading-tight tracking-tight select-none"
              >
                {displayedTitle}
              </div>

              {/* 4. QUADRO DO VÍDEO (100% VINCULADO AO TEMPLATE) */}
              <div
                style={{
                  left: `${videoPos.x}%`,
                  top: `${videoPos.y}%`,
                  width: `${videoWidth}%`,
                  height: `${videoHeight}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => setShowVideoControls(true)}
                onMouseMove={() => {
                  setShowVideoControls(true)
                  if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
                  controlsTimeoutRef.current = setTimeout(() => setShowVideoControls(false), 2500)
                }}
                onMouseLeave={() => setShowVideoControls(false)}
                className={`absolute z-20 ${videoRounded ? "rounded-2xl" : "rounded-none"} overflow-hidden shadow-md group/player ${
                  templateBg === 'white' ? 'border border-zinc-200/80 bg-black' : 'border border-white/10 bg-black'
                } flex items-center justify-center cursor-pointer`}
              >
                {activeClip.storage_url || project.raw_video_url ? (
                  <video
                    ref={videoRef}
                    src={activeClip.storage_url || project.raw_video_url || ''}
                    className="w-full h-full object-cover"
                    playsInline
                    loop
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        const cur = videoRef.current.currentTime
                        if (!activeClip.storage_url) {
                          if (cur >= activeClip.end_time || cur < activeClip.start_time) {
                            videoRef.current.currentTime = activeClip.start_time
                          }
                          setPlaybackTime(Math.max(0, cur - activeClip.start_time))
                        } else {
                          setPlaybackTime(cur)
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0c0a1a] via-[#161233] to-[#251b4d] flex flex-col items-center justify-center p-4 text-center select-none">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center mb-2 animate-pulse">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-wide">Vídeo 9:16</span>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Renderizando corte...</span>
                  </div>
                )}

                {/* CONTROLES NATIVOS DO PLAYER */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-col gap-1.5 z-30 transition-opacity duration-200 ${
                    showVideoControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
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

              {/* 5. LEGENDA DINÂMICA (100% VINCULADA AO TEMPLATE) */}
              <div
                style={{
                  left: `${subtitlePos.x}%`,
                  top: `${subtitlePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-none z-30 select-none flex justify-center whitespace-nowrap"
              >
                <div
                  style={{
                    backgroundColor: activeSubStyle.activeBg,
                    color: activeSubStyle.activeColor,
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight shadow-md border border-white/20 whitespace-nowrap"
                >
                  {speechWords.length > 0 ? speechWords.slice(Math.max(0, activeWordIndex - 1), activeWordIndex + 2).join(' ') : 'SUA LEGENDA APARECERÁ AQUI'}
                </div>
              </div>

              {/* BARRA HOME DO IPHONE */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/70 rounded-full pointer-events-none z-50 shadow-sm" />
            </div>
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
                href={activeClip.storage_url || project.raw_video_url || '#'}
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
                  url: activeClip.storage_url || project.raw_video_url || (typeof window !== 'undefined' ? window.location.href : '')
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
                        href={c.storage_url || project.raw_video_url || '#'}
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
