'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowUpRight, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface Project {
  id: string
  title: string
  source_url: string
  status: string
  created_at: string
}

interface Analytics {
  total_projects: number
  total_clips: number
  pending_posts: number
  published_posts: number
  success_rate: number
}

export default function AppleDashboard() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState<'auto' | '30' | '60'>('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        loadProjects(data.user.id)
        loadAnalytics(data.user.id)
      }
    })
  }, [])

  async function loadProjects(uid: string) {
    try {
      const res = await fetch(`${API}/api/projects/${uid}`)
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch {
      // Ignora erro silenciosamente no carregamento inicial
    }
  }

  async function loadAnalytics(uid: string) {
    try {
      const res = await fetch(`${API}/api/analytics/${uid}`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch {
      // Ignora erro silenciosamente
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. Cria o projeto no Supabase
      const { data: project, error: dbError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: 'Importação: ' + (url.length > 40 ? url.substring(0, 40) + '...' : url),
          source_url: url.trim(),
          source_type: 'url',
          status: 'pending',
        })
        .select()
        .single()

      if (dbError || !project) {
        throw new Error(dbError?.message || 'Falha ao criar projeto')
      }

      // 2. Envia para a fila do backend
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          user_id: user.id,
          clip_duration: duration,
          project_id: project.id,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Erro ao iniciar job no servidor')
      }

      // 3. Redireciona diretamente para a tela de acompanhamento do projeto
      router.push(`/project/${project.id}`)
    } catch (err: any) {
      setError(err.message || 'Falha ao processar vídeo. Tente novamente.')
      setLoading(false)
    }
  }

  const metrics = [
    { label: 'Vídeos Importados', value: analytics?.total_projects ?? projects.length },
    { label: 'Clipes Gerados', value: analytics?.total_clips ?? 0 },
    { label: 'Agend. Pendentes', value: analytics?.pending_posts ?? 0 },
    { label: 'Taxa de Sucesso', value: `${analytics?.success_rate ?? 0}%` },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      
      {/* 1. BARRA SUPERIOR DE CONTEXTO (Limpa, estilo Apple macOS) */}
      <header className="h-16 border-b border-white/[0.08] flex items-center justify-between px-8 bg-[#0a0a0c]/60 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-sm font-medium text-zinc-300 tracking-wide">Visão Geral</h1>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistema Operacional
          </span>
        </div>
      </header>

      <div className="max-w-5xl w-full mx-auto p-8 space-y-10">
        
        {/* 2. MÉTRICAS SUTIS (Tipografia precisa, sem emojis) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-[#121216]/60 border border-white/[0.07] rounded-2xl p-5 backdrop-blur-sm transition-all hover:border-white/[0.12] hover:bg-[#15151a]/80"
            >
              <p className="text-xs font-medium text-zinc-400 tracking-wider uppercase">{metric.label}</p>
              <p className="text-3xl font-light text-white mt-2 tracking-tight">{metric.value}</p>
            </div>
          ))}
        </section>

        {/* 3. BARRA DE AÇÃO PRINCIPAL "SPOTLIGHT" */}
        <section className="bg-gradient-to-b from-[#131318] to-[#0f0f13] border border-white/[0.09] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Criar Cortes Inteligentes</h2>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
              Insira o link de um vídeo longo para extrair os momentos com maior potencial de retenção.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Campo de URL Integrado (Estilo Spotlight) */}
            <div className="relative flex items-center">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do YouTube, Instagram ou TikTok..."
                className="w-full bg-[#18181e]/90 border border-white/[0.1] rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all shadow-inner"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Controles de Configuração e Botão de Ação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              
              {/* Segmented Control da Apple para Duração */}
              <div className="flex items-center p-1 bg-[#18181e] border border-white/[0.08] rounded-xl self-start">
                {(['auto', '30', '60'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDuration(option)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all capitalize cursor-pointer ${
                      duration === option
                        ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {option === 'auto' ? 'Duração Auto' : `${option}s`}
                  </button>
                ))}
              </div>

              {/* Botão de Ação Primária Apple */}
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-sm font-medium transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>Gerar Clipes</span>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* 4. ÁREA DE PROJETOS RECENTES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Projetos Recentes</h3>
            {projects.length > 0 && (
              <Link href="/upload" className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1">
                <span>Ver todos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.slice(0, 6).map((proj) => (
                <Link
                  key={proj.id}
                  href={`/project/${proj.id}`}
                  className="bg-[#121216]/60 border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-4 transition-all hover:bg-[#15151a]/80 flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                      {proj.title || 'Projeto sem título'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(proj.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      proj.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : proj.status === 'processing'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}>
                      {proj.status === 'done' ? 'Pronto' : proj.status === 'processing' ? 'Processando' : 'Pendente'}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-white/[0.08] rounded-2xl p-12 text-center bg-[#121216]/30">
              <p className="text-sm text-zinc-400 font-normal">Nenhum clipe gerado ainda.</p>
              <p className="text-xs text-zinc-500 mt-1">Cole uma URL acima para começar a produzir seus cortes.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
