'use client'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { SweepStepper } from '@/components/ui/SweepStepper'
import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Download,
  Gauge,
  Shield,
  Smile,
  Type as TypeIcon,
  Image as ImageIcon,
  Sparkle,
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
  Share2,
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
  Flame,
  AlertCircle
} from 'lucide-react'
import { formatDuration, downloadVideoFile } from '@/lib/utils'
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
  transcript?: string | null
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

// `key` = etapa que o backend grava em projects.error_message ("step:<key>") durante o processamento
const PIPELINE_STEPS = [
  { key: 'download', label: 'Baixando vídeo', detail: 'yt-dlp + Deno runtime', thresholdSecs: 0 },
  { key: 'transcricao', label: 'Transcrevendo áudio', detail: 'Groq Whisper com tempo por palavra', thresholdSecs: 40 },
  { key: 'ia_curator', label: 'IA identificando momentos virais', detail: 'Gemini analisando o conteúdo', thresholdSecs: 90 },
  { key: 'gerando_clipes', label: 'Criando cortes 9:16', detail: 'FFmpeg aplicando seu template', thresholdSecs: 160 },
]

// Sem notícia do backend por esse tempo, o pipeline provavelmente morreu
const PIPELINE_TIMEOUT_SECS = 20 * 60

const ERROR_CATEGORIES: Array<{
  match: (e: string) => boolean
  label: string
  color: string
  icon: string
  hint: string
  canRetry: boolean
}> = [
  {
    match: e => /sign in|bot|confirm|po.?token|nsig/i.test(e),
    label: 'Bloqueio anti-bot do YouTube',
    color: 'amber',
    icon: '🤖',
    hint: 'O YouTube detectou que o download veio de um servidor. Tente novamente — na segunda tentativa costuma funcionar (cliente iOS/tv_embedded).',
    canRetry: true,
  },
  {
    match: e => /unavailable|private|removed|age.?restrict|login.?required/i.test(e),
    label: 'Vídeo indisponível',
    color: 'orange',
    icon: '🔒',
    hint: 'O vídeo é privado, removido, tem restrição de idade ou não está disponível na região do servidor.',
    canRetry: false,
  },
  {
    match: e => /429|rate.?limit|too many/i.test(e),
    label: 'Limite de requisições (429)',
    color: 'amber',
    icon: '⏳',
    hint: 'O YouTube está bloqueando temporariamente. Aguarde alguns minutos e tente novamente.',
    canRetry: true,
  },
  {
    match: e => /transcrição|transcri|whisper/i.test(e),
    label: 'Falha na transcrição',
    color: 'amber',
    icon: '🎙️',
    hint: 'O processo de transcrição do áudio falhou. Tente com um vídeo mais curto ou com áudio mais claro.',
    canRetry: true,
  },
  {
    match: e => /timeout|socket|connection|timed out|pipeline interrompido/i.test(e),
    label: 'Timeout de conexão',
    color: 'zinc',
    icon: '🔌',
    hint: 'A conexão expirou ou o pipeline foi interrompido. Tente novamente.',
    canRetry: true,
  },
  {
    match: e => /openai|anthropic|claude|api.*key|quota|análise.*ia|ia.*curator/i.test(e),
    label: 'Erro na API de IA',
    color: 'purple',
    icon: '🧠',
    hint: 'Falha ao chamar a IA. Serviço pode estar temporariamente indisponível. Tente novamente.',
    canRetry: true,
  },
  {
    match: e => /ffmpeg|render|clip|vertical/i.test(e),
    label: 'Erro ao renderizar corte',
    color: 'red',
    icon: '🎬',
    hint: 'O FFmpeg falhou ao criar o vídeo 9:16. Pode ser falta de memória no servidor.',
    canRetry: true,
  },
  {
    match: e => /supabase|storage|bucket|upload/i.test(e),
    label: 'Erro de armazenamento',
    color: 'blue',
    icon: '💾',
    hint: 'Falha ao salvar o vídeo no Supabase Storage. Verifique as permissões do bucket.',
    canRetry: true,
  },
  {
    match: e => /durationerror|longo demais|limite.*minuto|minutos por v/i.test(e),
    label: 'Vídeo muito longo',
    color: 'orange',
    icon: '⏱️',
    hint: 'O vídeo ultrapassa o limite de 90 minutos. Envie um trecho menor ou escolha um vídeo mais curto.',
    canRetry: false,
  },
]

