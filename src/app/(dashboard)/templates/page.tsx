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
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export type VideoLayoutType = 'single_speaker' | 'split_screen' | 'screen_react' | 'screen_share' | 'full_speaker'
export type SubtitlePresetType = 'hormozi_yellow' | 'neon' | 'clean_box' | 'minimal' | 'neon_glow' | 'minimal_apple'

interface TemplateItem {
  id?: string
  name: string
  layout: VideoLayoutType
  subtitle_preset: SubtitlePresetType
  font_family?: string
  highlight_color?: string
  show_username?: boolean
  username?: string
  avatar_url?: string
  is_default: boolean
}

// Fallback padrão em memória para garantir que a UI nunca trave mesmo sem migration
const defaultFallbackTemplate = {
  layout: 'single_speaker' as VideoLayoutType,
  subtitle_preset: 'hormozi_yellow' as SubtitlePresetType,
  is_default: true
}

const LAYOUT_MODELS = [
  {
    id: 'single_speaker' as VideoLayoutType,
    title: 'Full Speaker (9:16)',
    badge: 'Smart Focus',
    desc: 'Foco centralizado na pessoa que está falando com recorte dinâmico mantendo o rosto sempre no centro.',
    idealFor: 'Vlogs, palestras individuais, cortes solo e aulas.'
  },
  {
    id: 'split_screen' as VideoLayoutType,
    title: 'Interview / Podcast (Split Screen)',
    badge: '50/50 Dual Cam',
    desc: 'Tela dividida ao meio: foco do convidado em cima e apresentador embaixo com enquadramento facial sincronizado.',
    idealFor: 'Podcasts, mesas redondas e entrevistas remotas.'
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
    desc: 'Caixa alta, amarelo neon vibrante, sombra e contorno para máxima leitura.',
    color: '#FFE600',
    sample: 'ESTE SEGREDO VAI MUDAR TUDO'
  },
  {
    id: 'neon' as SubtitlePresetType,
    name: 'Neon Cyber',
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
    id: 'minimal' as SubtitlePresetType,
    name: 'Minimal Apple',
    tag: 'Elegante',
    desc: 'Tipografia SF Pro pura, sem poluição visual, fade sutil e acabamento premium.',
    color: '#E4E4E7',
    sample: 'Simplicidade é a sofisticação máxima'
  }
]

