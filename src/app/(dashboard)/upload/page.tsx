'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scissors, Link2, Sparkles, Wand2, VolumeX, Check, Loader2, UploadCloud, AlertCircle } from 'lucide-react'

export default function CreateClipsPage() {
  const [url, setUrl] = useState('')
  const [template, setTemplate] = useState('hormozi_yellow')
  const [cutMode, setCutMode] = useState<'all' | 'top3'>('all')
  const [removeSilence, setRemoveSilence] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'link' | 'file'>('link')
  
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (activeTab === 'link' && !url.trim()) {
      setError('Por favor, cole o link do vídeo.')
      return
    }
    if (activeTab === 'file' && !file) {
      setError('Por favor, selecione um arquivo de vídeo.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Título inicial
      let videoTitle = 'Processamento com IA'
      if (activeTab === 'link') {
        try {
          const oeRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`)
          if (oeRes.ok) {
            const oe = await oeRes.json()
            if (oe.title) videoTitle = oe.title
          }
        } catch {
          // segue
        }
      } else if (file) {
        videoTitle = file.name
      }

      // Cria o projeto no Supabase
      const { data: project, error: dbErr } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: videoTitle,
          source_url: activeTab === 'link' ? url.trim() : null,
          source_type: activeTab,
          status: 'processing',
        })
        .select()
        .single()

      if (dbErr || !project) {
        throw new Error(dbErr?.message || 'Erro ao criar projeto.')
      }

      let sourceUrl = url.trim()
      if (activeTab === 'file' && file) {
        const path = `${user.id}/${project.id}/original.${file.name.split('.').pop()}`
        await supabase.storage.from('videos').upload(path, file).catch(() => null)
        sourceUrl = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
      }

      // Dispara job no backend em segundo plano (com timeout seguro)
      fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          user_id: user.id,
          clip_duration: 'auto',
          project_id: project.id,
          template_preset: template,
          remove_silence: removeSilence,
          cut_mode: cutMode,
        }),
      }).catch(() => null)

      // Redireciona imediatamente para a tela do projeto
      router.push(`/project/${project.id}`)
    } catch (err: any) {
      setError(err.message || 'Falha ao iniciar processamento.')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <header className="h-16 border-b border-white/[0.08] flex items-center px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-white tracking-wide">Criar Novos Cortes</h1>
      </header>

      <div className="max-w-2xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-400 mb-4 shadow-lg shadow-orange-500/10">
            <Scissors className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Criar Cortes 9:16 com IA</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Cole o link do YouTube, Instagram ou TikTok. A IA encontra os momentos mais virais, corta no formato vertical e adiciona legendas automáticas.
          </p>
        </div>

        {/* Alternador Link / Arquivo */}
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'link' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Por Link (URL)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'file' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Upload de Arquivo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'link' ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Link do Vídeo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Link2 className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... ou Instagram / TikTok"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121216] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Arquivo de Vídeo (MP4, MOV)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/[0.12] hover:border-orange-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]"
              >
                <UploadCloud className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white">
                  {file ? file.name : 'Clique para selecionar um vídeo do seu computador'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">Até 500MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Configurações de Template & Modo */}
          <div className="space-y-4 pt-2 border-t border-white/[0.08]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Template de Legendas */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Template das Legendas
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  <option value="hormozi_yellow">Hormozi Viral (Amarelo Neon)</option>
                  <option value="neon_glow">Neon Glow (Ciano)</option>
                  <option value="clean_box">Clean Box (Caixa Discreta)</option>
                  <option value="minimal_apple">Minimal Apple (Clean)</option>
                </select>
              </div>

              {/* Quantidade de Cortes */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-orange-400" /> Modo de Extração
                </label>
                <select
                  value={cutMode}
                  onChange={(e) => setCutMode(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Achar Todos os Momentos (6 a 10 Cortes)</option>
                  <option value="top3">Apenas os 3 Mais Virais</option>
                </select>
              </div>
            </div>

            {/* Toggle Corte de Silêncio */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <VolumeX className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-xs font-semibold text-white">Corte Inteligente de Silêncios</p>
                  <p className="text-[11px] text-zinc-400">Remove pausas longas e respirações mortas para maximizar retenção.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={removeSilence}
                onChange={(e) => setRemoveSilence(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Iniciando Inteligência Artificial...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                Gerar Cortes 9:16 Agora
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