function FailedPanel({ projectId, sourceUrl, errorMessage, onRetry }: {
  projectId: string
  sourceUrl: string | null
  errorMessage?: string | null
  onRetry: () => Promise<void>
}) {
  const [retrying, setRetrying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorTime, setErrorTime] = useState('')
  useEffect(() => {
    setErrorTime(new Date().toLocaleTimeString('pt-BR'))
  }, [])

  const errLower = (errorMessage || '').toLowerCase()
  const category = ERROR_CATEGORIES.find(c => c.match(errLower)) || {
    label: 'Erro inesperado',
    color: 'red',
    icon: '❌',
    hint: 'Ocorreu um erro não categorizado. Copie o código abaixo e compartilhe para diagnóstico.',
    canRetry: true,
  }

  async function handleRetry() {
    if (!sourceUrl) return
    setRetrying(true)
    await onRetry()
    setRetrying(false)
  }

  function copyError() {
    const text = `Erro Clippost — ${new Date().toLocaleString('pt-BR')}\nProjeto: ${projectId}\nURL: ${sourceUrl || '—'}\nCategoria: ${category.label}\nDetalhe: ${errorMessage || '(sem detalhe)'}`
    navigator.clipboard.writeText(text).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const colorMap: Record<string, string> = {
    amber:  'bg-amber-500/10 border-amber-500/25 text-amber-300',
    orange: 'bg-orange-500/10 border-orange-500/25 text-orange-300',
    red:    'bg-red-500/10 border-red-500/25 text-red-300',
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-300',
    blue:   'bg-blue-500/10 border-blue-500/25 text-blue-300',
    zinc:   'bg-zinc-500/10 border-zinc-500/25 text-zinc-300',
  }
  const colorClass = colorMap[category.color] || colorMap.red

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
      <div className={`border rounded-2xl p-5 space-y-4 ${colorClass}`}>

        {/* Cabeçalho da categoria */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5 select-none">{category.icon}</span>
            <div>
              <span className="text-sm font-bold text-white">{category.label}</span>
              <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed max-w-xl">{category.hint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={copyError}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-zinc-400 hover:text-white text-[11px] font-medium transition-all cursor-pointer border border-white/[0.08]"
            title="Copiar erro para diagnóstico"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado!' : 'Copiar erro'}
          </button>
        </div>

        {/* Código de erro técnico */}
        {errorMessage ? (
          <div className="rounded-xl bg-black/50 border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Código de erro do servidor</span>
              <span className="text-[10px] font-mono text-zinc-600" suppressHydrationWarning>{errorTime}</span>
            </div>
            <pre className="px-3 py-3 text-[11px] font-mono text-zinc-300 break-all whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {errorMessage}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl bg-black/40 border border-white/[0.06] px-3 py-2.5">
            <span className="text-[11px] font-mono text-zinc-600 italic">Nenhum detalhe retornado pelo servidor. Verifique os logs do Fly.io.</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {category.canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying || !sourceUrl}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              {retrying ? 'Reprocessando...' : 'Tentar novamente'}
            </button>
          )}
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-zinc-300 text-xs font-medium transition-all"
          >
            <Scissors className="w-3.5 h-3.5" /> Novo vídeo
          </Link>
          <span className="text-[10px] text-zinc-600 font-mono ml-auto hidden sm:block">
            projeto: {projectId.slice(0, 8)}…
          </span>
        </div>
      </div>
    </div>
  )
}

function PipelineProgress({ elapsedSecs, clipsReady, backendStep }: { elapsedSecs: number; clipsReady: number; backendStep?: string | null }) {
  const realIdx = backendStep?.startsWith('step:')
    ? PIPELINE_STEPS.findIndex(s => s.key === backendStep.slice(5))
    : -1
  const activeIdx = clipsReady > 0
    ? PIPELINE_STEPS.length - 1
    : realIdx >= 0
    ? realIdx
    : (() => {
        let idx = 0
        for (let i = PIPELINE_STEPS.length - 1; i >= 0; i--) {
          if (elapsedSecs >= PIPELINE_STEPS[i].thresholdSecs) { idx = i; break }
        }
        return idx
      })()

  const elapsed = `${Math.floor(elapsedSecs / 60)}m ${(elapsedSecs % 60).toString().padStart(2, '0')}s`

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
      <div className="bg-[#0d0d14] border border-indigo-500/25 rounded-2xl p-5 space-y-4">
        {/* cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Processando com IA</span>
                {clipsReady > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {clipsReady} {clipsReady === 1 ? 'corte pronto' : 'cortes prontos'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {clipsReady === 0
                  ? 'Configure o template abaixo enquanto os cortes são gerados'
                  : `Corte #${clipsReady} pronto! Gerando mais em segundo plano...`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider block">Tempo</span>
            <span className="text-sm font-bold text-white font-mono">{elapsed}</span>
          </div>
        </div>

        {/* barra de progresso geral */}
        <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
            style={{ width: `${clipsReady > 0 ? 90 : Math.min(85, (activeIdx / (PIPELINE_STEPS.length - 1)) * 80 + 5)}%` }}
          />
        </div>

        {/* steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = i < activeIdx || (i === activeIdx && clipsReady > 0 && i === PIPELINE_STEPS.length - 1)
            const isActive = i === activeIdx && !(clipsReady > 0 && i === PIPELINE_STEPS.length - 1)
            const isPending = i > activeIdx

            return (
              <div
                key={i}
                className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-emerald-500/8 border-emerald-500/20'
                    : isActive
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-white/[0.02] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-500/20' : isActive ? 'bg-indigo-500/20' : 'bg-white/[0.06]'
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                    ) : (
                      <span className="text-[9px] font-mono text-zinc-500">{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isDone ? 'text-emerald-400' : isActive ? 'text-indigo-300' : 'text-zinc-600'
                  }`}>
                    {isDone ? 'Concluído' : isActive ? 'Em andamento' : 'Aguardando'}
                  </span>
                </div>
                <span className={`text-xs font-semibold leading-tight ${
                  isDone ? 'text-zinc-200' : isActive ? 'text-white' : 'text-zinc-500'
                }`}>
                  {step.label}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono leading-tight">{step.detail}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

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
  // Zera ao reprocessar; senão um projeto antigo abriria direto na tela de "demorou demais"
  const [processingSince, setProcessingSince] = useState(() => new Date(project.created_at).getTime())
  const [elapsedSecs, setElapsedSecs] = useState(() => Math.max(0, Math.floor((Date.now() - processingSince) / 1000)))
  // Incrementar reinicia o polling, que para sozinho quando o projeto termina ou falha
  const [pollKey, setPollKey] = useState(0)

  useEffect(() => {
    const tick = () => setElapsedSecs(Math.max(0, Math.floor((Date.now() - processingSince) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [processingSince])

  const [clips, setClips] = useState<Clip[]>(initialClips)
  const [status, setStatus] = useState(project.status)
  const [errorMessage, setErrorMessage] = useState<string | null>((project as any).error_message || null)
  const [selectedClipIndex, setSelectedClipIndex] = useState(0)
  // Ref para rastrear contagem de clips sem stale closure no polling
  const clipsCountRef = useRef(initialClips.length)
  const [qrModalClip, setQrModalClip] = useState<{ title: string; url: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [schedulingAllProject, setSchedulingAllProject] = useState(false)
  const [scheduleAllMsg, setScheduleAllMsg] = useState('')

  // ESTADOS DE EDIÇÃO EM MASSA & ESTÚDIO
  const [applyToAllClips, setApplyToAllClips] = useState<boolean>(true)
  const [studioTab, setStudioTab] = useState<'speed' | 'format' | 'text' | 'watermark' | 'silence' | 'subtitles'>('speed')
  const [videoSpeed, setVideoSpeed] = useState<number>(1.05)
  const [showTitleEmojis, setShowTitleEmojis] = useState<boolean>(true)
  const [removeSilence, setRemoveSilence] = useState<boolean>(true)
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)

  // Marca D'água Anti-Furto
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true)
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text')
  const [watermarkText, setWatermarkText] = useState<string>('@clippost')
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null)
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(45)
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'bottom_center' | 'top_right' | 'top_left' | 'bottom_right'>('center')

  const triggerBulkFeedback = (msg: string) => {
    setBulkFeedback(msg)
    setTimeout(() => setBulkFeedback(null), 3000)
  }

  const handleScheduleAllProject = async () => {
    setSchedulingAllProject(true)
    setScheduleAllMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nao autenticado')
            let platform = 'instagram'
      let socialAccountId: string | null = null
      try {
        const saved = localStorage.getItem('clippost_active_account')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed?.id) {
            socialAccountId = parsed.id
            if (parsed.platform) platform = parsed.platform
          }
        }
      } catch {}
      if (!socialAccountId) {
        try {
          const { data: acc } = await supabase
            .from('social_accounts')
            .select('id, platform')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          if (acc) {
            socialAccountId = acc.id
            platform = acc.platform || 'instagram'
          }
        } catch {}
      } else {
        const { data: acc } = await supabase.from('social_accounts').select('id,platform').eq('user_id', user.id).eq('is_active', true).limit(1).single()
        if (acc) { socialAccountId = acc.id; platform = acc.platform }
      }
      const readyClips = clips.filter(clip => clip.storage_url)
      for (const clip of readyClips) {
        await supabase.from('scheduled_posts').insert({
          user_id: user.id, clip_id: clip.id, platform,
          social_account_id: socialAccountId,
          caption: clip.title || clip.hook || '',
          scheduled_at: new Date().toISOString(), status: 'scheduled',
        })
      }
      setScheduleAllMsg(`${readyClips.length} clipes agendados!`)
      setTimeout(() => setScheduleAllMsg(''), 4000)
    } catch (err: any) {
      setScheduleAllMsg('Erro: ' + err.message)
    } finally {
      setSchedulingAllProject(false)
    }
  }
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

  // Polling em tempo real contínuo: cortes aparecem um a um conforme são minerados
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    let active = true
    // Rastreamos localmente para decidir o próximo intervalo sem depender do estado React
    let localClipsCount = initialClips.length
    let localStatus = project.status

    async function fetchClipsAndStatus() {
      try {
        // 1. Tenta buscar via API direta com service role (sem limitações de RLS)
        const res = await fetch(`/api/projects/${project.id}`, {
          headers: { 'Cache-Control': 'no-store' }
        })

        if (res.ok) {
          const data = await res.json()
          if (data.project) {
            localStatus = data.project.status
            setStatus(data.project.status)
            if (data.project.error_message != null) setErrorMessage(data.project.error_message)
          }
          if (Array.isArray(data.clips)) {
            const readyClips = data.clips.filter((c: any) => c.status === 'ready' || c.storage_url)
            localClipsCount = readyClips.length
            const prevCount = clipsCountRef.current
            const changed = readyClips.length !== prevCount
            if (changed) {
              clipsCountRef.current = readyClips.length
              if (prevCount === 0 && readyClips.length > 0) {
                // Auto-seleciona o primeiro clip PRONTO
                const firstReadyIdx = data.clips.findIndex((c: any) => c.status === 'ready' || c.storage_url)
                if (firstReadyIdx >= 0) setSelectedClipIndex(firstReadyIdx)
                triggerBulkFeedback('Primeiro corte viral pronto!')
              } else if (readyClips.length > prevCount) {
                triggerBulkFeedback(`Corte #${readyClips.length} pronto!`)
              }
            }
            setClips(prev => {
              if (data.clips.length !== prev.length || data.clips.some((c: any, i: number) => c.storage_url !== prev[i]?.storage_url || c.status !== prev[i]?.status)) {
                return data.clips
              }
              return prev
            })
          }

          // Encerra polling quando o backend finalizar E não houver clips pendentes
          if (localStatus === 'done' || localStatus === 'completed' || localStatus === 'failed') {
            return
          }
          // Continua polling enquanto houver clips em rendering, mesmo que status seja done
          // (raro: projeto marcado done antes de todos clips atualizarem)

        } else if (res.status === 401) {
          // Sessão expirada — não faz fallback com Supabase client (causaria 401 em cadeia)
          console.warn('[polling] sessão expirada, aguardando renovação automática...')
        } else {
          // Fallback via Supabase Client direto (apenas para erros não-auth)
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return  // sem sessão, não adianta tentar

          const { data: dbClips, error: clipsErr } = await supabase
            .from('clips')
            .select('*')
            .eq('project_id', project.id)
            .order('score', { ascending: false })

          if (clipsErr) { console.warn('[polling] supabase clips:', clipsErr.message); return }

          const { data: projData } = await supabase
            .from('projects')
            .select('status, raw_video_url')
            .eq('id', project.id)
            .maybeSingle()

          if (projData?.status) {
            localStatus = projData.status
            setStatus(projData.status)
          }
          if (dbClips) {
            localClipsCount = dbClips.length
            if (dbClips.length > 0) setClips(dbClips)
          }
          if (localStatus === 'done' || localStatus === 'completed' || localStatus === 'failed') {
            return
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar cortes em tempo real:', err)
      }

      // Poll adaptativo: 1s enquanto aguarda o 1º clipe, 2.5s após tê-los
      if (active) {
        const delay = (localStatus === 'processing' && localClipsCount === 0) ? 1000 : 2500
        timer = setTimeout(fetchClipsAndStatus, delay)
      }
    }

    fetchClipsAndStatus()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [project.id, pollKey])

  async function reprocessProject() {
    const { data: { user } } = await supabase.auth.getUser()
    setProcessingSince(Date.now())
    setStatus('processing')
    setErrorMessage(null)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'processing', error_message: null }),
    }).catch(() => null)
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: project.source_url, project_id: project.id, user_id: user?.id }),
    }).catch(() => null)
    if (!res || !res.ok) {
      const detail = res ? await res.json().catch(() => ({})) : {}
      const msg = detail.error || 'O servidor de processamento não respondeu. Tente novamente em instantes.'
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error_message: msg }),
      }).catch(() => null)
      setStatus('failed')
      setErrorMessage(msg)
      return
    }
    setPollKey(k => k + 1)
  }

  const readyClips = clips.filter(c => c.status === 'ready' || c.storage_url)
  // activeClip sempre aponta para um clip pronto; se o índice selecionado for "rendering", usa o primeiro pronto
  const activeClip = (clips[selectedClipIndex]?.status === 'ready' || clips[selectedClipIndex]?.storage_url)
    ? clips[selectedClipIndex]
    : readyClips[0] || clips[0] || {
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
  // Tratamento de Emojis no Título (Pílula Com/Sem Emojis)
  const rawTitle = customTitle || activeClip.title || ''
  const emojiRegexGlobal = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu
  const cleanTitleWithoutEmojis = rawTitle.replace(emojiRegexGlobal, '').replace(/\s+/g, ' ').trim()
  const displayedTitle = showTitleEmojis ? rawTitle : cleanTitleWithoutEmojis

  // Virality metrics
  const activeVirality = useMemo(() => {
    return calculateViralityMetrics(
      activeClip.score,
      displayedTitle,
      activeClip.hook,
      clipDuration
    )
  }, [activeClip.score, displayedTitle, activeClip.hook, clipDuration])

  // Legendas e timestamps com precisão de milissegundos
  const timingWords = useMemo<WordTiming[]>(() => {
    // 1. Carrega array de palavras com timestamps exatos relativos ao corte
    try {
      const projTrans = project?.transcript
      if (projTrans && (projTrans.startsWith('{') || projTrans.startsWith('['))) {
        const parsedProj = JSON.parse(projTrans)
        const clipData = parsedProj[activeClip.id] || parsedProj[activeClip.title] || (parsedProj.clips && (parsedProj.clips[activeClip.id] || parsedProj.clips[activeClip.title]))
        if (clipData && Array.isArray(clipData.words) && clipData.words.length > 0) {
          return clipData.words.map((item: any) => ({
            word: String(item.word || '').toUpperCase(),
            start: Number(item.start || 0),
            end: Number(item.end || (Number(item.start || 0) + 0.35))
          }))
        }
      }
    } catch {}

    // 2. Se o corte tiver palavras salvas diretamente
    if (Array.isArray((activeClip as any).words) && (activeClip as any).words.length > 0) {
      return (activeClip as any).words.map((item: any) => ({
        word: String(item.word || '').toUpperCase(),
        start: Number(item.start || 0),
        end: Number(item.end || (Number(item.start || 0) + 0.35))
      }))
    }

    // 3. Fallback inteligente com palavras do texto real da conversa
    const rawTranscript = (activeClip as any).transcript || (activeClip as any).speech_text
    let wordsList: string[] = []
    if (rawTranscript && typeof rawTranscript === 'string') {
      wordsList = rawTranscript.replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '').split(/\s+/).filter(Boolean)
    } else {
      const contextual = `${activeClip.title || ''} ${activeClip.hook || ''}`.trim()
      wordsList = contextual.replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '').split(/\s+/).filter(Boolean)
    }
    if (wordsList.length === 0) {
      wordsList = ['ESSA', 'PARTE', 'AQUI', 'MUDOU', 'COMPLETAMENTE', 'O', 'RESULTADO', 'FINAL']
    }
    const wordDuration = clipDuration / wordsList.length
    return wordsList.map((w, idx) => ({
      word: w.toUpperCase(),
      start: Number((idx * wordDuration).toFixed(2)),
      end: Number(((idx + 1) * wordDuration).toFixed(2))
    }))
  }, [activeClip, project, clipDuration])

  const speechWords = useMemo<string[]>(() => {
    return timingWords.map(tw => tw.word)
  }, [timingWords])

  // Sincroniza velocidade de reprodução no player
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed
    }
  }, [videoSpeed, selectedClipIndex])

  // Sincroniza vídeo nativo ao trocar de corte
  useEffect(() => {
    setPlaybackTime(0)
    if (videoRef.current) {
      if (activeClip.storage_url) {
        videoRef.current.currentTime = 0
      } else if (project.raw_video_url) {
        videoRef.current.currentTime = activeClip.start_time || 0
      }
      if (isPlaying) {
        videoRef.current.play().catch(() => null)
      }
    }
  }, [activeClip.id, activeClip.storage_url])

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
    if (timingWords.length === 0) return 0
    const idx = timingWords.findIndex(w => playbackTime >= w.start && playbackTime <= w.end)
    if (idx !== -1) return idx
    for (let i = timingWords.length - 1; i >= 0; i--) {
      if (playbackTime >= timingWords[i].start) return i
    }
    return 0
  }, [playbackTime, timingWords])

  // Excluir projeto
  const handleDeleteThisProject = async () => {
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

  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null)

  const handleDownloadSingleClip = async (clip: Clip, index: number) => {
    if (!clip.storage_url) return
    setDownloadingClipId(clip.id)
    triggerBulkFeedback(`Baixando corte #${index + 1}...`)
    const fname = `corte_${index + 1}_${extractCoreSubject(project.title)}.mp4`
    await downloadVideoFile(clip.storage_url, fname)
    setDownloadingClipId(null)
  }

  // Baixar todos os cortes em lote (via Blob real direto no navegador)
  const handleDownloadAll = async () => {
    const readyClips = clips.filter(c => !!c.storage_url)
    if (readyClips.length === 0) {
      alert("Os arquivos de vídeo finais em 9:16 estão sendo renderizados pelo backend. Aguarde alguns instantes!")
      return
    }
    setDownloadingAll(true)
    triggerBulkFeedback(`Iniciando download de ${readyClips.length} cortes...`)
    for (let i = 0; i < readyClips.length; i++) {
      const clip = readyClips[i]
      const fname = `corte_${i + 1}_${extractCoreSubject(project.title)}.mp4`
      await downloadVideoFile(clip.storage_url!, fname)
    }
    setDownloadingAll(false)
    triggerBulkFeedback("Todos os cortes foram baixados com sucesso!")
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
            {status === 'processing' ? (
              <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Processando
              </span>
            ) : status === 'failed' ? (
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 whitespace-nowrap flex items-center gap-1">
                <X className="w-3 h-3" /> Falhou
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {clips.length} cortes prontos
              </span>
            )}
          </div>
        </div>

        {/* Ações Rápidas no Topo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={clips.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5 shadow-sm ${
              clips.length === 0
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingAll ? "Baixando..." : `Baixar Todos (${clips.length})`}</span>
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
      {clips.length > 0 && (
      <div className="border-b border-white/[0.06] bg-[#0b0b0e]/40 px-6 py-2 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap pr-2">
          Cortes:
        </span>
        {clips.map((clip, idx) => {
          const isSelected = selectedClipIndex === idx
          const isRendering = !clip.storage_url && clip.status === 'ready'
          const scorePercent = Math.round(clip.score * 100)
          return (
            <button
              key={clip.id}
              onClick={() => {
                if (!isRendering) {
                  setSelectedClipIndex(idx)
                  setCustomTitle('')
                  setPlaybackTime(0)
                }
              }}
              disabled={isRendering}
              title={isRendering ? 'Gerando corte...' : clip.title}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                isRendering
                  ? 'bg-indigo-500/8 border border-indigo-500/20 text-indigo-400/50 cursor-default'
                  : isSelected
                  ? 'bg-white/10 text-white border border-white/20 shadow-sm cursor-pointer'
                  : 'bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-transparent cursor-pointer'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400/60" />
                  <span className="font-semibold text-indigo-400/50">#{idx + 1}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">#{idx + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    scorePercent >= 90
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-indigo-500/15 text-indigo-400'
                  }`}>
                    {scorePercent}%
                  </span>
                </>
              )}
            </button>
          )
        })}
        {status === 'processing' && clips.some(c => !c.storage_url) && (
          <span className="text-[10px] text-indigo-400/60 font-mono italic whitespace-nowrap ml-1 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            cortando...
          </span>
        )}
      </div>
      )}

      {/* 3. TELA DE ESPERA: processando sem nenhum corte PRONTO ainda */}
      {status === 'processing' && !clips.some(c => c.status === 'ready' || c.storage_url) && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
          {elapsedSecs < PIPELINE_TIMEOUT_SECS ? (
            <>
              <PipelineProgress elapsedSecs={elapsedSecs} clipsReady={clips.length} backendStep={errorMessage} />
              <p className="mt-5 text-xs text-zinc-500 text-center max-w-sm">
                O estúdio abrirá automaticamente quando o primeiro corte ficar pronto.
              </p>
            </>
          ) : (
            /* Timeout de 8 min: pipeline travado — oferece retry automático */
            <div className="max-w-md w-full bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Pipeline demorou demais</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  O processamento não foi concluído em {PIPELINE_TIMEOUT_SECS / 60} minutos — pode ter sido interrompido pelo servidor. Tente novamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void reprocessProject() }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* BANNER DE PROGRESSO: processando com ao menos 1 corte pronto */}
      {status === 'processing' && clips.some(c => c.status === 'ready' || c.storage_url) && (
        <PipelineProgress elapsedSecs={elapsedSecs} clipsReady={clips.filter(c => c.status === 'ready' || c.storage_url).length} backendStep={errorMessage} />
      )}

      {/* PAINEL DE ERRO COM CAUSA E BOTÃO DE RETENTAR */}
      {status === 'failed' && (
        <FailedPanel
          projectId={project.id}
          sourceUrl={project.source_url}
          errorMessage={errorMessage}
          onRetry={reprocessProject}
        />
      )}

      {/* ESTADO VAZIO: processamento concluído mas sem cortes gerados com sucesso */}
      {(status === 'done' || status === 'completed') && !clips.some(c => c.status === 'ready' || c.storage_url) && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white mb-2">Nenhum corte viral encontrado</h3>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            O backend não gerou cortes para este vídeo. Isso pode acontecer se o vídeo for muito curto, se o processamento falhou silenciosamente, ou se o worker do Fly.io não estava disponível.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { void reprocessProject() }}
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-400 rounded-xl transition-all cursor-pointer"
            >
              Reprocessar Vídeo
            </button>
            <a href="/upload" className="px-4 py-2 text-xs font-semibold text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl transition-all">
              Enviar Outro Vídeo
            </a>
          </div>
        </div>
      )}

      {/* STUDIO: exibido apenas quando há ao menos um corte pronto */}
      {clips.some(c => c.status === 'ready' || c.storage_url) && (
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

                {/* MARCA D'ÁGUA ANTI-FURTO */}
                {watermarkEnabled && (
                  <div
                    style={{
                      opacity: watermarkOpacity / 100,
                      ...(watermarkPosition === 'center'
                        ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                        : watermarkPosition === 'top_right'
                        ? { top: '12%', right: '6%' }
                        : watermarkPosition === 'top_left'
                        ? { top: '12%', left: '6%' }
                        : watermarkPosition === 'bottom_right'
                        ? { bottom: '18%', right: '6%' }
                        : { bottom: '18%', left: '50%', transform: 'translateX(-50%)' })
                    }}
                    className="absolute pointer-events-none z-30 select-none flex items-center gap-1 transition-all"
                  >
                    {watermarkType === 'image' && watermarkImage ? (
                      <img src={watermarkImage} alt="Logo" className="max-h-8 max-w-[110px] object-contain drop-shadow-md" />
                    ) : (
                      <div className="px-2.5 py-1 rounded-md bg-black/45 backdrop-blur-xs border border-white/20 text-white font-bold font-mono text-[11px] tracking-wider drop-shadow-md whitespace-nowrap">
                        {watermarkText || brandHandle || '@clippost'}
                      </div>
                    )}
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
                      const targetTime = pct * clipDuration
                      setPlaybackTime(targetTime)
                      if (videoRef.current) {
                        if (activeClip.storage_url) {
                          videoRef.current.currentTime = targetTime
                        } else {
                          videoRef.current.currentTime = (activeClip.start_time || 0) + targetTime
                        }
                      }
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

                    {/* SPEED BADGE NO PLAYER */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const speeds = [1.0, 1.05, 1.15, 1.25, 1.5, 1.8, 2.0]
                        const curIdx = speeds.indexOf(videoSpeed)
                        const nextSpeed = speeds[(curIdx + 1) % speeds.length]
                        setVideoSpeed(nextSpeed)
                        if (applyToAllClips) {
                          triggerBulkFeedback(`Velocidade ${nextSpeed}x aplicada a todos os cortes`)
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-mono font-bold text-indigo-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                      title="Alternar velocidade de reprodução"
                    >
                      <Zap className="w-2.5 h-2.5 text-indigo-400" />
                      <span>{videoSpeed}x</span>
                    </button>
                    <span className="font-mono text-[10px] text-zinc-300">
                      {formatDuration(Math.floor(playbackTime))} / {formatDuration(Math.floor(clipDuration))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. LEGENDA DINÂMICA — só mostra quando não há vídeo renderizado.
                  Quando storage_url existe, a legenda já está queimada no vídeo. */}
              {!activeClip.storage_url && (
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
              )}

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
                  className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/50 text-sm text-white focus:outline-none transition-all"
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
              <button
                type="button"
                onClick={() => handleDownloadSingleClip(activeClip, selectedClipIndex)}
                disabled={!activeClip.storage_url || downloadingClipId === activeClip.id}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingClipId === activeClip.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{downloadingClipId === activeClip.id ? "Baixando..." : "Baixar Vídeo"}</span>
              </button>

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

            {clips.length > 1 && (
              <div className="pt-1.5">
                {scheduleAllMsg && (
                  <div className={scheduleAllMsg.startsWith('Erro') ? 'p-2 rounded-lg text-xs text-center bg-red-500/10 text-red-400' : 'p-2 rounded-lg text-xs text-center bg-emerald-500/10 text-emerald-400'}>
                    {scheduleAllMsg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleScheduleAllProject}
                  disabled={schedulingAllProject}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{schedulingAllProject ? 'Agendando...' : `${clips.filter(cl => cl.storage_url).length > 0 ? clips.filter(cl => cl.storage_url).length : clips.length} clipes`}</span>
                </button>
              </div>
            )}

            </div>

          {/* CARD INTERMEDIÁRIO: ESTÚDIO DE EDIÇÃO MINIMALISTA */}
          <div className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            
            {/* CABEÇALHO LIMPO E INTUITIVO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Estúdio de Edição</h3>
                  <p className="text-[11px] text-zinc-400">Ajustes rápidos de velocidade, proporção e legendas</p>
                </div>
              </div>

              {/* SELETOR EM PÍLULA: CORTE ATUAL VS TODOS OS CLIPES */}
              <div className="inline-flex items-center p-0.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs select-none self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setApplyToAllClips(false)
                    triggerBulkFeedback(`Editando corte #${selectedClipIndex + 1}`)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    !applyToAllClips
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Corte Atual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApplyToAllClips(true)
                    triggerBulkFeedback('Edição em lote ativada')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    applyToAllClips
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Todos os Clipes</span>
                  {clips.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">{clips.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* ABAS PADRONIZADAS (SEM ARCO-ÍRIS, CORES PADRÃO) */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 border border-white/[0.06] rounded-xl text-xs select-none">
              <button
                type="button"
                onClick={() => setStudioTab('speed')}
                className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studioTab === 'speed' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Velocidade</span>
              </button>

              <button
                type="button"
                onClick={() => setStudioTab('format')}
                className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studioTab === 'format' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Formato</span>
              </button>

              <button
                type="button"
                onClick={() => setStudioTab('text')}
                className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studioTab === 'text' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Emojis</span>
              </button>

              <button
                type="button"
                onClick={() => setStudioTab('silence')}
                className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studioTab === 'silence' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Silêncio</span>
              </button>
            </div>

            {/* ABA 1: VELOCIDADE DO VÍDEO (PADRONIZADO COM O NÍVEL DO TEMPLATE) */}
            {studioTab === 'speed' && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <SweepStepper
                  label="Nível de Aceleração (Pitch-Preserved):"
                  value={videoSpeed}
                  onChange={(v) => setVideoSpeed(v)}
                  min={1.0}
                  max={2.0}
                  step={0.05}
                  unit="x"
                  formatValue={(v) => `${Number(v.toFixed(2))}x`}
                />

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  💡 A velocidade <strong className="text-zinc-200">1.05x</strong> remove micro-pausas mantendo o tom natural da voz.
                </p>
              </div>
            )}

            {/* ABA 2: FORMATO (SOMENTE PROPORÇÃO DA TELA) */}
            {studioTab === 'format' && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <span className="text-xs text-zinc-300 font-medium block">Proporção da Tela:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '9:16' as VideoAspectRatio, label: '9:16', desc: 'Vertical (Reels/TikTok)' },
                    { id: '1:1' as VideoAspectRatio, label: '1:1', desc: 'Quadrado (Feed)' },
                    { id: '16:9' as VideoAspectRatio, label: '16:9', desc: 'Paisagem (YouTube)' },
                    { id: '4:5' as VideoAspectRatio, label: '4:5', desc: 'Retrato (Feed)' }
                  ].map((asp) => (
                    <button
                      key={asp.id}
                      type="button"
                      onClick={() => {
                        setVideoAspect(asp.id)
                        if (applyToAllClips) triggerBulkFeedback(`Formato ${asp.id} aplicado`)
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        videoAspect === asp.id
                          ? 'bg-indigo-600/20 text-white border-indigo-500/50 shadow-sm'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-bold block text-white">{asp.label}</span>
                      <span className="text-[10px] text-zinc-400 block leading-tight mt-0.5">{asp.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 3: EMOJIS (PÍLULA SIMPLES COM / SEM EMOJI) */}
            {studioTab === 'text' && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <span className="text-xs text-zinc-300 font-medium block">Emojis no Título:</span>
                <div className="inline-flex p-1 bg-black/40 border border-white/[0.06] rounded-xl text-xs select-none">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitleEmojis(true)
                      if (applyToAllClips) triggerBulkFeedback('Emojis ativados no título')
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      showTitleEmojis ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Com Emojis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitleEmojis(false)
                      if (applyToAllClips) triggerBulkFeedback('Sem emojis no título')
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      !showTitleEmojis ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Sem Emojis
                  </button>
                </div>
              </div>
            )}

            {/* ABA 4: SILÊNCIO & ÁUDIO */}
            {studioTab === 'silence' && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <span className="text-xs font-semibold text-white block">Remover Silêncios Automaticamente</span>
                    <span className="text-[11px] text-zinc-400">Corta pausas e hesitações acima de 0.3s</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeSilence}
                      onChange={(e) => {
                        const en = e.target.checked
                        setRemoveSilence(en)
                        if (applyToAllClips) triggerBulkFeedback(en ? 'Corte de silêncio ativado' : 'Corte de silêncio desativado')
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>
              </div>
            )}

            {/* RODAPÉ DO ESTÚDIO: STATUS E SALVAR */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-400">
                {applyToAllClips
                  ? (clips.length > 0 ? `Alterações aplicadas aos ${clips.length} cortes` : 'Alterações sincronizadas no preset global')
                  : `Modo individual ativo para o corte #${selectedClipIndex + 1}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  try {
                    const currentCfg = {
                      videoSpeed,
                      videoAspect,
                      activeLayout,
                      showTitleEmojis,
                      removeSilence,
                      activeSubtitleStyle
                    }
                    localStorage.setItem('clippost_active_template', JSON.stringify({ config: currentCfg, layout: activeLayout, subtitle_preset: activeSubtitleStyle }))
                    triggerBulkFeedback('Predefinição salva com sucesso!')
                  } catch {}
                }}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Salvar Predefinição</span>
              </button>
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
                            scoreP >= 90 ? 'text-emerald-400' : 'text-indigo-400'
                          }`}>
                            {scoreP}% Viral
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadSingleClip(c, i)
                        }}
                        disabled={!c.storage_url || downloadingClipId === c.id}
                        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        title="Baixar este corte"
                      >
                        {downloadingClipId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>

        </div>

      </main>
      )}

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

      {/* MODAL ENVIAR AO CELULAR (ESTILO LOCALSEND / AIRDROP SEM COMPRESSÃO) */}
      {qrModalClip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[#121216] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Enviar p/ Celular (Sem Perda)</span>
              </div>
              <button
                type="button"
                onClick={() => setQrModalClip(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Aponte a câmera do seu celular (iPhone ou Android) para baixar em alta qualidade direto no rolo da câmera:
            </p>

            <div className="flex justify-center p-3 bg-white rounded-xl shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrModalClip.url)}`}
                alt="QR Code de Download Direto"
                className="w-40 h-40"
              />
            </div>

            <p className="text-[11px] text-zinc-500">
              💡 Dica: Salva o vídeo direto na Galeria / Fotos com 1080p nativo sem passar pelo WhatsApp.
            </p>

            <div className="space-y-2 pt-1">
              {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await (navigator as any).share({
                        title: qrModalClip.title,
                        url: qrModalClip.url,
                      })
                    } catch {}
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar Direto (AirDrop / TikTok)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalClip.url)
                  setCopiedUrl(true)
                  setTimeout(() => setCopiedUrl(false), 2000)
                }}
                className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/[0.08]"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Link Copiado!' : 'Copiar Link Direto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
