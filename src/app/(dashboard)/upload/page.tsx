'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scissors, Link2, Clock, VolumeX, Check, Loader2, UploadCloud, AlertCircle, Sparkles } from 'lucide-react'

export default function CreateClipsPage() {
  const [url, setUrl] = useState('')
  const [clipDuration, setClipDuration] = useState<'30' | '60' | '90' | 'auto'>('auto')
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

      // Dispara job no backend em segundo plano
      fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          user_id: user.id,
          clip_duration: clipDuration,
          project_id: project.id,
          template_preset: 'meme_frame',
          remove_silence: removeSilence,
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
        <h1 className="text-sm font-semibold text-white tracking-wide">Criar Novos Cortes - Clipost</h1>
      </header>

      <div className="max-w-2xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center mx-auto text-white mb-4 shadow-lg shadow-indigo-500/25">
            <Scissors className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Criar Cortes 9:16 com IA</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Cole o link do YouTube, Instagram ou TikTok. A IA encontra os momentos mais virais, corta no formato vertical e aplica seu template oficial do Clipost.
          </p>
        </div>

        {/* Alternador Link / Arquivo */}
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'link' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Por Link (URL)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
                  placeholder="https://www.youtube.com/watch?v=... ou link do TikTok / Instagram"
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

          {/* Configurações de Duração dos Cortes & Áudio */}
          <div className="space-y-4 pt-4 border-t border-white/[0.08]">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" /> Duração dos Cortes
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '30', label: '30s', desc: 'Até 45s (Reels rápidos)' },
                  { id: '60', label: '1 minuto', desc: '45s a 60s (Padrão viral)' },
                  { id: '90', label: 'Mais de 1 min', desc: '60s a 120s+ (Histórias)' },
                  { id: 'auto', label: 'Automático', desc: 'IA escolhe o melhor tempo' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setClipDuration(opt.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      clipDuration === opt.id
                        ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                        : 'border-white/[0.08] bg-[#121216] hover:border-white/20'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${clipDuration === opt.id ? 'text-orange-400' : 'text-white'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block leading-tight">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle de Silêncio */}
            <div className="pt-2">
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeSilence}
                  onChange={(e) => setRemoveSilence(e.target.checked)}
                  className="rounded border-white/20 text-orange-500 focus:ring-0 w-4 h-4 accent-orange-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> Remover pausas longas e silêncios
                  </span>
                  <p className="text-[11px] text-zinc-500">Aumenta o ritmo e a retenção do corte para prender a atenção.</p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando cortes inteligentes com IA...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" /> Gerar Cortes Virais com Clipost
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
