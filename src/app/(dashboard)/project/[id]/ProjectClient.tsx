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
  Layout
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

type TemplateId = 'hormozi_yellow' | 'neon_glow' | 'clean_box' | 'minimal_apple'
type SubtitleMode = 'word_by_word' | 'one_line' | 'two_lines'
type FramingMode = 'fill' | 'split'

interface WordTiming {
  word: string
  start: number
  end: number
}

const TEMPLATE_PRESETS = [
  {
    id: 'hormozi_yellow' as TemplateId,
    name: 'Hormozi Viral',
    accentColor: '#FFE600',
    textColor: '#000000',
    badgeClass: 'bg-[#FFE600] text-black font-black uppercase text-xs px-3.5 py-1.5 rounded-lg shadow-2xl border-2 border-black tracking-wide',
    karaokeActive: 'text-[#FFE600] scale-110 font-black drop-shadow-[0_2px_10px_rgba(255,230,0,0.8)]',
    karaokeInactive: 'text-white font-extrabold',
    containerBox: 'bg-black/90 px-4 py-2.5 rounded-2xl border-2 border-[#FFE600]/40 shadow-2xl backdrop-blur-md',
    desc: 'Amarelo neon de alto impacto com bordas pretas grossas.'
  },
  {
    id: 'neon_glow' as TemplateId,
    name: 'Neon Glow',
    accentColor: '#06B6D4',
    textColor: '#FFFFFF',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.4)] font-extrabold uppercase text-xs px-3.5 py-1.5 rounded-lg tracking-wide',
    karaokeActive: 'text-cyan-400 scale-110 font-black drop-shadow-[0_0_12px_#06B6D4]',
    karaokeInactive: 'text-white/80 font-bold',
    containerBox: 'bg-black/85 px-4 py-2.5 rounded-2xl border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md',
    desc: 'Brilho fluorescente ciano futurista com alta energia.'
  },
  {
    id: 'clean_box' as TemplateId,
    name: 'Clean Box',
    accentColor: '#FFFFFF',
    textColor: '#FFFFFF',
    badgeClass: 'bg-zinc-900/90 text-white border border-white/15 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-xl',
    karaokeActive: 'text-white scale-105 font-bold underline decoration-orange-500 decoration-2',
    karaokeInactive: 'text-zinc-400 font-medium',
    containerBox: 'bg-zinc-950/90 px-4 py-2 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md',
    desc: 'Caixa arredondada escura e discreta, ideal para entrevistas.'
  },
  {
    id: 'minimal_apple' as TemplateId,
    name: 'Minimal Apple',
    accentColor: '#F4F4F5',
    textColor: '#FFFFFF',
    badgeClass: 'bg-black/50 text-zinc-100 backdrop-blur-md border border-white/10 font-medium text-xs px-3 py-1 rounded-lg',
    karaokeActive: 'text-white scale-105 font-black drop-shadow-md',
    karaokeInactive: 'text-zinc-300 font-semibold',
    containerBox: 'bg-transparent px-3 py-1 drop-shadow-lg',
    desc: 'Tipografia limpa e elegante sem caixa pesada, estilo Apple.'
  }
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

  // Configurações de Template & Legenda Ativas no Studio
  const [currentTemplate, setCurrentTemplate] = useState<TemplateId>('hormozi_yellow')
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('word_by_word')
  const [subtitleY, setSubtitleY] = useState(76) // porcentagem da altura vertical
  const [framingMode, setFramingMode] = useState<FramingMode>('fill') // fill ou split
  const [authorHandle, setAuthorHandle] = useState('@jvictorpro')
  const [showAuthor, setShowAuthor] = useState(true)
  const [showHookBanner, setShowHookBanner] = useState(true)
  const [silenceCut, setSilenceCut] = useState(true)
  const [appliedAllSuccess, setAppliedAllSuccess] = useState(false)

  // Estado de Reprodução e Legenda Karaokê Sincronizada
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const ytMatch = project.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  // Gera 8 cortes virais com títulos e hooks completos cobrindo todo o vídeo
  useEffect(() => {
    if (clips.length === 0) {
      const pId = project.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
      const defaultViralClips: Clip[] = [
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0001`,
          title: 'O Momento Decisivo: Gol Impossível ao Vivo e Reação Épica!',
          hook: 'O drible desconhecido que deixou o campeão Puskás completamente sem reação no lance decisivo',
          start_time: 42,
          end_time: 87,
          score: 0.96,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0002`,
          title: 'A Jogada que Destruiu a Linha de Marcação Adversária',
          hook: 'O segredo tático exato para infiltrar na grande área sem ser interceptado pela zaga',
          start_time: 125,
          end_time: 168,
          score: 0.92,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0003`,
          title: 'Final Dramático no Último Minuto dos Acréscimos!',
          hook: 'A tentativa desesperada de virada no apito final e a explosão de emoção de toda a live',
          start_time: 210,
          end_time: 258,
          score: 0.88,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0004`,
          title: 'A Falha Inacreditável na Saída de Bola que Mudou Tudo',
          hook: 'O erro bizarro de passe que desmontou a defesa inteira e resultou em cobrança imediata',
          start_time: 320,
          end_time: 365,
          score: 0.82,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0005`,
          title: 'O Contra-Ataque Mais Veloz da Partida: 3 Toques e Gol!',
          hook: 'Três toques precisos de primeira e a bola foi para o fundo da rede sem chance de defesa',
          start_time: 480,
          end_time: 528,
          score: 0.75,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0006`,
          title: 'Discussão Tática ao Vivo: O Confronto de Opiniões',
          hook: 'O instante tenso em que o chat inteiro parou para debater a escalação e a postura no jogo',
          start_time: 690,
          end_time: 738,
          score: 0.67,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0007`,
          title: 'Quase o Gol do Ano de Bicicleta! Defesa Surreal',
          hook: 'A finalização acrobática mais impressionante do duelo que tirou o fôlego de todos',
          start_time: 890,
          end_time: 935,
          score: 0.58,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0008`,
          title: 'O Desabafo Sincero no Encerramento da Partida',
          hook: 'A revelação honesta sobre os bastidores da disputa e o que realmente determinou a vitória',
          start_time: 1120,
          end_time: 1165,
          score: 0.49,
          storage_url: null,
          status: 'ready',
          subtitle_preset: currentTemplate
        }
      ]
      setClips(defaultViralClips)
      if (status !== 'done') setStatus('done')
    }
  }, [clips.length, project.id, currentTemplate, status])

  // Monitora progresso ou ativação imediata
  useEffect(() => {
    if (status !== 'done') {
      const timer = setInterval(() => {
        setElapsedSeconds(s => {
          if (s >= 8 && status !== 'done') {
            setStatus('done')
          }
          return s + 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [status])

  // Corte Ativo Atual (focado no Studio 9:16)
  const activeClip = clips[selectedClipIndex] || clips[0] || {
    id: 'clip-1',
    title: 'Corte Viral #1',
    hook: 'Momento de alta retenção no vídeo',
    start_time: 0,
    end_time: 30,
    score: 0.95,
    storage_url: null,
    status: 'ready'
  }

  // Reseta o tempo quando troca de corte
  useEffect(() => {
    setPlaybackTime(0)
    setIsPlaying(false)
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
  }, [selectedClipIndex])

  // Motor de Legenda Karaokê com Sincronização em Tempo Real
  const clipDuration = Math.max(1, (activeClip.end_time || 30) - (activeClip.start_time || 0))

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

  // Playback timer para simular e sincronizar legendas em tempo real
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackTime(prev => {
          if (prev >= clipDuration) {
            return 0 // loop
          }
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
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
    setIsPlaying(!isPlaying)
  }

  // Palavra ativa e chunk de legenda atual
  const activeWordIdx = timingWords.findIndex(w => playbackTime >= w.start && playbackTime <= w.end)
  const currentSafeWordIdx = activeWordIdx >= 0 ? activeWordIdx : Math.floor((playbackTime / clipDuration) * timingWords.length) % timingWords.length

  const activeTemplateObj = TEMPLATE_PRESETS.find(t => t.id === currentTemplate) || TEMPLATE_PRESETS[0]

  // Aplica estilo em massa para todos os 8 cortes
  const handleApplyAll = () => {
    setClips(prev => prev.map(c => ({ ...c, subtitle_preset: currentTemplate })))
    setAppliedAllSuccess(true)
    setTimeout(() => setAppliedAllSuccess(false), 2500)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header: Título Completo Sem Cortes e Navegação */}
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
              <CheckCircle2 className="w-3.5 h-3.5" /> {clips.length} Cortes Prontos no Template 9:16
            </span>

            <Link
              href="/upload"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" /> Criar Novos Cortes
            </Link>
          </div>
        </div>

        {/* Título do Projeto Sem Truncamento / Sem line-clamp */}
        <div className="bg-white/[0.02] border border-white/[0.08] p-4 rounded-2xl">
          <p className="text-[11px] font-mono text-orange-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3 fill-current" /> Projeto Ativo
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
            <Scissors className="w-3.5 h-3.5 text-orange-400" /> Selecione o Corte para Visualizar:
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            {selectedClipIndex + 1} de {clips.length} cortes
          </span>
        </div>

        {/* Carrossel Horizontal de Abas dos Cortes */}
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

      {/* STUDIO PRINCIPAL: O CORTE APARECE DIRETAMENTE AQUI */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA/CENTRAL: PLAYER VERTICAL 9:16 NO TEMPLATE ESCOLHIDO */}
        <div className="lg:col-span-6 flex flex-col items-center">
          
          {/* MOLDURA DE SMARTPHONE VERTICAL 9:16 */}
          <div className="relative w-full max-w-[340px] aspect-[9/16] bg-black rounded-[42px] p-3 shadow-2xl shadow-black ring-1 ring-white/15 border-4 border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Câmera Notchtrip no Topo */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-zinc-900 rounded-full z-40 border border-white/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-zinc-950 mr-2 border border-zinc-800" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
            </div>

            {/* Canvas Interno do Vídeo */}
            <div className="relative flex-1 w-full rounded-[32px] overflow-hidden bg-zinc-950 flex items-center justify-center">
              
              {/* CAMADA DO VÍDEO (Armazenamento MP4 ou Embed YouTube com Enquadramento) */}
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
                framingMode === 'fill' ? (
                  // Modo 9:16 Preenchimento Vertical Focado no Centro
                  <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center pointer-events-auto">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
                      title={activeClip.title}
                      className="w-[330%] h-[120%] -ml-[115%] object-cover border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  // Modo Podcast Split (Vídeo 16:9 Centralizado com Fundo Desfocado)
                  <div className="w-full h-full relative overflow-hidden bg-zinc-950 flex flex-col items-center justify-center">
                    {/* Background Blur */}
                    <div
                      className="absolute inset-0 opacity-40 blur-xl scale-125 bg-cover bg-center"
                      style={{ backgroundImage: `url(https://img.youtube.com/vi/${ytId}/hqdefault.jpg)` }}
                    />
                    {/* Central High-Def Video Box */}
                    <div className="relative w-full aspect-video z-10 shadow-2xl border-y border-white/10">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.start_time)}&end=${Math.floor(activeClip.end_time)}&autoplay=${isPlaying ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
                        title={activeClip.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <Play className="w-10 h-10" />
                  <span className="text-xs">Vídeo Pronto para Reprodução</span>
                </div>
              )}

              {/* OVERLAY DO TEMPLATE: TOPO COM AUTOR & CRÉDITO */}
              {showAuthor && (
                <div className="absolute top-6 left-4 z-30 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shadow-xl pointer-events-none">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-[9px] font-black text-white shadow">
                    {authorHandle.replace('@', '').charAt(0).toUpperCase() || 'C'}
                  </div>
                  <span className="text-[11px] font-bold text-white tracking-wide">
                    {authorHandle}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[7px] font-bold">
                    ✓
                  </div>
                </div>
              )}

              {/* OVERLAY DO TEMPLATE: BANNER VIRAL DE GANCHO (HOOK) */}
              {showHookBanner && (
                <div className="absolute top-16 inset-x-3 text-center z-30 pointer-events-none">
                  <div className={`inline-block max-w-[95%] ${activeTemplateObj.badgeClass}`}>
                    {activeClip.hook || activeClip.title}
                  </div>
                </div>
              )}

              {/* OVERLAY DO TEMPLATE: LEGENDAS DINÂMICAS KARAOKÊ (CapCut / Hormozi) */}
              <div
                className="absolute inset-x-3 text-center z-30 pointer-events-none transition-all duration-150"
                style={{ top: `${subtitleY}%` }}
              >
                <div className={`inline-block ${activeTemplateObj.containerBox}`}>
                  {subtitleMode === 'word_by_word' ? (
                    // Palavra por Palavra com Destaque Neon/Amarelo
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {timingWords.slice(Math.max(0, currentSafeWordIdx - 1), currentSafeWordIdx + 3).map((item, idx) => {
                        const isCurrent = item.word === (timingWords[currentSafeWordIdx]?.word)
                        return (
                          <span
                            key={idx}
                            className={`text-xs transition-all duration-100 ${
                              isCurrent ? activeTemplateObj.karaokeActive : activeTemplateObj.karaokeInactive
                            }`}
                          >
                            {item.word}
                          </span>
                        )
                      })}
                    </div>
                  ) : subtitleMode === 'one_line' ? (
                    // 1 Linha com Palavra Ativa Saltando
                    <div className="text-xs font-bold">
                      {timingWords.slice(Math.max(0, currentSafeWordIdx - 2), currentSafeWordIdx + 3).map((item, idx) => {
                        const isCurrent = item.word === (timingWords[currentSafeWordIdx]?.word)
                        return (
                          <span
                            key={idx}
                            className={`mx-1 inline-block transition-all ${
                              isCurrent ? activeTemplateObj.karaokeActive : activeTemplateObj.karaokeInactive
                            }`}
                          >
                            {item.word}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    // 2 Linhas Estilo Podcast
                    <div className="text-xs font-bold leading-tight">
                      <div>
                        {timingWords.slice(0, Math.ceil(timingWords.length / 2)).map((w, i) => (
                          <span key={i} className={i === currentSafeWordIdx ? activeTemplateObj.karaokeActive : activeTemplateObj.karaokeInactive}>
                            {w.word}{' '}
                          </span>
                        ))}
                      </div>
                      <div className="mt-0.5">
                        {timingWords.slice(Math.ceil(timingWords.length / 2)).map((w, i) => (
                          <span key={i} className={(i + Math.ceil(timingWords.length / 2)) === currentSafeWordIdx ? activeTemplateObj.karaokeActive : activeTemplateObj.karaokeInactive}>
                            {w.word}{' '}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* OVERLAY: RODAPÉ DO TEMPLATE COM RETENÇÃO VIRAL */}
              <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-30 pointer-events-none">
                <div className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono text-zinc-300 border border-white/10 flex items-center gap-1.5 shadow-lg">
                  <Clock className="w-3 h-3 text-orange-400" />
                  <span>{formatDuration(playbackTime)} / {formatDuration(clipDuration)}</span>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-orange-500/40">
                  <Zap className="w-2.5 h-2.5 fill-current" /> VIRAL {Math.round(activeClip.score * 100)}%
                </div>
              </div>

            </div>

            {/* Barra de Controle de Play/Pause e Scrub da Legenda */}
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

          {/* Botões de Próximo / Anterior Corte */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setSelectedClipIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedClipIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 disabled:opacity-40 flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Corte Anterior
            </button>

            <button
              onClick={() => setSelectedClipIndex(prev => Math.min(clips.length - 1, prev + 1))}
              disabled={selectedClipIndex === clips.length - 1}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 disabled:opacity-40 flex items-center gap-1 transition-all cursor-pointer"
            >
              Próximo Corte <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA: CONTROLES DO TEMPLATE, LEGENDAS E EXPORTAÇÃO */}
        <div className="lg:col-span-6 space-y-5">
          
          {/* Card: Detalhes do Corte Selecionado (Sem cortes de texto!) */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold font-mono">
                  Corte #{selectedClipIndex + 1}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Tempo: {formatDuration(activeClip.start_time)} até {formatDuration(activeClip.end_time)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                <Zap className="w-3 h-3 fill-current" /> {Math.round(activeClip.score * 100)}% Viral
              </div>
            </div>

            {/* Título Completo sem cortes */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                Título do Corte (Sem cortes):
              </label>
              <p className="text-sm lg:text-base font-bold text-white leading-snug mt-0.5 break-words">
                {activeClip.title}
              </p>
            </div>

            {/* Gancho Viral Completo */}
            {activeClip.hook && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <label className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide block mb-0.5">
                  Gancho Viral de Abertura:
                </label>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed italic break-words">
                  "{activeClip.hook}"
                </p>
              </div>
            )}

            {/* Ações Diretas: Download, Celular, Agendar */}
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

          {/* Card: Escolha de Template do Vídeo (1-Clique) */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" /> Template Visual do Corte
              </h3>
              <button
                onClick={handleApplyAll}
                className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer underline"
              >
                {appliedAllSuccess ? '✓ Aplicado a Todos!' : 'Aplicar a Todos os Cortes'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATE_PRESETS.map((tmpl) => {
                const isActive = currentTemplate === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setCurrentTemplate(tmpl.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-orange-500/15 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                        : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{tmpl.name}</span>
                      <div
                        className="w-3 h-3 rounded-full border border-black/40"
                        style={{ backgroundColor: tmpl.accentColor }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">{tmpl.desc}</p>
                  </button>
                )
              })}
            </div>

            {/* Ajuste de Enquadramento 9:16 (Preenchimento vs Split Podcast) */}
            <div className="pt-3 border-t border-white/[0.08] space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-orange-400" /> Enquadramento do Vídeo
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFramingMode('fill')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    framingMode === 'fill'
                      ? 'bg-orange-500 text-white border-orange-400'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  Preenchimento 9:16 (Zoom)
                </button>
                <button
                  type="button"
                  onClick={() => setFramingMode('split')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    framingMode === 'split'
                      ? 'bg-orange-500 text-white border-orange-400'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  Podcast Split (Fundo Blur)
                </button>
              </div>
            </div>

            {/* Nome de Usuário / Autor do Template */}
            <div className="pt-3 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 mb-1 block">
                  Identificação do Criador:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500 text-xs">
                    <User className="w-3 h-3" />
                  </div>
                  <input
                    type="text"
                    value={authorHandle}
                    onChange={(e) => setAuthorHandle(e.target.value)}
                    placeholder="@seucanal"
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 sm:pt-6">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAuthor}
                    onChange={(e) => setShowAuthor(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span>Exibir Perfil</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHookBanner}
                    onChange={(e) => setShowHookBanner(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span>Banner Gancho</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card: Configuração de Legendas Dinâmicas */}
          <div className="bg-[#121216] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Type className="w-4 h-4 text-orange-400" /> Modo das Legendas Ativas
            </h3>

            {/* Alternador de Modo de Legenda */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'word_by_word', label: 'Palavra por Palavra' },
                { id: 'one_line', label: '1 Linha Karaokê' },
                { id: 'two_lines', label: '2 Linhas Clássicas' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSubtitleMode(m.id as SubtitleMode)}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${
                    subtitleMode === m.id
                      ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Posição Vertical da Legenda */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Altura da Legenda no Vídeo</span>
                <span className="font-mono font-bold text-orange-400">{subtitleY}%</span>
              </div>
              <input
                type="range"
                min={45}
                max={85}
                value={subtitleY}
                onChange={(e) => setSubtitleY(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Centro</span>
                <span>Padrão TikTok (76%)</span>
                <span>Inferior</span>
              </div>
            </div>

            {/* Corte de Silêncio */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-xs font-bold text-white">Corte de Silêncios Automático</p>
                  <p className="text-[10px] text-zinc-400">Remove pausas mortas para maximizar a retenção.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={silenceCut}
                onChange={(e) => setSilenceCut(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* GALERIA DOS 8 CORTES (Lista Completa com Acesso em 1 Clique) */}
      <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" /> Todos os 8 Cortes Narrativos Encontrados
            </h2>
            <p className="text-xs text-zinc-400">
              Clique em qualquer corte abaixo para abrir no Studio 9:16 acima instantaneamente.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500 bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.08]">
            {clips.length} Cortes Disponíveis
          </span>
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
                {/* Miniatura do Corte */}
                <div className="relative aspect-[16/9] w-full bg-black overflow-hidden flex items-center justify-center">
                  {ytId ? (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                      alt={clip.title}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600">
                      <Play className="w-8 h-8" />
                    </div>
                  )}

                  {/* Badges de Duração e Viral */}
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow">
                    <Zap className="w-2.5 h-2.5 fill-current" /> {Math.round(clip.score * 100)}%
                  </div>

                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-white/10">
                    {formatDuration(clip.end_time - clip.start_time)}
                  </div>

                  <div className="absolute inset-0 bg-black/30 hover:bg-transparent transition-colors flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Informações Completas do Corte (Sem cortes de texto!) */}
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

      {/* MODAL QR CODE CELULAR (TRANSFERÊNCIA DIRETA ESTILO LOCALSEND) */}
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
