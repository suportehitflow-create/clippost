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
  RotateCcw,
  SplitSquareVertical,
  Maximize2,
  Tv2,
  Star,
  Flame,
  Zap,
  CheckCircle2
} from 'lucide-react'

export type VideoLayoutType = 'split_screen' | 'full_speaker' | 'screen_react'
export type SubtitlePresetType = 'hormozi_yellow' | 'neon_glow' | 'clean_box' | 'minimal_apple'

interface TemplateItem {
  id?: string
  name: string
  layout_type: VideoLayoutType
  subtitle_preset: SubtitlePresetType
  font_family: string
  highlight_color: string
  show_username: boolean
  username: string
  avatar_url: string
  is_default: boolean
}

const LAYOUT_MODELS = [
  {
    id: 'split_screen' as VideoLayoutType,
    title: 'Interview / Podcast (Split Screen)',
    badge: '50/50 Dual Cam',
    desc: 'Tela dividida ao meio: foco do convidado em cima e apresentador embaixo com enquadramento facial sincronizado.',
    idealFor: 'Podcasts, mesas redondas e entrevistas remotas.'
  },
  {
    id: 'full_speaker' as VideoLayoutType,
    title: 'Full Speaker (9:16)',
    badge: 'Smart Focus',
    desc: 'Foco centralizado na pessoa que está falando com recorte dinâmico mantendo o rosto sempre no centro.',
    idealFor: 'Vlogs, palestras individuais, cortes solo e aulas.'
  },
  {
    id: 'screen_react' as VideoLayoutType,
    title: 'Screen / React (Facecam PiP)',
    badge: 'React & Gaming',
    desc: 'Vídeo ou tela principal em cima com a câmera de reação em formato circular/oval no terço inferior.',
    idealFor: 'Reações, tutoriais, gameplays e análises de notícias.'
  }
]

const SUBTITLE_PRESETS = [
  {
    id: 'hormozi_yellow' as SubtitlePresetType,
    name: 'Hormozi Viral',
    tag: 'Mais Retenção',
    desc: 'Caixa alta, amarelo/verde neon vibrante, sombra e contorno grosso para leitura rápida.',
    color: '#FACC15',
    sample: 'ESTE SEGREDO VAI MUDAR TUDO'
  },
  {
    id: 'neon_glow' as SubtitlePresetType,
    name: 'Neon Glow',
    tag: 'Estilo Gamer',
    desc: 'Brilho rosa e ciano com efeito fluorescente moderno.',
    color: '#06B6D4',
    sample: 'VEJA O QUE ACONTECEU AGORA'
  },
  {
    id: 'clean_box' as SubtitlePresetType,
    name: 'Clean Box',
    tag: 'Corporativo',
    desc: 'Palavras contidas em uma caixa preta translúcida com cantos arredondados.',
    color: '#FFFFFF',
    sample: 'Estratégia prática para aplicar hoje'
  },
  {
    id: 'minimal_apple' as SubtitlePresetType,
    name: 'Minimal Apple',
    tag: 'Elegante',
    desc: 'Tipografia SF Pro pura, sem poluição visual, fade sutil e acabamento premium.',
    color: '#E4E4E7',
    sample: 'Simplicidade é a sofisticação máxima'
  }
]

