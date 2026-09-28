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
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { generateMagneticClips, extractCoreSubject, type MagneticClipData } from '@/lib/titles'
import dynamic from 'next/dynamic'

// O estúdio usa canvas, <video> e IndexedDB: só no navegador
const EstudioEditor = dynamic(() => import('@/components/editor-massa/EditorMassa'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Abrindo o estúdio…</div>,
})


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
  { id: 'hormozi_orange', name: 'Hormozi Laranja', activeColor: '#ffffff', activeBg: '#ea580c', border: 'border-indigo-500/40' },
  { id: 'hormozi_yellow', name: 'Hormozi Amarelo', activeColor: '#000000', activeBg: '#facc15', border: 'border-zinc-400/40' },
  { id: 'clean_white', name: 'Clean White', activeColor: '#000000', activeBg: '#ffffff', border: 'border-white/40' },
  { id: 'clean_white_box', name: 'Clean White Box', activeColor: '#000000', activeBg: '#ffffff', border: 'border-white/40' },
  { id: 'dark_box', name: 'Dark Box', activeColor: '#f97316', activeBg: '#18181b', border: 'border-zinc-700' },
  { id: 'neon_cyan', name: 'Cyan Pro', activeColor: '#22d3ee', activeBg: 'rgba(0,0,0,0.85)', glow: '0 0 12px rgba(6,182,212,0.8)', border: 'border-indigo-400/40' },
  { id: 'neon_magenta', name: 'Magenta Pro', activeColor: '#f472b6', activeBg: 'rgba(0,0,0,0.85)', glow: '0 0 12px rgba(236,72,153,0.8)', border: 'border-purple-500/40' },
  { id: 'karaoke_amarelo', name: 'Karaokê Amarelo', activeColor: '#facc15', activeBg: 'rgba(0,0,0,0.85)', border: 'border-indigo-500/40' },
  { id: 'karaoke_roxo', name: 'Karaokê Roxo', activeColor: '#a855f7', activeBg: 'rgba(0,0,0,0.85)', border: 'border-purple-500/40' },
  { id: 'palavra_unica', name: 'Palavra Única', activeColor: '#facc15', activeBg: 'rgba(0,0,0,0.85)', border: 'border-indigo-500/40' },
  { id: 'revelacao', name: 'Revelação', activeColor: '#ffffff', activeBg: 'rgba(0,0,0,0.85)', border: 'border-white/40' },
  { id: 'pop_branco', name: 'Pop Branco', activeColor: '#ffffff', activeBg: 'rgba(0,0,0,0.85)', border: 'border-white/40' },
  { id: 'caixa_pop', name: 'Caixa Pop', activeColor: '#000000', activeBg: '#facc15', border: 'border-zinc-400/40' },
  { id: 'fade_suave', name: 'Fade Suave', activeColor: '#f4f4f5', activeBg: 'rgba(0,0,0,0.85)', border: 'border-white/40' },
]

