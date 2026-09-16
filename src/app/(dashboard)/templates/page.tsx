'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  Sliders,
  Type,
  User,
  Move,
  Check,
  Upload,
  RefreshCw,
  Eye,
  Layers,
  Palette,
  Play,
  RotateCcw
} from 'lucide-react'

type CaptionPreset = 'dynamic' | 'minimal' | 'cinematic' | 'bold'

interface TemplateLayout {
  avatar: { x: number; y: number; w: number; h: number }
  username: { x: number; y: number }
  hook: { x: number; y: number }
  subtitles: { y: number; fontSize: number }
}

const DEFAULT_LAYOUT: TemplateLayout = {
  avatar: { x: 80, y: 120, w: 96, h: 96 },
  username: { x: 190, y: 165 },
  hook: { x: 540, y: 280 },
  subtitles: { y: 1480, fontSize: 48 },
}

const PRESETS: { id: CaptionPreset; label: string; desc: string; sample: string; badge: string }[] = [
  {
    id: 'dynamic',
    label: 'Dynamic Pop',
    desc: 'Palavra por palavra com destaque dinâmico neon estilo Hormozi/Beast.',
    sample: 'ESTA FRASE VAI VIRALIZAR AGORA',
    badge: 'Mais Viral'
  },
  {
    id: 'minimal',
    label: 'Apple Minimal',
    desc: 'Tipografia limpa e precisa com fundo translúcido fosco e alto contraste.',
    sample: 'Design refinado e minimalista',
    badge: 'Pro'
  },
  {
    id: 'cinematic',
    label: 'Cinemático',
    desc: 'Estilo clássico de documentário com proporção condensada e sombras profundas.',
    sample: 'O segredo que ninguém revela',
    badge: 'Estudo'
  },
  {
    id: 'bold',
    label: 'Bold Impact',
    desc: 'Letras pesadas com contorno marcante para vídeos acelerados.',
    sample: 'ATENÇÃO PARA ESTE DETALHE',
    badge: 'Alto Retenção'
  },
]