export default function TemplatesPage() {
  const [selectedLayout, setSelectedLayout] = useState<VideoLayoutType>('split_screen')
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitlePresetType>('hormozi_yellow')
  const [highlightColor, setHighlightColor] = useState('#FACC15')
  const [username, setUsername] = useState('@clippost.ai')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(true)
  const [templateName, setTemplateName] = useState('Podcast Split Screen Padrão')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState('')
  const [activeWordIdx, setActiveWordIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Simulate word highlight in live preview
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWordIdx(prev => (prev + 1) % 4)
    }, 450)
    return () => clearInterval(timer)
  }, [])

  // Load existing templates or brand kit
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Try templates table first, fallback to brand_kits
      const { data: tpl } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (tpl) {
        setTemplateName(tpl.name || 'Meu Template Padrão')
        setSelectedLayout(tpl.layout_type || 'split_screen')
        setSelectedSubtitle(tpl.subtitle_preset || 'hormozi_yellow')
        setHighlightColor(tpl.highlight_color || '#FACC15')
        setUsername(tpl.username || '@clippost.ai')
        setIsDefault(tpl.is_default ?? true)
        if (tpl.avatar_url) {
          setAvatarUrl(tpl.avatar_url)
          setAvatarPreview(tpl.avatar_url)
        }
      } else {
        // Fallback to brand_kits
        const { data: bk } = await supabase
          .from('brand_kits')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        if (bk) {
          if (bk.username) setUsername(bk.username)
          if (bk.avatar_url) {
            setAvatarUrl(bk.avatar_url)
            setAvatarPreview(bk.avatar_url)
          }
          if (bk.highlight_color) setHighlightColor(bk.highlight_color)
          if (bk.caption_preset) setSelectedSubtitle(bk.caption_preset as SubtitlePresetType)
        }
      }
      setLoading(false)
    }
    loadTemplate()
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
      name: templateName,
      layout_type: selectedLayout,
      subtitle_preset: selectedSubtitle,
      highlight_color: highlightColor,
      username,
      avatar_url: avatarUrl,
      is_default: isDefault,
      updated_at: new Date().toISOString()
    }

    // Try updating templates table; if error, save to brand_kits for compatibility
    const { error: tplErr } = await supabase.from('templates').upsert(payload)
    
    // Also save to brand_kits so current backend worker tasks.py immediately uses it
    await supabase.from('brand_kits').upsert({
      user_id: user.id,
      username,
      avatar_url: avatarUrl,
      caption_preset: selectedSubtitle,
      highlight_color: highlightColor,
      layout: {
        type: selectedLayout,
        avatar: { x: 80, y: 120, w: 96, h: 96 },
        username: { x: 190, y: 165 },
        hook: { x: 540, y: 280 },
        subtitles: { y: 1480, fontSize: 48 }
      }
    }, { onConflict: 'user_id' })

    setSaving(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  const previewWords = ['ESTE', 'CONTEÚDO', 'VAI', 'VIRALIZAR']

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Templates Globais
            </span>
            <span className="text-xs text-zinc-500">• Automação em Massa & AutoPilot</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Modelos de Vídeo & Estilos
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl">
            Defina as regras visuais automáticas que serão aplicadas em todos os novos vídeos gerados pela plataforma.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold tracking-wide text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Star className="w-3.5 h-3.5 fill-current" />
            )}
            {saving ? 'Salvando...' : savedSuccess ? 'Salvo!' : 'Salvar como Modelo Padrão'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configurator */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {/* SECTION 1: VIDEO LAYOUTS */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                  <SplitSquareVertical className="w-4 h-4" /> 1. Tipo de Layout de Vídeo
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Como os participantes ou elementos visuais serão enquadrados na tela vertical 9:16.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {LAYOUT_MODELS.map((m) => {
                const isSelected = selectedLayout === m.id
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedLayout(m.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-500/5 ring-1 ring-orange-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Schematic Icon */}
                    <div className="w-12 h-16 rounded-lg bg-black/60 border border-white/10 flex flex-col p-1 gap-1 flex-shrink-0 justify-center">
                      {m.id === 'split_screen' && (
                        <>
                          <div className="flex-1 rounded bg-orange-500/30 border border-orange-500/40" />
                          <div className="flex-1 rounded bg-orange-500/30 border border-orange-500/40" />
                        </>
                      )}
                      {m.id === 'full_speaker' && (
                        <div className="w-full h-full rounded bg-orange-500/30 border border-orange-500/40 flex items-center justify-center">
                          <User className="w-4 h-4 text-orange-400" />
                        </div>
                      )}
                      {m.id === 'screen_react' && (
                        <div className="w-full h-full relative rounded bg-orange-500/20 border border-orange-500/40">
                          <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-orange-500/60 border border-white/20" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white flex items-center gap-2">
                          {m.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed mb-2">{m.desc}</p>
                      <span className="text-[11px] text-zinc-500">
                        <strong className="text-zinc-400 font-medium">Ideal para:</strong> {m.idealFor}
                      </span>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECTION 2: SUBTITLE PRESETS */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2 mb-1">
              <Type className="w-4 h-4" /> 2. Estilo de Legenda Padrão (1-Clique)
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              Estilo tipográfico que será renderizado automaticamente em cada clipe.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SUBTITLE_PRESETS.map((p) => {
                const isSelected = selectedSubtitle === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedSubtitle(p.id)
                      setHighlightColor(p.color)
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-500/5 ring-1 ring-orange-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                        {p.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">{p.desc}</p>
                    <div
                      className="px-2.5 py-1.5 rounded-lg bg-black/50 text-[11px] font-bold text-center truncate border border-white/5"
                      style={{ color: p.color }}
                    >
                      {p.sample}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECTION 3: IDENTITY */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2 mb-1">
              <User className="w-4 h-4" /> 3. Identidade & Autor dos Cortes
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              Sua marca d'água oficial adicionada no topo de todos os clipes.
            </p>

            <div className="flex items-center gap-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-16 h-16 rounded-full border-2 border-dashed border-white/20 hover:border-orange-500/60 bg-white/[0.02] flex items-center justify-center cursor-pointer overflow-hidden transition-all group flex-shrink-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-zinc-500" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarUpload}
              />

              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Nome de Usuário (@handle)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@seuperfil"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] focus:border-orange-500/50 rounded-xl text-xs text-white placeholder-zinc-600 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Mockup Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" /> Preview do Template em Ação
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-mono">
              {selectedLayout === 'split_screen' ? 'Dual Cam' : selectedLayout === 'full_speaker' ? 'Solo Focus' : 'React PiP'}
            </span>
          </div>

          {/* iPhone 16 Pro Frame */}
          <div className="relative w-[300px] h-[600px] bg-black rounded-[48px] p-3 shadow-2xl shadow-black ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30 flex items-center justify-end px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
            </div>

            {/* Screen Canvas (9:16) */}
            <div className="relative flex-1 w-full rounded-[38px] overflow-hidden bg-[#09090b] border border-white/[0.05] flex flex-col select-none">
              {/* LAYOUT 1: SPLIT SCREEN */}
              {selectedLayout === 'split_screen' && (
                <div className="absolute inset-0 flex flex-col">
                  {/* Top: Guest Speaker */}
                  <div className="flex-1 bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-white/20 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-16 h-16 rounded-full bg-zinc-700/60 border border-white/20 flex items-center justify-center shadow-lg">
                      <User className="w-8 h-8 text-zinc-300" />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 mt-2 bg-black/40 px-2 py-0.5 rounded-full">
                      Convidado
                    </span>
                  </div>

                  {/* Bottom: Host */}
                  <div className="flex-1 bg-gradient-to-b from-zinc-900 to-[#121214] flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-16 h-16 rounded-full bg-zinc-700/60 border border-white/20 flex items-center justify-center shadow-lg">
                      <User className="w-8 h-8 text-zinc-300" />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 mt-2 bg-black/40 px-2 py-0.5 rounded-full">
                      Apresentador
                    </span>
                  </div>
                </div>
              )}

              {/* LAYOUT 2: FULL SPEAKER */}
              {selectedLayout === 'full_speaker' && (
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-zinc-700/60 border-2 border-white/20 flex items-center justify-center shadow-2xl">
                    <User className="w-12 h-12 text-zinc-300" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 mt-3 bg-black/50 px-2.5 py-0.5 rounded-full border border-white/10">
                    Foco Centralizado 9:16
                  </span>
                </div>
              )}

              {/* LAYOUT 3: SCREEN / REACT */}
              {selectedLayout === 'screen_react' && (
                <div className="absolute inset-0 bg-zinc-900 flex flex-col">
                  {/* Main Screen */}
                  <div className="flex-1 bg-gradient-to-b from-zinc-800 to-zinc-950 flex items-center justify-center">
                    <Tv2 className="w-12 h-12 text-zinc-600" />
                  </div>
                  {/* PiP Circle */}
                  <div className="absolute bottom-20 right-4 w-16 h-16 rounded-full bg-black border-2 border-orange-500/80 shadow-2xl flex items-center justify-center overflow-hidden z-20">
                    <User className="w-7 h-7 text-orange-400" />
                  </div>
                </div>
              )}

              {/* Author & Username Badge */}
              <div className="absolute top-12 left-4 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-lg">
                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3 h-3 text-zinc-400" />
                  )}
                </div>
                {username && (
                  <span className="text-[10px] font-semibold text-white/90 font-mono">
                    {username}
                  </span>
                )}
              </div>

              {/* Subtitle Preview */}
              <div className="absolute bottom-10 inset-x-3 z-30 text-center">
                {selectedSubtitle === 'hormozi_yellow' && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl">
                    {previewWords.map((w, idx) => {
                      const isHigh = idx === activeWordIdx
                      return (
                        <span
                          key={idx}
                          className={`font-black uppercase tracking-tight text-xs transition-all ${
                            isHigh ? 'scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] text-yellow-400' : 'text-white'
                          }`}
                        >
                          {w}
                        </span>
                      )
                    })}
                  </div>
                )}

                {selectedSubtitle === 'neon_glow' && (
                  <div className="inline-block px-3 py-1.5 rounded-xl bg-black/80 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    <span className="font-extrabold uppercase text-xs tracking-wider text-cyan-300">
                      VEJA O QUE ACONTECEU
                    </span>
                  </div>
                )}

                {selectedSubtitle === 'clean_box' && (
                  <div className="inline-block px-3.5 py-1.5 rounded-xl bg-black/90 border border-white/10">
                    <span className="font-medium text-xs text-white">
                      Estratégia prática para aplicar hoje
                    </span>
                  </div>
                )}

                {selectedSubtitle === 'minimal_apple' && (
                  <div className="inline-block drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    <span className="font-sans font-medium text-xs text-zinc-200">
                      Simplicidade é a sofisticação máxima
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 mt-3 font-mono">Mockup Proporção 9:16 (Full HD 1080x1920)</span>
        </div>
      </div>
    </div>
  )
}
