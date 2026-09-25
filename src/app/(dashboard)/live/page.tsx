'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { createClient } from '@/lib/supabase/client'
import {
  Radio,
  Tv,
  Scissors,
  Sparkles,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Download,
  Share2,
  Zap,
  ArrowRight,
  ShieldCheck,
  Video
} from 'lucide-react'

export default function LiveClipperPage() {
  const [streamUrl, setStreamUrl] = useState('')
  const [channelName, setChannelName] = useState('')
  const [platform, setPlatform] = useState<'twitch' | 'youtube' | null>(null)
  const [bufferSeconds, setBufferSeconds] = useState<30 | 60 | 120>(120)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [brandKit, setBrandKit] = useState<any>(null)

  const router = useRouter()
  const supabase = createClient()

  // Carrega o brand_kit ativo do usuário
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const res = await fetch(`/api/brand-kit?user_id=${user.id}`).then(r => r.json()).catch(() => null)
          if (res?.brand_kit) setBrandKit(res.brand_kit)
        }
      } catch {}
    })()
  }, [])

  // Detecta plataforma e nome do canal
  useEffect(() => {
    const u = streamUrl.toLowerCase().trim()
    if (!u) {
      setPlatform(null)
      setChannelName('')
      return
    }
    if (u.includes('twitch.tv/')) {
      setPlatform('twitch')
      const parts = u.split('twitch.tv/')[1]?.split('/')[0]?.split('?')[0]
      setChannelName(parts || '')
    } else if (u.includes('youtube.com/') || u.includes('youtu.be/')) {
      setPlatform('youtube')
      setChannelName('YouTube Live')
    } else {
      setPlatform(null)
      setChannelName('')
    }
  }, [streamUrl])

  async function handleClipLive(e: React.FormEvent) {
    e.preventDefault()
    if (!streamUrl.trim()) {
      setError('Insira o link da transmissão ao vivo.')
      return
    }
    if (!platform) {
      setError('Insira um link válido da Twitch ou do YouTube Live.')
      return
    }

    setLoading(true)
    setError('')
    setStatusMessage('Capturando os últimos ' + bufferSeconds + ' segundos da live...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Cria projeto no Supabase
      const { data: project, error: dbErr } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: `Corte Ao Vivo - ${channelName || 'Stream'} (${bufferSeconds}s)`,
          source_url: streamUrl.trim(),
          source_type: 'url',
          status: 'processing',
        })
        .select()
        .single()

      if (dbErr || !project) throw new Error(dbErr?.message || 'Erro ao inicializar projeto.')

      setStatusMessage('Enviando clipe para o pipeline com template e legendas...')

      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: streamUrl.trim(),
          user_id: user.id,
          clip_duration: String(bufferSeconds),
          project_id: project.id,
          template_preset: 'meme_frame',
          template_config: brandKit?.layout_config || null,
          remove_silence: false,
        }),
      })

      if (!jobRes.ok) {
        const detail = await jobRes.json().catch(() => ({}))
        throw new Error(detail.error || 'Falha ao processar corte ao vivo.')
      }

      router.push(`/project/${project.id}`)
    } catch (err: any) {
      setError(err.message || 'Erro ao clipar transmissão ao vivo.')
      setLoading(false)
      setStatusMessage('')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/[0.06] grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Radio className="w-4 h-4 animate-pulse text-purple-400" />
          </div>
          <h1 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold flex items-center gap-1.5">
            <span>Cortes Ao Vivo</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold uppercase tracking-wider">
              Live
            </span>
          </h1>
        </div>

        <div className="flex justify-center">
          <ProfileSwitcher align="center" />
        </div>

        <div className="flex justify-end items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExtensionModal(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Extensão do Navegador</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Intro */}
        <div className="text-center space-y-2.5 max-w-lg mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Cortes de Lives (Twitch & YouTube)</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Acompanhe qualquer transmissão ao vivo e clipe retroativamente até 2 minutos para trás em 1 clique, com seu template de marca e legendas virais já aplicados.
          </p>
        </div>

        {/* Input da Transmissão */}
        <form onSubmit={handleClipLive} className="space-y-6 bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Link da Live (Twitch ou YouTube Live)
              </label>
              {platform && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  platform === 'twitch'
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}>
                  {platform === 'twitch' ? 'Twitch Stream' : 'YouTube Live'}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Radio className="w-4 h-4 text-purple-400" />
              </div>
              <input
                type="url"
                placeholder="Cole o link da live (ex: https://www.twitch.tv/gaules ou https://www.youtube.com/live/...)"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all font-sans"
              />
            </div>
          </div>

          {/* Buffer Retroativo */}
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Janela Retroativa de Corte:
              </label>
              <span className="text-[10px] text-purple-400 font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                Últimos {bufferSeconds} segundos
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 30, label: '⚡ 30 Segundos', desc: 'Punchline / Reação instantânea' },
                { id: 60, label: '⏱️ 60 Segundos (1 min)', desc: 'Momento viral completo' },
                { id: 120, label: '🔥 120 Segundos (2 min)', desc: 'História ou debate longo da live' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBufferSeconds(opt.id as any)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    bufferSeconds === opt.id
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                      : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={`text-xs font-bold block ${bufferSeconds === opt.id ? 'text-white' : 'text-zinc-200'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block leading-tight font-mono">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Template Ativo Preview */}
          <div className="p-4 rounded-2xl bg-[#09090d] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-white/20 bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                {brandKit?.avatar_url ? (
                  <img src={brandKit.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {brandKit?.layout_config?.brandName || 'Seu Template de Marca'}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono block">
                  {brandKit?.username || '@nomedapagina'} • Legenda Hormozi Ativa
                </span>
              </div>
            </div>
            <Link
              href="/templates"
              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-2 shrink-0"
            >
              Alterar Template
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMessage || 'Processando corte ao vivo...'}</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>Clipar Live Agora (Últimos {bufferSeconds}s)</span>
              </>
            )}
          </button>
        </form>

        {/* Live Stream Embed Preview (se URL inserida) */}
        {platform === 'twitch' && channelName && (
          <div className="bg-black/60 border border-white/[0.08] rounded-3xl overflow-hidden p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>Preview da Live: {channelName}</span>
              </span>
              <a
                href={`https://twitch.tv/${channelName}`}
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                Abrir na Twitch <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black">
              <iframe
                src={`https://player.twitch.tv/?channel=${channelName}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&muted=true`}
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal da Extensão do Navegador */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#0e0e14] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Extensão Clippost Live</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="text-zinc-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Clipar diretamente enquanto você assiste à live no Chrome ou Edge com o atalho <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-purple-300">Alt + C</kbd>.
            </p>

            <div className="space-y-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 text-xs text-zinc-400 font-mono">
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">1.</span>
                <span>Abra qualquer transmissão ao vivo na Twitch ou YouTube.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">2.</span>
                <span>Pressione <strong className="text-white">Alt + C</strong> ou clique no ícone da extensão.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">3.</span>
                <span>Os últimos 2 minutos são enviados ao Clippost e renderizados automaticamente com seu template de marca!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('O pacote da extensão (manifest v3) está disponível para instalação no modo desenvolvedor do Chrome.')
                setShowExtensionModal(false)
              }}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-600/30"
            >
              Baixar Extensão (.zip)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