const HIGHLIGHT_COLORS = [
  { name: 'Neon Yellow', hex: '#FACC15' },
  { name: 'Sunset Orange', hex: '#F97316' },
  { name: 'Mint Green', hex: '#10B981' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Cyan Tech', hex: '#06B6D4' },
  { name: 'Electric Purple', hex: '#A855F7' },
]

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<'captions' | 'identity' | 'layout'>('captions')
  const [preset, setPreset] = useState<CaptionPreset>('dynamic')
  const [highlightColor, setHighlightColor] = useState('#FACC15')
  const [username, setUsername] = useState('@clippost.ai')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [layout, setLayout] = useState<TemplateLayout>(DEFAULT_LAYOUT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isPlayingPreview, setIsPlayingPreview] = useState(true)
  const [activeWordIndex, setActiveWordIndex] = useState(1)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Word animation simulation for preview
  useEffect(() => {
    if (!isPlayingPreview) return
    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % 5)
    }, 450)
    return () => clearInterval(interval)
  }, [isPlayingPreview])

  // Load existing template / brand kit
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        if (data.username) setUsername(data.username)
        if (data.avatar_url) {
          setAvatarUrl(data.avatar_url)
          setAvatarPreview(data.avatar_url)
        }
        if (data.layout) {
          setLayout({
            avatar: { ...DEFAULT_LAYOUT.avatar, ...(data.layout.avatar || {}) },
            username: { ...DEFAULT_LAYOUT.username, ...(data.layout.username || {}) },
            hook: { ...DEFAULT_LAYOUT.hook, ...(data.layout.hook || {}) },
            subtitles: { ...DEFAULT_LAYOUT.subtitles, ...(data.layout.subtitles || {}) },
          })
        }
        if (data.caption_preset) setPreset(data.caption_preset as CaptionPreset)
        if (data.highlight_color) setHighlightColor(data.highlight_color)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarPreview(URL.createObjectURL(file))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const filePath = `avatars/${user.id}-${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('videos')
      .upload(filePath, file, { upsert: true })

    if (uploadErr) {
      setError('Erro ao enviar imagem: ' + uploadErr.message)
      return
    }

    const { data: pubData } = supabase.storage.from('videos').getPublicUrl(filePath)
    setAvatarUrl(pubData.publicUrl)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSavedSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Usuário não autenticado.')
      setSaving(false)
      return
    }

    const payload = {
      user_id: user.id,
      username,
      avatar_url: avatarUrl,
      layout,
      caption_preset: preset,
      highlight_color: highlightColor,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertErr } = await supabase
      .from('brand_kits')
      .upsert(payload, { onConflict: 'user_id' })

    setSaving(false)
    if (upsertErr) {
      setError('Erro ao salvar template: ' + upsertErr.message)
    } else {
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    }
  }

  const sampleWords = ['ESTE', 'CORTE', 'VAI', 'EXPLODIR', 'AGORA']

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Studio Pro
            </span>
            <span className="text-xs text-zinc-500">• Design System 9:16</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Templates & Identidade Visual
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl">
            Configure estilos cinematográficos de legendas, avatar dinâmico e posicionamento vertical automático para todos os seus clipes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLayout(DEFAULT_LAYOUT)}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redefinir
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold tracking-wide text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {saving ? 'Salvando...' : savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Template'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Studio Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Tabs Selector */}
          <div className="flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
            <button
              onClick={() => setActiveTab('captions')}
              className={`flex-1 py-2.5 px-4 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'captions'
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Type className="w-4 h-4 text-orange-400" />
              Estilo de Legendas
            </button>
            <button
              onClick={() => setActiveTab('identity')}
              className={`flex-1 py-2.5 px-4 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'identity'
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4 text-orange-400" />
              Autor & Avatar
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 py-2.5 px-4 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'layout'
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4 text-orange-400" />
              Ajuste de Posições
            </button>
          </div>

          {/* TAB 1: CAPTIONS */}
          {activeTab === 'captions' && (
            <div className="space-y-6">
              {/* Presets Cards */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-orange-400" /> Presets de Renderização
                </h3>
                <p className="text-xs text-zinc-400 mb-4">Escolha a animação e o peso visual das palavras faladas no clipe.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESETS.map((p) => {
                    const isSelected = preset === p.id
                    return (
                      <div
                        key={p.id}
                        onClick={() => setPreset(p.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500/40 shadow-md shadow-orange-500/5'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-white">{p.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 font-medium">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">{p.desc}</p>
                        <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-[11px] font-mono text-zinc-300 truncate">
                          {p.sample}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Color Picker & Typography */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-white mb-1">Cor de Destaque da Palavra Ativa</h3>
                <p className="text-xs text-zinc-400 mb-4">A cor que brilha quando a palavra exata está sendo pronunciada.</p>

                <div className="flex flex-wrap gap-3 mb-6">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setHighlightColor(c.hex)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-xs"
                      style={{
                        borderColor: highlightColor === c.hex ? c.hex : 'rgba(255,255,255,0.08)',
                        background: highlightColor === c.hex ? `${c.hex}15` : 'rgba(255,255,255,0.02)',
                        color: highlightColor === c.hex ? '#fff' : '#a1a1aa'
                      }}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: c.hex }} />
                      <span className="font-medium">{c.name}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-300">Tamanho da Legenda</span>
                    <span className="text-xs font-mono text-orange-400">{layout.subtitles.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="32"
                    max="72"
                    step="2"
                    value={layout.subtitles.fontSize}
                    onChange={(e) =>
                      setLayout({
                        ...layout,
                        subtitles: { ...layout.subtitles, fontSize: Number(e.target.value) },
                      })
                    }
                    className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTITY */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-white mb-1">Avatar do Criador</h3>
                <p className="text-xs text-zinc-400 mb-5">Selo de autoridade exibido no topo do clipe.</p>

                <div className="flex items-center gap-5">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-20 h-20 rounded-full border-2 border-dashed border-white/20 hover:border-orange-500/60 bg-white/[0.02] flex items-center justify-center cursor-pointer overflow-hidden transition-all group shadow-inner"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-zinc-500 group-hover:text-zinc-300" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarUpload}
                  />

                  <div className="flex-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-all flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5 text-zinc-400" />
                      Fazer upload da foto
                    </button>
                    <p className="text-[11px] text-zinc-500 mt-2">Recomendado: PNG ou JPG quadrado (ex: 500x500px).</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-white mb-1">Nome de Usuário (@handle)</h3>
                <p className="text-xs text-zinc-400 mb-4">Aparece posicionado ao lado ou abaixo do seu avatar.</p>

                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@seunome"
                    className="w-full px-4 py-3 bg-black/40 border border-white/[0.08] focus:border-orange-500/50 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAYOUT */}
          {activeTab === 'layout' && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Move className="w-4 h-4 text-orange-400" /> Posicionamento em Escala Vertical (1080x1920)
                </h3>
                <p className="text-xs text-zinc-400">Ajuste a altura (Y) dos elementos para garantir que não fiquem cobertos pela interface do TikTok/Reels.</p>
              </div>

              {/* Subtitles Y */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-300">Altura das Legendas (Y)</span>
                  <span className="text-xs font-mono text-orange-400">{layout.subtitles.y}px</span>
                </div>
                <input
                  type="range"
                  min="1100"
                  max="1700"
                  step="10"
                  value={layout.subtitles.y}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      subtitles: { ...layout.subtitles, y: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Hook Title Y */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-300">Altura do Gancho/Título (Y)</span>
                  <span className="text-xs font-mono text-orange-400">{layout.hook.y}px</span>
                </div>
                <input
                  type="range"
                  min="180"
                  max="500"
                  step="10"
                  value={layout.hook.y}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      hook: { ...layout.hook, y: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Avatar Y */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-300">Altura do Avatar (Y)</span>
                  <span className="text-xs font-mono text-orange-400">{layout.avatar.y}px</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="300"
                  step="10"
                  value={layout.avatar.y}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      avatar: { ...layout.avatar, y: Number(e.target.value) },
                      username: { ...layout.username, y: Number(e.target.value) + 45 },
                    })
                  }
                  className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Apple-Style Smartphone Mockup 9:16 Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" /> Preview ao Vivo (9:16)
            </span>
            <button
              onClick={() => setIsPlayingPreview(!isPlayingPreview)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] transition-all flex items-center gap-1.5"
            >
              <Play className="w-3 h-3 text-orange-400" />
              {isPlayingPreview ? 'Pausar Ritmo' : 'Simular Palavras'}
            </button>
          </div>

          {/* iPhone 16 Pro Frame */}
          <div className="relative w-[300px] h-[600px] bg-black rounded-[48px] p-3 shadow-2xl shadow-black ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30 flex items-center justify-end px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
            </div>

            {/* Screen Canvas (9:16) */}
            <div className="relative flex-1 w-full rounded-[38px] overflow-hidden bg-gradient-to-b from-[#18181b] via-[#09090b] to-[#121214] border border-white/[0.05] flex flex-col select-none">
              {/* Subtle background glow */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Dynamic Header: Avatar & Username */}
              <div
                className="absolute transition-all duration-150 flex items-center gap-2 z-20"
                style={{
                  left: `${(layout.avatar.x / 1080) * 100}%`,
                  top: `${(layout.avatar.y / 1920) * 100}%`,
                }}
              >
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/20 overflow-hidden shadow-md flex items-center justify-center flex-shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </div>
                {username && (
                  <span className="text-[11px] font-semibold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans">
                    {username}
                  </span>
                )}
              </div>

              {/* Hook Title Banner */}
              <div
                className="absolute w-full px-4 text-center z-20 transition-all duration-150"
                style={{
                  top: `${(layout.hook.y / 1920) * 100}%`,
                }}
              >
                <div className="inline-block px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                  <span className="text-[11px] font-bold text-amber-300 tracking-wide uppercase">
                    Segredo Revelado 🔥
                  </span>
                </div>
              </div>

              {/* Center Play Indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                  <Play className="w-5 h-5 text-white/60 ml-0.5" />
                </div>
              </div>

              {/* Animated Subtitle Canvas */}
              <div
                className="absolute w-full px-4 text-center z-20 transition-all duration-150"
                style={{
                  top: `${(layout.subtitles.y / 1920) * 100}%`,
                }}
              >
                {preset === 'dynamic' && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl">
                    {sampleWords.map((word, idx) => {
                      const isHighlighted = idx === activeWordIndex
                      return (
                        <span
                          key={idx}
                          className={`font-black uppercase tracking-tight transition-all duration-150 ${
                            isHighlighted ? 'scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'opacity-80'
                          }`}
                          style={{
                            fontSize: `${Math.max(12, layout.subtitles.fontSize * 0.28)}px`,
                            color: isHighlighted ? highlightColor : '#FFFFFF',
                          }}
                        >
                          {word}
                        </span>
                      )
                    })}
                  </div>
                )}

                {preset === 'minimal' && (
                  <div className="inline-block px-3.5 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10">
                    <p
                      className="font-medium text-white tracking-normal font-sans"
                      style={{ fontSize: `${Math.max(11, layout.subtitles.fontSize * 0.25)}px` }}
                    >
                      Design refinado e minimalista
                    </p>
                  </div>
                )}

                {preset === 'cinematic' && (
                  <div className="inline-block drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    <p
                      className="font-serif italic text-amber-200 tracking-wider"
                      style={{ fontSize: `${Math.max(12, layout.subtitles.fontSize * 0.26)}px` }}
                    >
                      "O segredo que ninguém revela"
                    </p>
                  </div>
                )}

                {preset === 'bold' && (
                  <div className="inline-block px-3 py-1 bg-yellow-400 text-black font-black uppercase tracking-tighter shadow-xl">
                    <p style={{ fontSize: `${Math.max(11, layout.subtitles.fontSize * 0.26)}px` }}>
                      ATENÇÃO PARA ESTE DETALHE
                    </p>
                  </div>
                )}
              </div>

              {/* TikTok / Reels Right Overlay Simulation */}
              <div className="absolute right-2 bottom-12 flex flex-col items-center gap-3 opacity-60 pointer-events-none">
                <div className="w-6 h-6 rounded-full bg-white/20" />
                <div className="w-5 h-5 rounded-full bg-white/20" />
                <div className="w-5 h-5 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 mt-3 font-mono">Mockup Proporção 9:16 (Full HD 1080x1920)</span>
        </div>
      </div>
    </div>
  )
}