// `key` = etapa que o backend grava em projects.error_message ("step:<key>") durante o processamento
const PIPELINE_STEPS = [
  { key: 'download', label: 'Baixando vídeo', thresholdSecs: 0 },
  { key: 'transcricao', label: 'Transcrevendo áudio', thresholdSecs: 40 },
  { key: 'ia_curator', label: 'IA identificando momentos virais', thresholdSecs: 90 },
  { key: 'gerando_clipes', label: 'Criando cortes 9:16', thresholdSecs: 160 },
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
    amber:  'bg-zinc-500/10 border-zinc-500/25 text-zinc-300',
    orange: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
    red:    'bg-red-500/10 border-red-500/25 text-red-300',
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-300',
    blue:   'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
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
            {copied ? <Check className="w-3 h-3 text-indigo-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado!' : 'Copiar erro'}
          </button>
        </div>

        {/* Código de erro técnico */}
        {errorMessage ? (
          <div className="rounded-xl bg-black/50 border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Diagnóstico do Processamento</span>
              <span className="text-[10px] font-mono text-zinc-500" suppressHydrationWarning>{errorTime}</span>
            </div>
            <pre className="px-3 py-3 text-[11px] font-mono text-zinc-300 break-all whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {errorMessage}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl bg-black/40 border border-white/[0.06] px-3 py-2.5">
            <span className="text-[11px] font-mono text-zinc-400">O servidor encontrou uma oscilação temporária na conexão. Clique em &ldquo;Tentar novamente&rdquo; para reprocessar o corte.</span>
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

  // Porcentagem suave de 0% a 100%
  const progressPercent = (() => {
    if (clipsReady > 0) {
      return Math.min(99, 85 + clipsReady * 3)
    }
    const stepBases = [15, 42, 68, 88]
    const base = stepBases[activeIdx] || 15
    const stepDur = [40, 50, 70, 70][activeIdx] || 60
    const prevThreshold = PIPELINE_STEPS[activeIdx]?.thresholdSecs || 0
    const timeInStep = Math.max(0, elapsedSecs - prevThreshold)
    const stepFrac = Math.min(0.9, timeInStep / stepDur)
    const nextBase = stepBases[Math.min(activeIdx + 1, stepBases.length - 1)] || 96
    const range = nextBase - base
    const val = Math.min(96, Math.round(base + range * stepFrac))
    return Math.max(8, val)
  })()

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
      <div className="bg-[#0d0d14] border border-indigo-500/25 rounded-2xl p-5 space-y-4 shadow-xl shadow-indigo-950/20">
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
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    {clipsReady} {clipsReady === 1 ? 'corte pronto' : 'cortes prontos'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {clipsReady === 0
                  ? 'Identificando ganchos virais e aplicando seu template...'
                  : ('Corte #' + clipsReady + ' pronto! Gerando mais em segundo plano...')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider block">Progresso</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">{progressPercent}%</span>
          </div>
        </div>

        {/* barra de progresso geral */}
        <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: (progressPercent + '%') }}
          />
        </div>

        {/* steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = i < activeIdx || (i === activeIdx && clipsReady > 0 && i === PIPELINE_STEPS.length - 1)
            const isActive = i === activeIdx && !(clipsReady > 0 && i === PIPELINE_STEPS.length - 1)

            return (
              <div
                key={i}
                className={'flex flex-col gap-1.5 p-3 rounded-xl border transition-all ' + (
                  isDone
                    ? 'bg-indigo-500/8 border-indigo-500/20'
                    : isActive
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-white/[0.02] border-white/[0.05]'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <div className={'w-4 h-4 rounded-full flex items-center justify-center shrink-0 ' + (
                    isDone ? 'bg-indigo-500/20' : isActive ? 'bg-indigo-500/20' : 'bg-white/[0.06]'
                  )}>
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                    ) : (
                      <span className="text-[9px] font-mono text-zinc-500">{i + 1}</span>
                    )}
                  </div>
                  <span className={'text-[10px] font-semibold uppercase tracking-wider ' + (
                    isDone ? 'text-indigo-400' : isActive ? 'text-indigo-300' : 'text-zinc-600'
                  )}>
                    {isDone ? 'Concluído' : isActive ? 'Em andamento' : 'Aguardando'}
                  </span>
                </div>
                <span className={'text-xs font-semibold leading-tight ' + (
                  isDone ? 'text-zinc-200' : isActive ? 'text-white' : 'text-zinc-500'
                )}>
                  {step.label}
                </span>
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
  const [avisoFechado, setAvisoFechado] = useState(false)
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

  const [exportQuality, setExportQuality] = useState<"1080p" | "720p">("1080p")
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null)

  const handleDownloadSingleClip = async (clip: Clip, index: number) => {
    if (!clip.storage_url) return
    setDownloadingClipId(clip.id)
    triggerBulkFeedback(`Baixando corte #${index + 1}...`)
    const fname = `corte_${index + 1}_${extractCoreSubject(project.title)}_${exportQuality}.mp4`
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
      const fname = `corte_${i + 1}_${extractCoreSubject(project.title)}_${exportQuality}.mp4`
      await downloadVideoFile(clip.storage_url!, fname)
    }
    setDownloadingAll(false)
    triggerBulkFeedback("Todos os cortes foram baixados com sucesso!")
  }

    // ESTÚDIO PADRÃO: com cortes prontos (ou cortes sendo gerados), o projeto abre no estúdio
  // Todos os cortes entram no estúdio: os prontos com vídeo e os pendentes com card animado com degradê!
  const cortesProntos = clips.filter(c => !!c.storage_url)
  const isYouTubeProject = (project as any).platform === 'youtube' || (project.source_url && (project.source_url.includes('youtube') || project.source_url.includes('youtu.be')))
  const projetoEstudio = useMemo(
    () => ({
      id: project.id,
      titulo: project.title || 'Projeto',
      isYouTube: !!isYouTubeProject,
      // perfil baixado inteiro (Buscar de um perfil): vídeos crus, o estúdio aplica o template
      crus: String(project.source_url || '').startsWith('clipost:perfil'),
      // projeto que já terminou (ou falhou): cortes que nunca ficaram prontos não aparecem
      // (ficariam "carregando" para sempre) — a faixa de cima oferece gerar de novo
      clips: clips.filter(c => status === 'processing' || !!c.storage_url).map(c => ({
        id: c.id,
        url: c.storage_url || '',
        titulo: c.hook || c.title || '',
        pronto: !!c.storage_url,
        status: c.status || (c.storage_url ? 'completed' : 'processing'),
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.id, project.title, isYouTubeProject, status, clips.map(c => c.id + (c.storage_url ?? '') + (c.status ?? '')).join('|')],
  )
  // Projeto abre SEMPRE no estúdio (a tela antiga foi removida). Se algo deu errado, aparece só uma
  // notificação de erro no canto (fecha no X) — o estúdio fica igual.
  const semCortes = projetoEstudio.clips.length === 0 && status !== 'processing'
  // cortes que o servidor começou mas não terminou (ex.: envio falhou antes das novas tentativas)
  const faltando = status !== 'processing' ? clips.filter(c => !c.storage_url).length : 0
  const avisoErro = semCortes
    ? (status === 'failed' ? `Não deu para gerar os cortes deste vídeo${errorMessage ? `: ${String(errorMessage).slice(0, 140)}` : '.'}` : 'Nenhum corte foi gerado para este vídeo.')
    : faltando > 0
      ? (faltando === 1 ? '1 corte não terminou de gerar.' : `${faltando} cortes não terminaram de gerar.`)
      : ''
  // Gerando e nenhum corte pronto ainda: mostra o progresso (%). Quando o 1º fica pronto, abre o estúdio
  // com ele e os demais cortes identificados carregando em degradê.
  if (status === 'processing' && cortesProntos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] -mb-24 bg-[#0a0a0c] px-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-2 px-4">
            <h1 className="text-sm font-semibold text-white truncate">{project.title || 'Gerando cortes'}</h1>
            {clips.length > 0 && (
              <p className="text-[11px] text-zinc-400 mt-1">{clips.length} cortes identificados — o estúdio abre quando o primeiro ficar pronto</p>
            )}
          </div>
          <PipelineProgress elapsedSecs={elapsedSecs} clipsReady={0} backendStep={errorMessage} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-[100dvh] -mb-24 min-h-[620px] bg-[#0a0a0c]">
      <EstudioEditor
        projeto={projetoEstudio}
        titulo={project.title || 'Projeto'}
        // Agendar leva ao Agendar em massa só com os cortes deste vídeo (horários e contas escolhidos lá)
        onAgendar={() => router.push(`/schedule?aba=massa&tipo=reels&projeto=${project.id}`)}
        acoesExtras={null}
      />
      {avisoErro && !avisoFechado && (
        <div role="alert" className="fixed z-50 right-4 bottom-24 sm:bottom-6 max-w-[340px] flex items-start gap-3 rounded-xl border border-red-500/25 bg-[#161013]/95 backdrop-blur px-3.5 py-3 text-xs text-zinc-200 shadow-2xl">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
          <div className="flex-1">
            <div>{avisoErro}</div>
            <button
              type="button"
              onClick={() => { setAvisoFechado(true); void reprocessProject() }}
              className="mt-2 font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer"
            >
              Gerar de novo
            </button>
          </div>
          <button type="button" onClick={() => setAvisoFechado(true)} title="Fechar" className="text-zinc-500 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