export default function TemplatesPage() {
  const [selectedLayout, setSelectedLayout] = useState<VideoLayoutType>(defaultFallbackTemplate.layout)
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitlePresetType>(defaultFallbackTemplate.subtitle_preset)
  const [highlightColor, setHighlightColor] = useState('#FFE600')
  const [username, setUsername] = useState('@clippost.ai')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(defaultFallbackTemplate.is_default)
  const [templateName, setTemplateName] = useState('Padrão Viral')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState('')
  const [activeWordIdx, setActiveWordIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Simulação de palavra ativa no preview ao vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWordIdx(prev => (prev + 1) % 4)
    }, 450)
    return () => clearInterval(timer)
  }, [])

  // Carregamento de template com try/catch e fallback em memória
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true)
      setError('')
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setSelectedLayout(defaultFallbackTemplate.layout)
          setSelectedSubtitle(defaultFallbackTemplate.subtitle_preset)
          setIsDefault(defaultFallbackTemplate.is_default)
          setLoading(false)
          return
        }

        // 3. FRONTEND: Tratamento de Fallback na Consulta de Template
        try {
          const { data: tpl, error: tplErr } = await supabase
            .from('templates')
            .select('*')
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!tplErr && tpl) {
            setTemplateName(tpl.name || 'Padrão Viral')
            const rawLayout = tpl.layout || tpl.layout_type || defaultFallbackTemplate.layout
            const resolvedLayout = (rawLayout === 'full_speaker' ? 'single_speaker' : rawLayout) as VideoLayoutType
            setSelectedLayout(resolvedLayout)
            setSelectedSubtitle((tpl.subtitle_preset || defaultFallbackTemplate.subtitle_preset) as SubtitlePresetType)
            setHighlightColor(tpl.highlight_color || '#FFE600')
            setUsername(tpl.username || '@clippost.ai')
            setIsDefault(tpl.is_default ?? defaultFallbackTemplate.is_default)
            if (tpl.avatar_url) {
              setAvatarUrl(tpl.avatar_url)
              setAvatarPreview(tpl.avatar_url)
            }
          } else {
            console.log('Template não encontrado ou tabela ausente, utilizando defaultFallbackTemplate')
            setSelectedLayout(defaultFallbackTemplate.layout)
            setSelectedSubtitle(defaultFallbackTemplate.subtitle_preset)
            setIsDefault(defaultFallbackTemplate.is_default)
          }
        } catch (tableErr) {
          console.warn('Erro ao consultar templates, usando fallback padrão:', tableErr)
          setSelectedLayout(defaultFallbackTemplate.layout)
          setSelectedSubtitle(defaultFallbackTemplate.subtitle_preset)
          setIsDefault(defaultFallbackTemplate.is_default)
        }
      } catch (err: any) {
        console.warn('Erro geral ao carregar dados do usuário:', err)
        setSelectedLayout(defaultFallbackTemplate.layout)
        setSelectedSubtitle(defaultFallbackTemplate.subtitle_preset)
        setIsDefault(defaultFallbackTemplate.is_default)
      } finally {
        setLoading(false)
      }
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

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado.')
        setSaving(false)
        return
      }

      const payload = {
        user_id: user.id,
        name: templateName,
        layout: selectedLayout,
        layout_type: selectedLayout,
        subtitle_preset: selectedSubtitle,
        highlight_color: highlightColor,
        username,
        avatar_url: avatarUrl,
        is_default: isDefault,
        updated_at: new Date().toISOString()
      }

      const { error: tplErr } = await supabase.from('templates').upsert(payload)
      if (tplErr) {
        console.warn('Templates table upsert notice:', tplErr.message)
      }
      
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

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      console.error('Erro ao salvar template:', err)
      setError('Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
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
            <span className="text-xs text-zinc-400">Automação em Massa</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Modelos de Vídeo & Legendas
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Configure presets que o robô usará automaticamente ao processar qualquer vídeo novo pelo AutoPilot ou envio individual.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
              </>
            ) : savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" /> Salvo com Sucesso!
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Salvar como Padrão
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Grid: Left Controls (7 cols) + Right Live Preview (5 cols) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Layout, Subtitles, Branding */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* SECTION 1: VIDEO LAYOUTS */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <SplitSquareVertical className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">1. Tipo de Layout de Vídeo</h2>
                  <p className="text-xs text-zinc-400">Como a IA enquadrará e dividirá a tela (9:16)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LAYOUT_MODELS.map((m) => {
                const isSelected = selectedLayout === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedLayout(m.id)}
                    className={`relative text-left p-4 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/[0.08] border-orange-500/50 shadow-md ring-1 ring-orange-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                          {m.badge}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug">{m.title}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed mb-3">{m.desc}</p>
                    </div>
                    <div className="pt-2 border-t border-white/[0.05]">
                      <span className="text-[10px] text-orange-400/90 font-medium block">
                        Ideal: {m.idealFor}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* SECTION 2: SUBTITLE PRESETS */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Type className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">2. Estilos de Legenda Viral</h2>
                  <p className="text-xs text-zinc-400">Animações de alto impacto calibradas para retenção</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUBTITLE_PRESETS.map((sub) => {
                const isSelected = selectedSubtitle === sub.id || (sub.id === 'neon' && selectedSubtitle === 'neon_glow') || (sub.id === 'minimal' && selectedSubtitle === 'minimal_apple')
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubtitle(sub.id)}
                    className={`relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/[0.08] border-orange-500/50 shadow-md ring-1 ring-orange-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                        {sub.tag}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />
                      <h3 className="text-sm font-semibold text-white">{sub.name}</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{sub.desc}</p>
                    <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/[0.05] text-center">
                      <span className="text-[11px] font-bold tracking-tight" style={{ color: sub.color }}>
                        {sub.sample}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* SECTION 3: BRANDING & WATERMARK */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">3. Identidade Visual do Canal</h2>
                <p className="text-xs text-zinc-400">Foto de perfil e @ do canal nos cortes automáticos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">Avatar do Canal</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-lg text-xs font-medium text-white transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" /> Alterar foto
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">Nome de Usuário (@)</label>
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
              {selectedLayout === 'split_screen' ? 'Dual Cam' : selectedLayout === 'single_speaker' || selectedLayout === 'full_speaker' ? 'Solo Focus' : 'React PiP'}
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
              {/* LAYOUT: SPLIT SCREEN */}
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

              {/* LAYOUT: SINGLE / FULL SPEAKER */}
              {(selectedLayout === 'single_speaker' || selectedLayout === 'full_speaker') && (
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-zinc-700/60 border-2 border-white/20 flex items-center justify-center shadow-2xl">
                    <User className="w-12 h-12 text-zinc-300" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 mt-3 bg-black/50 px-2.5 py-0.5 rounded-full border border-white/10">
                    Foco Centralizado 9:16
                  </span>
                </div>
              )}

              {/* LAYOUT: SCREEN / REACT */}
              {(selectedLayout === 'screen_react' || selectedLayout === 'screen_share') && (
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

                {(selectedSubtitle === 'neon' || selectedSubtitle === 'neon_glow') && (
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

                {(selectedSubtitle === 'minimal' || selectedSubtitle === 'minimal_apple') && (
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
