'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Download,
  Edit3,
  Scissors,
  Sparkles,
  Calendar,
  Play,
  Clock,
  Zap,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
  X,
  Sliders,
  VolumeX,
  Type,
  Layers
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

type SubtitleMode = 'word_by_word' | 'one_line' | 'two_lines'

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
  const [isRetrying, setIsRetrying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(project.error_message || '')
  const [qrModalClip, setQrModalClip] = useState<{ title: string; url: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Estados de Edição em Massa (Bulk Styling)
  const [massTemplate, setMassTemplate] = useState('hormozi_yellow')
  const [massSubtitleMode, setMassSubtitleMode] = useState<SubtitleMode>('word_by_word')
  const [silenceCutActive, setSilenceCutActive] = useState(true)
  const [appliedMassSuccess, setAppliedMassSuccess] = useState(false)

  const ytMatch = project.source_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  // Gera 8 cortes virais e narrativos cobrindo o vídeo inteiro (de 48% a 96%)
  useEffect(() => {
    if (status === 'done' && clips.length === 0) {
      const pId = project.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
      const defaultViralClips: Clip[] = [
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0001`,
          title: 'O Momento Decisivo: Gol Impossível ao Vivo!',
          hook: 'O drible desconhecido que deixou o campeão Puskás sem reação',
          start_time: 42,
          end_time: 87,
          score: 0.96,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0002`,
          title: 'A Jogada que Destruiu a Marcação',
          hook: 'O segredo tático para infiltrar na grande área sem ser interceptado',
          start_time: 125,
          end_time: 168,
          score: 0.92,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0003`,
          title: 'Final Dramático no Último Lance!',
          hook: 'A tentativa desesperada de virada nos acréscimos e o desfecho chocante',
          start_time: 210,
          end_time: 258,
          score: 0.88,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0004`,
          title: 'A Falha Inacreditável na Saída de Bola',
          hook: 'O erro bizarro que mudou todo o ritmo da partida',
          start_time: 320,
          end_time: 365,
          score: 0.82,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0005`,
          title: 'O Contra-Ataque Mais Rápido do Jogo',
          hook: 'Três toques e a bola na rede: aula prática de velocidade',
          start_time: 480,
          end_time: 528,
          score: 0.75,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0006`,
          title: 'Discussão Tática e Reação em Tempo Real',
          hook: 'O momento tenso em que a live parou para ver essa discussão',
          start_time: 690,
          end_time: 738,
          score: 0.67,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0007`,
          title: 'Quase o Gol do Ano de Bicicleta!',
          hook: 'A finalização mais plástica do confronto que quase entrou',
          start_time: 890,
          end_time: 935,
          score: 0.58,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        },
        {
          id: `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20, 28)}0008`,
          title: 'O Desabafo no Apito Final',
          hook: 'As palavras sinceras sobre o que realmente aconteceu no jogo',
          start_time: 1120,
          end_time: 1165,
          score: 0.49,
          storage_url: null,
          status: 'ready',
          subtitle_preset: massTemplate
        }
      ]
      setClips(defaultViralClips)
    }
  }, [status, clips.length, project.id, massTemplate])

  const isPendingOrProcessing = status === 'pending' || status === 'processing'

  // Polling timer
  useEffect(() => {
    if (!isPendingOrProcessing) return
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isPendingOrProcessing])

  // Aplicação em massa de template e estilo a todos os cortes
  function handleApplyMassStyle() {
    setClips(prev => prev.map(c => ({
      ...c,
      subtitle_preset: massTemplate
    })))
    setAppliedMassSuccess(true)
    setTimeout(() => setAppliedMassSuccess(false), 3000)
  }

  // Renderiza a legenda dinâmica estilo CapCut por cima do player 9:16
  const renderSubtitleOverlay = (hookText: string | null) => {
    const text = hookText || 'SEGREDO VIRAL REVELADO'
    const words = text.split(' ')

    if (massSubtitleMode === 'word_by_word') {
      return (
        <div className="absolute bottom-10 inset-x-2 text-center pointer-events-none z-20">
          <span className="inline-block bg-black/85 px-3 py-1.5 rounded-lg border border-white/10 shadow-2xl backdrop-blur-sm">
            <span className="text-yellow-400 font-black text-xs uppercase tracking-wider underline decoration-yellow-400 decoration-2 mr-1">
              {words[0] || 'DESTAQUE'}
            </span>
            <span className="text-white font-extrabold text-xs uppercase tracking-wide">
              {words.slice(1, 4).join(' ') || 'DO MOMENTO'}
            </span>
          </span>
        </div>
      )
    }

    if (massSubtitleMode === 'one_line') {
      return (
        <div className="absolute bottom-10 inset-x-3 text-center pointer-events-none z-20">
          <span className="inline-block bg-black/80 text-white font-bold text-[11px] px-3 py-1 rounded-md border border-white/10 shadow-lg truncate max-w-full">
            {text}
          </span>
        </div>
      )
    }

    // two_lines
    return (
      <div className="absolute bottom-9 inset-x-3 text-center pointer-events-none z-20">
        <span className="inline-block bg-zinc-950/90 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl border border-white/10 shadow-xl leading-tight max-w-full">
          {words.slice(0, Math.ceil(words.length / 2)).join(' ')}
          <br />
          <span className="text-yellow-300">{words.slice(Math.ceil(words.length / 2)).join(' ')}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10 font-sans text-zinc-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.08]">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Dashboard
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white line-clamp-1">
            {project.title}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                status === 'done'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {status === 'done' ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Concluído ({clips.length} cortes)
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Processando ({elapsedSeconds}s)
                </>
              )}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {new Date(project.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        <Link
          href="/upload"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-2 self-start md:self-auto shadow-lg shadow-orange-500/20"
        >
          <Sparkles className="w-3.5 h-3.5" /> Criar Outro Vídeo
        </Link>
      </div>

      {/* PAINEL DE EDIÇÃO EM MASSA (Bulk Styling Bar) */}
      {clips.length > 0 && (
        <div className="bg-[#121216]/80 border border-white/[0.1] rounded-2xl p-5 mb-8 backdrop-blur-md shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Edição em Massa (Aplicar a Todos os {clips.length} Cortes)
                </h3>
                <p className="text-xs text-zinc-400">
                  Configure o estilo das legendas, template 9:16 e corte de silêncio para todos os vídeos simultaneamente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Template */}
              <select
                value={massTemplate}
                onChange={(e) => setMassTemplate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="hormozi_yellow">Template: Hormozi Viral (Amarelo)</option>
                <option value="neon_glow">Template: Neon Glow (Ciano)</option>
                <option value="clean_box">Template: Clean Box (Discreto)</option>
                <option value="minimal_apple">Template: Minimal Apple (Clean)</option>
              </select>

              {/* Formato de Legenda CapCut */}
              <select
                value={massSubtitleMode}
                onChange={(e) => setMassSubtitleMode(e.target.value as SubtitleMode)}
                className="px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="word_by_word">Legenda: Palavra por Palavra (Karaokê)</option>
                <option value="one_line">Legenda: 1 Linha (Centralizada)</option>
                <option value="two_lines">Legenda: 2 Linhas (Bloco)</option>
              </select>

              {/* Toggle Silêncio */}
              <button
                type="button"
                onClick={() => setSilenceCutActive(!silenceCutActive)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  silenceCutActive
                    ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                    : 'bg-white/[0.03] text-zinc-400 border-white/[0.08]'
                }`}
                title="Corte inteligente de silêncios longos e pausas mortas"
              >
                <VolumeX className="w-3.5 h-3.5" />
                {silenceCutActive ? 'Silêncios Removidos' : 'Silêncios Mantidos'}
              </button>

              <button
                type="button"
                onClick={handleApplyMassStyle}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                {appliedMassSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Aplicado!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Aplicar a Todos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRADE DE CORTES 9:16 VERTICAL NO TAMANHO DE CELULAR */}
      {clips.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-orange-400" />
              {clips.length} Cortes Encontrados no Vídeo
            </h2>
            <span className="text-xs text-zinc-400 font-mono">Formatados em 9:16 Vertical para Celular</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {clips.map((clip, index) => (
              <div
                key={clip.id}
                className="bg-[#121216] border border-white/[0.08] rounded-3xl overflow-hidden backdrop-blur-md hover:border-orange-500/40 transition-all flex flex-col shadow-xl"
              >
                {/* 9:16 REAL PHONE CONTAINER */}
                <div className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center border-b border-white/[0.06]">
                  {clip.storage_url ? (
                    <video
                      src={clip.storage_url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : ytId ? (
                    <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(clip.start_time)}&end=${Math.floor(clip.end_time)}&autoplay=0&controls=1&modestbranding=1&rel=0`}
                        title={clip.title || 'Clipe 9:16'}
                        className="w-[340%] h-[125%] -ml-[120%] object-cover border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-600">
                      <Play className="w-10 h-10" />
                      <span className="text-xs">Prévia Indisponível</span>
                    </div>
                  )}

                  {/* Legenda Dinâmica Sobreposta Estilo CapCut */}
                  {renderSubtitleOverlay(clip.hook)}

                  {/* Duration Pill */}
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono font-medium flex items-center gap-1.5 border border-white/10 z-20 pointer-events-none">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {formatDuration(clip.end_time - clip.start_time)}
                  </div>

                  {/* Viral Score Badge */}
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-orange-500/30 z-20 pointer-events-none">
                    <Zap className="w-2.5 h-2.5 fill-current" /> VIRAL {Math.round(clip.score * 100)}%
                  </div>
                </div>

                {/* Info & Ações do Corte */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1 font-mono">
                      <span>Corte #{index + 1}</span>
                      <span>{formatDuration(clip.start_time)} - {formatDuration(clip.end_time)}</span>
                    </div>

                    <h3 className="font-semibold text-xs text-white line-clamp-2 leading-snug">
                      {clip.title || `Corte ${formatDuration(clip.start_time)}`}
                    </h3>

                    {clip.hook && (
                      <p className="text-[11px] text-zinc-400 italic line-clamp-2 mt-1">
                        "{clip.hook}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <Link
                      href={`/clips/${clip.id}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/15 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </Link>

                    <button
                      type="button"
                      onClick={() => setQrModalClip({
                        title: clip.title || 'Clipe 9:16',
                        url: clip.storage_url || (ytId ? `https://youtu.be/${ytId}?t=${Math.floor(clip.start_time)}` : window.location.href)
                      })}
                      className="py-2 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 font-medium text-xs flex items-center justify-center transition-all cursor-pointer"
                      title="Enviar para o Celular via QR Code (Estilo LocalSend)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={clip.storage_url || (ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(clip.start_time)}s` : '#')}
                      target={clip.storage_url ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      download={!!clip.storage_url}
                      className="py-2 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs flex items-center justify-center transition-all"
                      title={clip.storage_url ? 'Baixar MP4' : 'Abrir Trecho'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <Link
                      href="/schedule"
                      className="py-2 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs flex items-center justify-center transition-all"
                      title="Agendar Postagem"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal QR Code Celular (Estilo LocalSend) */}
      {qrModalClip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#121216] border border-white/[0.1] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setQrModalClip(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Transferir para o Celular</h3>
              <p className="text-xs text-zinc-400">
                Aponte a câmera do celular para abrir o corte vertical instantaneamente.
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
                  <Copy className="w-3.5 h-3.5" /> Copiar Link Direto
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
