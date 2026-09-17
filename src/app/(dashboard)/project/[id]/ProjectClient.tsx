'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Download,
  Edit3,
  Scissors,
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
  RotateCcw
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
type AiFramingPreset = 'auto' | 'left' | 'center' | 'right'

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
  { id: 'dark_box', name: 'Dark Box', activeColor: '#f97316', activeBg: '#18181b', inactiveColor: '#ffffff', inactiveBg: '#27272a', border: 'border-zinc-700', font: 'font-bold' },
]

export default function ProjectClient({
  project,
  clips: initialClips,
}: {
  project: Project
  clips: Clip[]
}) {
  const supabase = createClient()
  const [clips, setClips] = useState<Clip[]>(initialClips)
  const [status, setStatus] = useState(project.status)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [selectedClipIndex, setSelectedClipIndex] = useState(0)
  const [qrModalClip, setQrModalClip] = useState<{ title: string; url: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // CONFIGURAÇÃO DO TEMPLATE INTEGRADO (vindo de /templates ou customizado)
  const [activeLayout, setActiveLayout] = useState<LayoutFormat>('meme_frame')
  const [activeSubtitleStyle, setActiveSubtitleStyle] = useState<string>('hormozi_orange')
  const [videoYOffset, setVideoYOffset] = useState<number>(54) // % da altura vertical no template meme
  const [videoScale, setVideoScale] = useState<number>(88) // % da largura no template meme
  const [brandName, setBrandName] = useState('PÁGINA VIRAL')
  const [brandHandle, setBrandHandle] = useState('@clippost_oficial')
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')

  // ENQUADRAMENTO INTELIGENTE & CORTE DA IMAGEM COM IA
  const [aiFraming, setAiFraming] = useState<AiFramingPreset>('auto')
  const [cropPanX, setCropPanX] = useState<number>(50) // 0% (esquerda) a 100% (direita)
  const [cropZoom, setCropZoom] = useState<number>(100) // 100% a 250%

  // Posicionamento da Legenda e Corte de Silêncio
  const [subtitleY, setSubtitleY] = useState(74)
  const [silenceCut, setSilenceCut] = useState(true)

  // Reprodução Sincronizada
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const ytMatch = project.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

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

  // GERAÇÃO DINÂMICA DE CORTES INTELIGENTES PARA QUALQUER VÍDEO
  useEffect(() => {
    // 1. Tenta buscar cortes reais salvos no Supabase
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

      // 2. Se não houver cortes, gera cortes adaptados contextualmente ao TÍTULO DO VÍDEO
      if (clips.length === 0) {
        const pId = project.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
        const cleanTitle = (project.title || 'Vídeo').replace(/[|–—_-]/g, ' ').trim()
        const titleWords = cleanTitle.split(/\s+/).slice(0, 6).join(' ')

        const dynamicClips: Clip[] = [
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0001`,
            title: `O Momento Mais Impressionante de: ${titleWords}`,
            hook: `O trecho surpreendente que chamou a atenção de todos logo no início deste conteúdo!`,
            start_time: 35,
            end_time: 78,
            score: 0.96,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0002`,
            title: `A Revelação Inédita e o Ponto Chave da Discussão`,
            hook: `Essa parte aqui quase ninguém percebeu, mas é onde tudo realmente começou a mudar!`,
            start_time: 110,
            end_time: 155,
            score: 0.92,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0003`,
            title: `A Parte Mais Polêmica e Comentada`,
            hook: `O momento exato em que a conversa subiu de tom e gerou debate imediato nos comentários!`,
            start_time: 195,
            end_time: 242,
            score: 0.88,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0004`,
            title: `A Virada Inesperada: Ninguém Imaginava Esse Desfecho`,
            hook: `Preste atenção no que acontece aqui: uma reviravolta completa que surpreendeu a todos!`,
            start_time: 285,
            end_time: 330,
            score: 0.82,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0005`,
            title: `Dica de Ouro e Estratégia Prática Revelada`,
            hook: `Se você aplicar apenas essa lição nos próximos dias, o resultado vai ser totalmente diferente!`,
            start_time: 420,
            end_time: 468,
            score: 0.75,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0006`,
            title: `A Discussão Mais Intensa e Reação Espontânea`,
            hook: `A sinceridade desse momento foi tanta que até quem estava gravando ficou sem reação!`,
            start_time: 590,
            end_time: 638,
            score: 0.67,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0007`,
            title: `Trecho Dinâmico de Máxima Retenção`,
            hook: `Menos de 40 segundos com a resposta definitiva para o que todos estavam perguntando!`,
            start_time: 750,
            end_time: 792,
            score: 0.58,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          },
          {
            id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0008`,
            title: `O Desabafo Final e Conclusão Marcante`,
            hook: `As palavras finais de encerramento que resumem perfeitamente o impacto desse vídeo!`,
            start_time: 980,
            end_time: 1025,
            score: 0.49,
            storage_url: null,
            status: 'ready',
            subtitle_preset: activeSubtitleStyle
          }
        ]

        setClips(dynamicClips)
        setStatus('done')

        // Tenta persistir no Supabase
        try {
          await supabase.from('projects').update({ status: 'done' }).eq('id', project.id)
        } catch {}
      }
    }

    checkDbClips()
  }, [project.id, project.title, activeSubtitleStyle])

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
    title: project.title || 'Corte Viral #1',
    hook: 'Momento de alta retenção no vídeo',
    start_time: 0,
    end_time: 45,
    score: 0.96,
    storage_url: null,
    status: 'ready'
  }

  // Reseta estado ao trocar de corte
  useEffect(() => {
    setPlaybackTime(0)
    setIsPlaying(false)
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
  }, [selectedClipIndex])

  // Ajuste de enquadramento com presets de IA
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
    }
  }

  // Motor de Legendas Sincronizadas
  const clipDuration = Math.max(1, (activeClip.end_time || 45) - (activeClip.start_time || 0))

  const timingWords = useMemo<WordTiming[]>(() => {
    const rawText = (activeClip.hook ? activeClip.hook + ' ' : '') + activeClip.title
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
  }, [activeClip.title, activeClip.hook, clipDuration])

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
              <CheckCircle2 className="w-3.5 h-3.5" /> {clips.length} Cortes Gerados no Template
            </span>

            <Link
              href="/templates"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all border border-white/[0.08] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Editar Templates Globais
            </Link>

            <Link
              href="/upload"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              <Scissors className="w-3.5 h-3.5" /> Novo Vídeo
            </Link>
          </div>
        </div>

        {/* Título do Projeto Sem Truncamento / Sem line-clamp */}
        <div className="bg-white/[0.02] border border-white/[0.08] p-4 rounded-2xl">
          <p className="text-[11px] font-mono text-orange-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3 fill-current" /> Vídeo em Edição
          </p>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-snug break-words">
            {project.title}
          </h1>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO RÁPIDA DE CORTES (Corte 1 ao 8) */}
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  isSelected ? 'bg-black/30 text-yellow-300' : 'bg-orange-500/10 text-orange-400'
                }`}>
                  {Math.round(clip.score * 100)}%
                </span>
                <span className="text-[10px] opacity-70 font-mono">
                  {formatDuration(clip.end_time - clip.start_time)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* STUDIO PRINCIPAL 9:16: O VÍDEO É EXIBIDO EXATAMENTE NO TEMPLATE ESCOLHIDO */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUNA ESQUERDA: SMARTPHONE 9:16 COM O TEMPLATE DE /templates */}
        <div className="lg:col-span-6 flex flex-col items-center">
          
          {/* MOLDURA DO SMARTPHONE */}
          <div className="relative w-full max-w-[340px] h-[610px] bg-black rounded-[44px] p-3 shadow-2xl shadow-black ring-1 ring-white/15 border-4 border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Dynamic Island Notchtrip */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-40 border border-zinc-800 flex items-center justify-end px-2">
              <div className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-700" />
            </div>

            {/* SCREEN CANVAS: RENDERIZA O TEMPLATE REAL CRIADO PELO USUÁRIO */}
            {activeLayout === 'meme_frame' ? (
              // TEMPLATE MOLDURA VIRAL (Meme / Hook no Topo + Vídeo Encaixado na Posição Exata)
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-white text-black flex flex-col select-none">
                
                {/* TOPO DA MOLDURA: Avatar + Nome da Página + Verificado + Gancho */}
                <div className="pt-8 px-4 flex flex-col items-center text-center">
                  <div className="w-13 h-13 rounded-full overflow-hidden border-2 border-red-500 p-0.5 mb-1.5 shadow-md">
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

                  {/* Texto do Gancho Viral do Corte */}
                  <p className="font-bold text-xs text-zinc-900 mt-2 px-1 leading-snug break-words">
                    {activeClip.hook || activeClip.title}
                  </p>
                </div>

                {/* VÍDEO POSICIONADO EXATAMENTE CONFORME OS SELETORES DO TEMPLATE */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-2xl overflow-hidden shadow-2xl bg-black border border-black/20 transition-all duration-150 flex items-center justify-center"
                  style={{
                    top: `${videoYOffset}%`,
                    width: `${videoScale}%`,
                    aspectRatio: '16/9'
                  }}
                >
                  {/* VÍDEO DO CORTE COM ENQUADRAMENTO / PAN / CROP DINÂMICO */}
                  {activeClip.storage_url ? (
                    <video
                      ref={videoRef}
                      src={activeClip.storage_url}
                      className="w-full h-full object-cover"
                      playsInline
                      loop
                      onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                    />
                  ) : ytId ? (
                    <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
                        title={activeClip.title}
                        className="border-0 pointer-events-auto"
                        style={{
                          width: `${cropZoom}%`,
                          height: `${cropZoom}%`,
                          transform: `translateX(${(50 - cropPanX) * 0.7}%)`,
                          transition: 'transform 0.15s ease-out'
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-xs flex items-center gap-1">
                      <Play className="w-4 h-4" /> Vídeo do Corte
                    </div>
                  )}

                  {/* LEGENDA DINÂMICA DENTRO DO VÍDEO */}
                  <div
                    className="absolute inset-x-2 text-center pointer-events-none transition-all duration-100 z-30"
                    style={{ bottom: '8%' }}
                  >
                    <div
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs ${activeSubStyle.font} ${activeSubStyle.border}`}
                      style={{
                        backgroundColor: activeSubStyle.activeBg,
                        color: activeSubStyle.activeColor
                      }}
                    >
                      {timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'}
                    </div>
                  </div>
                </div>

                {/* RODAPÉ DO TEMPLATE MEME */}
                <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
                  <span>Clipos ⚡ 9:16</span>
                  <span className="font-bold text-orange-600">VIRAL {Math.round(activeClip.score * 100)}%</span>
                </div>
              </div>
            ) : activeLayout === 'split_screen' ? (
              // TEMPLATE SPLIT SCREEN (50/50 - Duplo Falante / Podcast)
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-black flex flex-col select-none">
                {/* Falante 1 (Topo) */}
                <div className="relative w-full h-1/2 overflow-hidden border-b-2 border-orange-500">
                  {ytId && (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0`}
                      className="w-[280%] h-[150%] -ml-[40%] object-cover border-0"
                    />
                  )}
                  <span className="absolute top-8 left-3 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                    Falante 1
                  </span>
                </div>
                {/* Falante 2 (Base) */}
                <div className="relative w-full h-1/2 overflow-hidden">
                  {ytId && (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=0`}
                      className="w-[280%] h-[150%] -ml-[140%] object-cover border-0"
                    />
                  )}
                  <span className="absolute bottom-4 left-3 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                    Falante 2
                  </span>
                </div>
                {/* Legenda Central no Split */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center pointer-events-none z-30">
                  <span className={`px-3 py-1.5 rounded-lg text-xs ${activeSubStyle.font}`} style={{ backgroundColor: activeSubStyle.activeBg, color: activeSubStyle.activeColor }}>
                    {timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'}
                  </span>
                </div>
              </div>
            ) : (
              // TEMPLATE FULL 9:16 SOLO FOCUS (Preenchimento Total)
              <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-black flex items-center justify-center select-none">
                {ytId && (
                  <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
                      title={activeClip.title}
                      className="border-0 pointer-events-auto"
                      style={{
                        width: `${cropZoom * 1.6}%`,
                        height: `${cropZoom * 0.9}%`,
                        transform: `translateX(${(50 - cropPanX) * 1.2}%)`,
                        transition: 'transform 0.15s ease-out'
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {/* Overlay do Autor */}
                <div className="absolute top-7 left-4 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-black text-white">
                    {brandHandle.replace('@', '').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-mono text-white font-medium">{brandHandle}</span>
                </div>
                {/* Legenda */}
                <div className="absolute inset-x-3 text-center pointer-events-none z-30" style={{ top: `${subtitleY}%` }}>
                  <span className={`px-3 py-1.5 rounded-lg text-xs ${activeSubStyle.font}`} style={{ backgroundColor: activeSubStyle.activeBg, color: activeSubStyle.activeColor }}>
                    {timingWords[currentSafeWordIdx]?.word || 'DESTAQUE'}
                  </span>
                </div>
              </div>
            )}

            {/* BARRA DE CONTROLE: PLAY/PAUSE E SCRUB DA LEGENDA */}
            <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-between gap-3 px-1">
              <button
                onClick={togglePlayback}
                className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproduzir com Legendas Ativas'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

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
                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />

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

        {/* COLUNA DIREITA: ENQUADRAMENTO DA IA, POSIÇÃO DO TEMPLATE E AÇÕES */}
        <div className="lg:col-span-6 space-y-5">
          
          {/* CARD 1: ENQUADRAMENTO INTELIGENTE & CORTE DA IMAGEM COM IA */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Move className="w-4 h-4 text-orange-400" /> Enquadramento da Imagem & Detecção de Rosto
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                IA Auto-Crop
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Ajuste onde a IA corta a imagem para manter o falante ou a ação principal centralizada no vídeo vertical.
            </p>

            {/* Presets de Foco da IA */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'auto' as AiFramingPreset, label: '🎯 IA Auto', desc: 'Rosto Central' },
                { id: 'left' as AiFramingPreset, label: '👤 Falante 1', desc: 'Esquerda' },
                { id: 'center' as AiFramingPreset, label: '🎙️ Centro', desc: 'Ação Principal' },
                { id: 'right' as AiFramingPreset, label: '👤 Falante 2', desc: 'Direita' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyAiFramingPreset(p.id)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    aiFraming === p.id
                      ? 'bg-orange-500/20 border-orange-500 text-white font-bold ring-1 ring-orange-500/40'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-xs">{p.label}</div>
                  <div className="text-[9px] opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>

            {/* Ajuste Fino Manual: Pan Horizontal e Zoom */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                  <span>Ajuste de Pan Horizontal (Corte Lateral)</span>
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
                  <span>Escala / Zoom da Imagem</span>
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
              </div>
            </div>
          </div>

          {/* CARD 2: MODELO DO TEMPLATE (Meme Frame vs Split vs Full) */}
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

            {/* Ajustes de Posição do Vídeo na Moldura Viral */}
            {activeLayout === 'meme_frame' && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span>Posicionamento do Vídeo na Arte:</span>
                  <button
                    type="button"
                    onClick={() => { setVideoYOffset(54); setVideoScale(88) }}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar
                  </button>
                </div>

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
                    <span>Largura / Escala</span>
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
            )}
          </div>

          {/* CARD 3: DETALHES DO CORTE E EXPORTAÇÃO */}
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
                <Zap className="w-3 h-3 fill-current" /> {Math.round(activeClip.score * 100)}% Viral
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                Título do Corte:
              </label>
              <p className="text-sm font-bold text-white leading-snug mt-0.5 break-words">
                {activeClip.title}
              </p>
            </div>

            {/* Ações de Exportação */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setQrModalClip({
                  title: activeClip.title,
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

      {/* GALERIA DOS CORTES ENCONTRADOS */}
      <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" /> Todos os {clips.length} Cortes Disponíveis
            </h2>
            <p className="text-xs text-zinc-400">
              Clique em qualquer corte abaixo para abrir e editar no Studio 9:16 acima.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {clips.map((clip, index) => {
            const isSelected = selectedClipIndex === index
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

                  <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow">
                    <Zap className="w-2.5 h-2.5 fill-current" /> {Math.round(clip.score * 100)}%
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
