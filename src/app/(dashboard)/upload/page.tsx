'use client'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scissors, Link2, Clock, VolumeX, Check, Loader2, UploadCloud, AlertCircle, Sparkles } from 'lucide-react'

function getPlatformInfo(inputUrl: string) {
  if (!inputUrl.trim()) return null
  const u = inputUrl.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { name: 'YouTube', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
  }
  if (u.includes('tiktok.com')) {
    return { name: 'TikTok', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
  }
  if (u.includes('instagram.com')) {
    return { name: 'Instagram Reels', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' }
  }
  if (u.includes('twitter.com') || u.includes('x.com')) {
    return { name: 'X / Twitter', color: 'bg-zinc-400/10 text-zinc-300 border-zinc-500/20' }
  }
  if (u.includes('twitch.tv')) {
    return { name: 'Twitch', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
  }
  return { name: 'Vídeo Web (yt-dlp)', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' }
}

export default function CreateClipsPage() {
  const [url, setUrl] = useState('')
  const [clipDuration, setClipDuration] = useState<'30' | '60' | '90' | 'auto'>('auto')
  const [removeSilence, setRemoveSilence] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'link' | 'file'>('link')
  const [miningScope, setMiningScope] = useState<'full' | 'range'>('full')
  const [timeRangeStart, setTimeRangeStart] = useState('')
  const [timeRangeEnd, setTimeRangeEnd] = useState('')
  
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Pré-preenche a URL se vier da página de Trends (?url=...)
  useEffect(() => {
    const prefilledUrl = searchParams.get('url')
    if (prefilledUrl) {
      setUrl(decodeURIComponent(prefilledUrl))
      setActiveTab('link')
    }
  }, [searchParams])

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
          source_type: activeTab === 'link' ? 'url' : 'file',
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
        const { error: upErr } = await supabase.storage.from('videos').upload(path, file)
        if (upErr) throw new Error('Falha no upload do vídeo: ' + upErr.message)
        sourceUrl = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
      }

      // Recupera o template ativo configurado pelo usuário para aplicar nos cortes
      let activeTemplateConfig = null
      try {
        const savedTpl = localStorage.getItem('clippost_active_template')
        if (savedTpl) {
          const parsed = JSON.parse(savedTpl)
          activeTemplateConfig = parsed.config || parsed
        }
        if (!activeTemplateConfig) {
          const savedCfg = localStorage.getItem('clippost_template_config')
          if (savedCfg) activeTemplateConfig = JSON.parse(savedCfg)
        }
      } catch {}

      // Dispara job no backend com o template ativo; sem confirmação o projeto ficaria preso em "processing"
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          user_id: user.id,
          clip_duration: clipDuration,
          project_id: project.id,
          template_preset: 'meme_frame',
          template_config: activeTemplateConfig,
          remove_silence: removeSilence,
        }),
      }).catch(() => null)
      if (!jobRes || !jobRes.ok) {
        const detail = jobRes ? await jobRes.json().catch(() => ({})) : {}
        const msg = detail.error || 'O servidor de processamento não respondeu. Tente novamente em instantes.'
        await supabase.from('projects').update({ status: 'failed', error_message: msg }).eq('id', project.id)
        throw new Error(msg)
      }

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
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto text-white mb-4">
            <Scissors className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Criar Cortes 9:16 com IA</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Cole o link do YouTube, Instagram ou TikTok. A IA encontra os momentos mais virais, corta no formato vertical e aplica seu template oficial do Clipost.
          </p>
        </div>

        {/* Alternador Link / Arquivo */}
        <div className="flex p-1 bg-white/[0.02] border border-white/[0.08] rounded-xl max-w-sm mx-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === 'link'
                ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Por Link (URL)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === 'file'
                ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload de Arquivo</span>
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">Link do Vídeo</label>
                {getPlatformInfo(url) && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPlatformInfo(url)?.color} transition-all`}>
                    ✓ {getPlatformInfo(url)?.name} detectado
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Link2 className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  placeholder="Cole link do YouTube, TikTok, Reels, Twitter/X, Twitch..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121216] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#6366f1] transition-colors"
                />
              </div>

              {/* Badges de plataformas suportadas (Reclip / yt-dlp) */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-zinc-500">Plataformas suportadas:</span>
                {[
                  { name: 'YouTube', color: 'text-red-400 bg-red-500/10' },
                  { name: 'TikTok', color: 'text-cyan-400 bg-cyan-500/10' },
                  { name: 'Instagram', color: 'text-pink-400 bg-pink-500/10' },
                  { name: 'X / Twitter', color: 'text-zinc-300 bg-zinc-500/10' },
                  { name: 'Twitch', color: 'text-indigo-400 bg-indigo-500/10' },
                ].map(p => (
                  <span key={p.name} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.color}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Arquivo de Vídeo (MP4, MOV)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/[0.12] hover:border-[#6366f1]/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]"
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duração dos Cortes:
                </label>
                <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">
                  {clipDuration === 'auto' ? 'IA Automático' : `${clipDuration}s`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'auto', label: '⚡ IA Dinâmico', desc: 'Até 1m30s (Ideal Reels/Shorts)' },
                  { id: '30', label: '< 60s', desc: '20s - 45s (Ultra-rápidos)' },
                  { id: '60', label: '60s', desc: '35s - 60s (Padrão viral)' },
                  { id: '90', label: '60s+', desc: 'Até 90s (1 minuto e meio)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setClipDuration(opt.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      clipDuration === opt.id
                        ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                        : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${clipDuration === opt.id ? 'text-white' : 'text-zinc-200'}`}>
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
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    removeSilence ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'
                  }`}>
                    <VolumeX className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block">Remover pausas longas e silêncios</span>
                    <span className="text-[11px] text-zinc-400">Aumenta o ritmo e retenção do corte para prender a atenção</span>
                  </div>
                </div>
                <LiquidToggle
                  checked={removeSilence}
                  onChange={setRemoveSilence}
                  
                  activeColor="emerald"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
