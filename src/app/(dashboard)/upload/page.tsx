'use client'

import ProfileSwitcher from '@/components/ProfileSwitcher'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'
import { Scissors, Link2, Clock, Check, Loader2, UploadCloud, AlertCircle, Sparkles, X } from 'lucide-react'

function getPlatformInfo(inputUrl: string) {
  if (!inputUrl.trim()) return null
  const u = inputUrl.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { name: 'YouTube', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
  }
  if (u.includes('tiktok.com')) {
    return { name: 'TikTok', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
  }
  if (u.includes('instagram.com')) {
    return { name: 'Instagram Reels', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
  }
  if (u.includes('twitter.com') || u.includes('x.com')) {
    return { name: 'X / Twitter', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
  }
  if (u.includes('twitch.tv')) {
    return { name: 'Twitch', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
  }
  return { name: 'Vídeo Web (yt-dlp)', color: 'bg-white/[0.04] text-zinc-300 border-white/[0.1]' }
}

export default function CreateClipsPage() {
  const [url, setUrl] = useState('')
  const [clipDuration, setClipDuration] = useState<'30' | '60' | '90' | 'auto'>('auto')
  const [removeSilence, setRemoveSilence] = useState(true)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicVolume, setMusicVolume] = useState(25)
  const [enhanceAudio, setEnhanceAudio] = useState(false)
  const musicRef = useRef<HTMLInputElement>(null)
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
        const uploaded = await uploadFileViaSignedUrl(supabase, 'videos', path, file)
        sourceUrl = uploaded.publicUrl
        await supabase.from('projects').update({ source_url: sourceUrl, storage_path: uploaded.path }).eq('id', project.id)
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

      // Áudio dos cortes: música de fundo (vai para o Storage) e limpeza da voz
      

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
          remove_silence: false,
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
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/[0.06] grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Scissors className="w-4 h-4" />
          </div>
          <h1 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
            Minerador de Cortes 9:16
          </h1>
        </div>

        <div className="flex justify-center">
          <ProfileSwitcher align="center" />
        </div>

        {/* Template Ativo Pill */}
        <div className="flex justify-end">
          <Link
            href="/templates"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
            title="Ver ou trocar template visual de marca"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline text-zinc-400">Template Ativo:</span>
            <span className="text-white font-bold">Oficial Clipost</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Intro */}
        <div className="text-center space-y-2.5 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ferramenta #1 • Vídeo Longo para Vídeos Curtos</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">
            Criar cortes a partir de vídeos longos
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Focado no YouTube e arquivos longos de vídeo. A IA encontra os momentos virais de maior retenção, recorta no formato 9:16 e gera os clipes prontos.
          </p>
        </div>

        {/* Alternador Link / Arquivo */}
        <div className="flex p-1 bg-white/[0.02] border border-white/[0.08] rounded-2xl max-w-xs mx-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === 'link'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Por Link (URL)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Arquivo MP4</span>
          </button>
        </div>

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'link' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Link do Vídeo do YouTube</label>
                
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Link2 className="w-4 h-4 text-indigo-400" />
                </div>
                <input
                  type="url"
                  placeholder="Cole o link do vídeo do YouTube (ex: https://www.youtube.com/watch?v=...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans"
                />
              </div>

              </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Arquivo de Vídeo (MP4, MOV)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03] space-y-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-white">
                  {file ? file.name : 'Clique para selecionar um vídeo do seu computador'}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">Suporta até 500MB em MP4 ou MOV</p>
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
          <div className="space-y-4 pt-4 border-t border-white/[0.06]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duração dos Cortes:
                </label>
                <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  {clipDuration === 'auto' ? 'IA Automático' : `${clipDuration}s`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'auto', label: '⚡ IA Dinâmico', desc: 'Até 1m30s (Ideal Reels/Shorts)' },
                  { id: '30', label: '< 60s', desc: '20s - 50s (Ultra-rápidos)' },
                  { id: '90', label: '> 60s', desc: '60s - 90s (Padrão e mais longos)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setClipDuration(opt.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      clipDuration === opt.id
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${clipDuration === opt.id ? 'text-white' : 'text-zinc-200'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block leading-tight font-mono">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Visual Preview */}
          <div className="p-4 rounded-2xl bg-[#09090d] border border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] text-zinc-400 font-mono">
            <div className="space-y-0.5">
              <span className="text-indigo-400 font-bold block">1. Ingestão</span>
              <span>Download & Limpeza</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-indigo-400 font-bold block">2. Whisper</span>
              <span>Transcrição IA</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-indigo-400 font-bold block">3. Curador IA</span>
              <span>Enquadramento 9:16</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-indigo-400 font-bold block">4. Render</span>
              <span>Legendas & Enquadramento</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Iniciando Processamento com IA...</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>Gerar Cortes Virais com IA</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
