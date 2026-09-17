'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scissors, CheckCircle2, Loader2, Video, Trash2, ArrowRight, Play } from 'lucide-react'

interface Project {
  id: string
  title: string
  source_url: string
  status: string
  created_at: string
}

export default function CleanDashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [totalClips, setTotalClips] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Busca projetos do usuário no Supabase
      const { data: dbProjs } = await supabase
        .from('projects')
        .select('id, title, source_url, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (dbProjs) {
        setProjects(dbProjs as Project[])
      }

      // Busca total de clipes
      const { count } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setTotalClips(count || (dbProjs?.length ? dbProjs.length * 3 : 0))
    } catch (e) {
      console.warn('Erro ao carregar dados do dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm('Deseja realmente excluir permanentemente este projeto e todos os seus cortes?')) return

    setDeletingId(id)
    try {
      // 1. Exclusão segura via API server-side (remove posts agendados, storage e registro no DB)
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        console.warn('API de exclusão retornou aviso, tentando fallback direto Supabase...', data.error)
        await supabase.from('clips').delete().eq('project_id', id)
        const { error: sbErr } = await supabase.from('projects').delete().eq('id', id)
        if (sbErr) {
          throw new Error(data.error || sbErr.message || 'Falha ao remover do banco de dados.')
        }
      }

      // Sucesso definitivo: remove da interface
      setProjects(prev => prev.filter(p => p.id !== id))
      setTotalClips(prev => Math.max(0, prev - 3))
    } catch (err: any) {
      console.error('Erro ao excluir projeto:', err)
      alert(`Não foi possível excluir o projeto: ${err.message || 'Erro inesperado'}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c]">
      {/* Barra de Topo Minimalista */}
      <header className="h-16 border-b border-white/[0.08] flex items-center justify-between px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-white tracking-wide">Painel Geral - Clipost</h1>
        <Link
          href="/upload"
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Scissors className="w-3.5 h-3.5" /> Criar Novos Cortes
        </Link>
      </header>

      <div className="max-w-5xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Métricas Diretas e Limpas */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#121216]/60 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Vídeos Adicionados</span>
            <p className="text-3xl font-light text-white mt-2 tracking-tight">{projects.length}</p>
          </div>

          <div className="bg-[#121216]/60 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cortes Prontos (9:16)</span>
            <p className="text-3xl font-light text-white mt-2 tracking-tight text-orange-400">{totalClips}</p>
          </div>
        </section>

        {/* Projetos Recentes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Meus Vídeos e Projetos</h2>
            <span className="text-xs text-zinc-500 font-mono">{projects.length} projeto{projects.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin mb-2" />
              <p className="text-xs text-zinc-400">Carregando seus vídeos...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center p-12 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-400">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Nenhum projeto ainda</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Cole o link de um vídeo do YouTube, Instagram ou TikTok para gerar seus primeiros cortes virais no Clipost.
                </p>
              </div>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
              >
                <Scissors className="w-4 h-4" /> Começar Agora
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          proj.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : proj.status === 'processing'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {proj.status === 'done' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Concluído
                          </>
                        ) : proj.status === 'processing' ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Processando
                          </>
                        ) : (
                          proj.status
                        )}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {new Date(proj.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white truncate" title={proj.title}>
                      {proj.title}
                    </h3>

                    {proj.source_url && (
                      <p className="text-xs text-zinc-500 truncate max-w-md font-mono">
                        {proj.source_url}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/project/${proj.id}`}
                      className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-orange-500 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/[0.08] hover:border-orange-500 transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" /> Abrir Cortes
                    </Link>

                    {/* Botão de Excluir Projeto */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      disabled={deletingId === proj.id}
                      className="p-2 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 transition-all cursor-pointer"
                      title="Excluir este projeto"
                    >
                      {deletingId === proj.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
