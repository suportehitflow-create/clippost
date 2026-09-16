'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Download,
  Sparkles,
  Calendar,
  Play,
  Clock,
  Zap,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Terminal,
  CheckCircle2,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'

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
}

export default function ProjectClient({
  project,
  clips: initialClips,
}: {
  project: Project
  clips: Clip[]
}) {
  const [clips, setClips] = useState(initialClips)
  const [status, setStatus] = useState(project.status)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(project.error_message || '')

  const isPendingOrProcessing = status === 'pending' || status === 'processing'

  // Polling timer
  useEffect(() => {
    if (!isPendingOrProcessing) return

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isPendingOrProcessing])

  // Poll job status while processing
  useEffect(() => {
    if (status === 'done' || status === 'failed') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/jobs/${project.id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status) setStatus(data.status)
        if (data.clips && data.clips.length > 0) setClips(data.clips)
        if (data.error_message) setErrorMessage(data.error_message)
        if (data.status === 'done' || data.status === 'failed') {
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [project.id, status])

  const handleManualCheck = async () => {
    setIsRetrying(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
    try {
      const res = await fetch(`${apiUrl}/api/jobs/${project.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.status) setStatus(data.status)
        if (data.clips && data.clips.length > 0) setClips(data.clips)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsRetrying(false)
    }
  }

  // Determine current active pipeline step for visual feedback
  const getStepStatus = (stepIndex: number) => {
    if (status === 'done') return 'done'
    if (status === 'failed') return 'failed'
    if (elapsedSeconds < 15 && stepIndex === 0) return 'active'
    if (elapsedSeconds >= 15 && elapsedSeconds < 35 && stepIndex === 1) return 'active'
    if (elapsedSeconds >= 35 && elapsedSeconds < 60 && stepIndex === 2) return 'active'
    if (elapsedSeconds >= 60 && stepIndex === 3) return 'active'
    if (elapsedSeconds > 15 && stepIndex < 1) return 'done'
    if (elapsedSeconds > 35 && stepIndex < 2) return 'done'
    if (elapsedSeconds > 60 && stepIndex < 3) return 'done'
    return 'pending'
  }

  const pipelineSteps = [
    { title: 'Download & Extração de Áudio', desc: 'yt-dlp e FFmpeg processando o arquivo fonte' },
    { title: 'Transcrição Whisper com IA', desc: 'faster-whisper mapeando timestamps de cada palavra' },
    { title: 'Curadoria de Ganchos Virais', desc: 'IA selecionando momentos de alta retenção' },
    { title: 'Renderização 9:16 & Legendas', desc: 'FFmpeg aplicando proporção vertical e template' },
  ]

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 font-sans text-zinc-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
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
                  : status === 'processing'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : status === 'failed'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50'
              }`}
            >
              {status === 'done' ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Concluído
                </>
              ) : status === 'processing' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Processando ({elapsedSeconds}s)
                </>
              ) : status === 'pending' ? (
                <>
                  <Clock className="w-3 h-3" /> Na fila ({elapsedSeconds}s)
                </>
              ) : (
                status
              )}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {new Date(project.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {isPendingOrProcessing && (
          <button
            onClick={handleManualCheck}
            disabled={isRetrying}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            Verificar Status
          </button>
        )}
      </div>

      {/* Processing State with Step Checklist & Timeout Diagnosis */}
      {isPendingOrProcessing && (
        <div className="space-y-6 mb-10">
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 lg:p-8 backdrop-blur-md">
            <div className="flex flex-col items-center text-center max-w-lg mx-auto mb-8">
              <div className="relative w-14 h-14 mb-4 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                A Inteligência Artificial está gerando seus cortes
              </h2>
              <p className="text-xs text-zinc-400">
                Identificando ganchos de alta retenção, gerando legendas sincronizadas e aplicando o enquadramento 9:16.
              </p>
            </div>

            {/* Pipeline Steps Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto mb-6">
              {pipelineSteps.map((s, idx) => {
                const stepState = getStepStatus(idx)
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      stepState === 'active'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : stepState === 'done'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-white/[0.01] border-white/[0.05] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {stepState === 'done' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : stepState === 'active' ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 flex-shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-white truncate">{s.title}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">{s.desc}</p>
                  </div>
                )
              })}
            </div>

            {/* Intelligent Timeout / Diagnosis Banner if pending for > 45s */}
            {elapsedSeconds >= 45 && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left max-w-3xl mx-auto">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-amber-300 mb-1">
                      O processamento está demorando mais do que o habitual ({elapsedSeconds}s)
                    </p>
                    <p className="text-zinc-300 leading-relaxed mb-3">
                      Se o status não mudar de <strong>{status}</strong>, o Worker do Celery no Fly.io pode estar em espera, escalado em 0 ou baixando o modelo de IA pela primeira vez.
                    </p>
                    <div className="bg-black/50 p-3 rounded-lg border border-white/10 font-mono text-[11px] text-zinc-300 space-y-1">
                      <p className="text-zinc-500">// Comandos para checar a máquina do worker no terminal:</p>
                      <p className="text-orange-400">fly status -a clippost-backend</p>
                      <p className="text-orange-400">fly scale count worker=1 -a clippost-backend</p>
                      <p className="text-zinc-400">fly logs -a clippost-backend</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clips Grid */}
      {clips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              {clips.length} Clipe{clips.length !== 1 ? 's' : ''} Pronto{clips.length !== 1 ? 's' : ''}
            </h2>
            <span className="text-xs text-zinc-500 font-mono">Ordenados por pontuação viral</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-md hover:border-white/20 transition-all flex flex-col"
              >
                {/* 9:16 Video Box */}
                <div className="relative aspect-[9/16] bg-black max-h-[320px] overflow-hidden flex items-center justify-center">
                  {clip.storage_url ? (
                    <video
                      src={clip.storage_url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-600">
                      <Play className="w-10 h-10" />
                      <span className="text-xs">Prévia Indisponível</span>
                    </div>
                  )}

                  {/* Duration pill */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-medium flex items-center gap-1.5 border border-white/10">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {formatDuration(clip.end_time - clip.start_time)}
                  </div>

                  {/* Viral badge */}
                  {clip.score >= 0.8 && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-orange-500/30">
                      <Zap className="w-2.5 h-2.5 fill-current" /> VIRAL {Math.round(clip.score * 100)}%
                    </div>
                  )}
                </div>

                {/* Clip Info & Actions */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white mb-1 line-clamp-2">
                      {clip.title || `Clipe ${formatDuration(clip.start_time)}`}
                    </h3>
                    {clip.hook && (
                      <p className="text-xs text-zinc-400 italic line-clamp-2 mb-4">
                        "{clip.hook}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    {clip.storage_url && (
                      <a
                        href={clip.storage_url}
                        download
                        className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </a>
                    )}
                    <Link
                      href="/schedule"
                      className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Agendar
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed state with helpful action */}
      {status === 'failed' && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Falha no Processamento do Vídeo</h2>
          <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
            {errorMessage || 'O worker encontrou um erro ao baixar ou cortar o vídeo. Verifique se o link tem restrição de idade ou se é público.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/upload"
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all"
            >
              Tentar com Outro Vídeo
            </Link>
            <button
              onClick={handleManualCheck}
              className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 text-xs font-medium transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
