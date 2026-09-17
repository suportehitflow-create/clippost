'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  Type,
  User,
  Move,
  Check,
  Upload,
  RefreshCw,
  Eye,
  Layers,
  Palette,
  RotateCcw,
  CheckCircle2,
  Camera,
  Sliders,
  Maximize2,
  Zap,
  Info
} from 'lucide-react'

export type VideoLayoutType = 'meme_frame' | 'split_screen' | 'single_speaker' | 'screen_react'

export interface SubtitlePreset {
  id: string
  name: string
  tag: string
  badgeColor: string
  textColor: string
  bgColor?: string
  borderColor?: string
  glow?: string
  sampleText: string
}

const SUBTITLE_PRESETS_18: SubtitlePreset[] = [
  {
    id: 'hormozi_orange',
    name: 'Hormozi Orange',
    tag: 'Mais Retenção',
    badgeColor: '#ea580c',
    textColor: '#ffffff',
    bgColor: '#ea580c',
    sampleText: 'AUTOMATICALLY'
  },
  {
    id: 'hormozi_yellow',
    name: 'Hormozi Yellow',
    tag: 'Viral Clássico',
    badgeColor: '#facc15',
    textColor: '#000000',
    bgColor: '#facc15',
    sampleText: 'HEY THERE'
  },
  {
    id: 'neon_cyan',
    name: 'Neon Cyan',
    tag: 'Gamer / Tech',
    badgeColor: '#06b6d4',
    textColor: '#22d3ee',
    glow: '0 0 12px rgba(6,182,212,0.8)',
    sampleText: 'HEY THERE'
  },
  {
    id: 'neon_magenta',
    name: 'Neon Magenta',
    tag: 'Cyberpunk',
    badgeColor: '#ec4899',
    textColor: '#f472b6',
    glow: '0 0 12px rgba(236,72,153,0.8)',
    sampleText: 'HEY THERE'
  },
  {
    id: 'neon_green',
    name: 'Neon Green',
    tag: 'Finanças / Crypto',
    badgeColor: '#22c55e',
    textColor: '#4ade80',
    glow: '0 0 12px rgba(34,197,94,0.8)',
    sampleText: 'HEY THERE'
  },
  {
    id: 'karaoke_active',
    name: 'Karaoke Active',
    tag: 'Dinâmico',
    badgeColor: '#eab308',
    textColor: '#ffffff',
    bgColor: '#22c55e',
    sampleText: 'PALAVRA ATIVA'
  },
  {
    id: 'two_tone_red',
    name: 'Two Tone Red',
    tag: 'Atenção Total',
    badgeColor: '#ef4444',
    textColor: '#f87171',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'two_tone_orange',
    name: 'Two Tone Orange',
    tag: 'Podcast',
    badgeColor: '#f97316',
    textColor: '#fb923c',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'two_tone_green',
    name: 'Two Tone Green',
    tag: 'Natureza',
    badgeColor: '#10b981',
    textColor: '#34d399',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'two_tone_yellow',
    name: 'Two Tone Yellow',
    tag: 'Alerta',
    badgeColor: '#eab308',
    textColor: '#fde047',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'two_tone_blue',
    name: 'Two Tone Blue',
    tag: 'Profissional',
    badgeColor: '#3b82f6',
    textColor: '#60a5fa',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'typewriter_underline',
    name: 'Typewriter Underline',
    tag: 'Editorial',
    badgeColor: '#d4d4d8',
    textColor: '#f4f4f5',
    sampleText: 'HEY THERE'
  },
  {
    id: 'italic_gold',
    name: 'Italic Gold',
    tag: 'Storytelling',
    badgeColor: '#fef08a',
    textColor: '#fef08a',
    sampleText: 'Hey there'
  },
  {
    id: 'apple_sf',
    name: 'Apple SF Pro',
    tag: 'Sofisticado',
    badgeColor: '#e4e4e7',
    textColor: '#f4f4f5',
    sampleText: 'Simplicidade pura'
  },
  {
    id: 'bold_stroke',
    name: 'Bold Black Stroke',
    tag: 'Alto Contraste',
    badgeColor: '#ffffff',
    textColor: '#ffffff',
    sampleText: 'ESTE SEGREDO'
  },
  {
    id: 'purple_pill',
    name: 'Purple Pill',
    tag: 'Tech',
    badgeColor: '#7c3aed',
    textColor: '#ffffff',
    bgColor: '#7c3aed',
    sampleText: 'Hey there'
  },
  {
    id: 'retro_gradient',
    name: 'Retro Sunset',
    tag: 'Lifestyle',
    badgeColor: '#f43f5e',
    textColor: '#fb7185',
    sampleText: 'VEJA O VÍDEO'
  },
  {
    id: 'minimal_dark',
    name: 'Minimal Dark',
    tag: 'Discreto',
    badgeColor: '#71717a',
    textColor: '#f4f4f5',
    bgColor: 'rgba(0,0,0,0.7)',
    sampleText: 'SUBTÍTULO'
  }
]

const AVATAR_PRESETS = [
  { label: 'Gatinho Meme', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80' },
  { label: 'Podcast Host', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { label: 'Gamer Pro', url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&auto=format&fit=crop&q=80' },
  { label: 'Influencer', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80' },
]

const HOOK_PRESETS = [
  'Meu maior arrependimento foi não ter seguido essa página antes 😭😭',
  'Você não vai acreditar no que ele falou no final desse podcast... 🤯',
  'Pare de cometer esse erro imediatamente se você quer ter resultados! 🚨',
  'Esse segredo nunca foi revelado em nenhum lugar antes 🤫',
]

export default function TemplatesPageEnhanced() {
  const supabase = createClient()

  // Layout & Positioning
  const [selectedLayout, setSelectedLayout] = useState<VideoLayoutType>('meme_frame')
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('hormozi_orange')
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'gradient'>('white')
  
  // Interactive Frame Positioning
  const [videoYOffset, setVideoYOffset] = useState<number>(50) // % from top
  const [videoScale, setVideoScale] = useState<number>(88) // % width
  const [hookText, setHookText] = useState('Meu maior arrependimento foi não ter seguido essa página antes 😭😭')
  const [brandName, setBrandName] = useState('HUMOR DO BICHANO')
  const [brandHandle, setBrandHandle] = useState('@humordobichano')
  const [hasVerified, setHasVerified] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState<string>('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')

  // Dragging & Interaction State
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const phoneScreenRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragStartYRef = useRef<number>(0)
  const initialYOffsetRef = useRef<number>(50)
  const dragStartXRef = useRef<number>(0)
  const initialScaleRef = useRef<number>(88)

  // Load saved template
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clippost_active_template')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.layout) setSelectedLayout(parsed.layout)
        if (parsed.subtitle_preset) setSelectedSubtitle(parsed.subtitle_preset)
        if (parsed.config?.videoYOffset !== undefined) setVideoYOffset(parsed.config.videoYOffset)
        if (parsed.config?.videoScale !== undefined) setVideoScale(parsed.config.videoScale)
        if (parsed.config?.hookText) setHookText(parsed.config.hookText)
        if (parsed.config?.brandName) setBrandName(parsed.config.brandName)
        if (parsed.config?.brandHandle) setBrandHandle(parsed.config.brandHandle)
        if (parsed.config?.hasVerified !== undefined) setHasVerified(parsed.config.hasVerified)
        if (parsed.config?.templateBg) setTemplateBg(parsed.config.templateBg)
        if (parsed.avatar_url) setAvatarPreview(parsed.avatar_url)
      }
    } catch {}

    async function loadRemote() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
        if (bk?.layout_config) {
          const cfg = bk.layout_config
          if (cfg.layout) setSelectedLayout(cfg.layout)
          if (cfg.subtitle_preset) setSelectedSubtitle(cfg.subtitle_preset)
          if (cfg.videoYOffset !== undefined) setVideoYOffset(cfg.videoYOffset)
          if (cfg.videoScale !== undefined) setVideoScale(cfg.videoScale)
          if (cfg.hookText) setHookText(cfg.hookText)
          if (cfg.brandName) setBrandName(cfg.brandName)
          if (cfg.hasVerified !== undefined) setHasVerified(cfg.hasVerified)
          if (cfg.templateBg) setTemplateBg(cfg.templateBg)
          if (bk.username) setBrandHandle(bk.username)
          if (bk.avatar_url) setAvatarPreview(bk.avatar_url)
        }
      } catch {}
    }
    loadRemote()
  }, [])

  // Auto-persist to localStorage on changes
  const persistTemplate = useCallback((overrides: any = {}) => {
    const payload = {
      name: 'Template 9:16 Personalizado',
      layout: selectedLayout,
      subtitle_preset: selectedSubtitle,
      avatar_url: avatarPreview,
      config: {
        videoYOffset,
        videoScale,
        hookText,
        brandName,
        brandHandle,
        hasVerified,
        templateBg,
        ...overrides
      }
    }
    try {
      localStorage.setItem('clippost_active_template', JSON.stringify(payload))
    } catch {}
  }, [selectedLayout, selectedSubtitle, avatarPreview, videoYOffset, videoScale, hookText, brandName, brandHandle, hasVerified, templateBg])

  useEffect(() => {
    persistTemplate()
  }, [persistTemplate])

  // Explicit Save
  const handleSave = async () => {
    setSaving(true)
    try {
      persistTemplate()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('brand_kits').upsert({
          user_id: user.id,
          name: 'Template 9:16',
          username: brandHandle,
          avatar_url: avatarPreview,
          is_default: true,
          layout_config: {
            layout: selectedLayout,
            subtitle_preset: selectedSubtitle,
            videoYOffset,
            videoScale,
            hookText,
            brandName,
            hasVerified,
            templateBg
          }
        })
      }
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // File Upload for Avatar
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const url = ev.target.result as string
          setAvatarPreview(url)
          persistTemplate({ avatar_url: url })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // --- DRAG LOGIC FOR POSITIONING VIDEO ON SCREEN ---
  const handleStartDrag = (clientY: number) => {
    setIsDragging(true)
    dragStartYRef.current = clientY
    initialYOffsetRef.current = videoYOffset

    const handleMouseMove = (e: MouseEvent) => {
      if (!phoneScreenRef.current) return
      const screenH = phoneScreenRef.current.clientHeight
      const deltaY = e.clientY - dragStartYRef.current
      const deltaPercent = (deltaY / screenH) * 100
      const newY = Math.max(15, Math.min(75, initialYOffsetRef.current + deltaPercent))
      setVideoYOffset(Math.round(newY))
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!phoneScreenRef.current || !e.touches[0]) return
      const screenH = phoneScreenRef.current.clientHeight
      const deltaY = e.touches[0].clientY - dragStartYRef.current
      const deltaPercent = (deltaY / screenH) * 100
      const newY = Math.max(15, Math.min(75, initialYOffsetRef.current + deltaPercent))
      setVideoYOffset(Math.round(newY))
    }

    const handleStop = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleStop)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleStop)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleStop)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleStop)
  }

  // --- RESIZE LOGIC FOR CORNER HANDLES ---
  const handleStartResize = (clientX: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    dragStartXRef.current = clientX
    initialScaleRef.current = videoScale

    const handleMouseMove = (ev: MouseEvent) => {
      if (!phoneScreenRef.current) return
      const screenW = phoneScreenRef.current.clientWidth
      const deltaX = ev.clientX - dragStartXRef.current
      const deltaPercent = (deltaX / screenW) * 100
      const newScale = Math.max(55, Math.min(98, initialScaleRef.current + deltaPercent))
      setVideoScale(Math.round(newScale))
    }

    const handleStop = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleStop)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleStop)
  }

  // Current Subtitle Preset Info
  const activeSubPreset = SUBTITLE_PRESETS_18.find(p => p.id === selectedSubtitle) || SUBTITLE_PRESETS_18[0]

  // Cycle Subtitle Style on direct click
  const cycleNextSubtitle = () => {
    const currentIdx = SUBTITLE_PRESETS_18.findIndex(p => p.id === selectedSubtitle)
    const nextIdx = (currentIdx + 1) % SUBTITLE_PRESETS_18.length
    setSelectedSubtitle(SUBTITLE_PRESETS_18[nextIdx].id)
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Hidden file input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-orange-500" />
              Templates 9:16 Interativo
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold">
              100% Interativo
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Arraste o vídeo diretamente na tela do celular, clique nos textos para editar e escolha a legenda ideal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setVideoYOffset(50)
              setVideoScale(88)
              setHookText('Meu maior arrependimento foi não ter seguido essa página antes 😭😭')
              setBrandName('HUMOR DO BICHANO')
              setBrandHandle('@humordobichano')
              setHasVerified(true)
              setSelectedSubtitle('hormozi_orange')
              setTemplateBg('white')
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20 cursor-pointer active:scale-95"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {savedSuccess ? 'Template Salvo!' : 'Salvar Template'}
          </button>
        </div>
      </div>

      {/* PAINEL PRINCIPAL: CONTROLES À ESQUERDA + CELULAR INTERATIVO À DIREITA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUNA ESQUERDA: PRESETS RÁPIDOS & CONTROLES */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* GUIA DE INTERAÇÃO DIRETA */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 flex items-start gap-3">
            <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-white block">Tudo é editável diretamente no celular ao lado:</span>
              <p className="text-zinc-300 leading-relaxed">
                • <strong className="text-orange-400">Arraste o vídeo</strong> para cima ou para baixo para posicionar.<br />
                • <strong className="text-orange-400">Clique na foto</strong> para enviar qualquer foto do seu computador.<br />
                • <strong className="text-orange-400">Clique no título ou no texto</strong> para digitar seu próprio conteúdo.<br />
                • <strong className="text-orange-400">Clique na legenda</strong> para trocar de estilo instantaneamente.
              </p>
            </div>
          </div>

          {/* 1. SELEÇÃO DE LAYOUT VIRAL */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                1. Formato do Template
              </h2>
              <span className="text-[11px] text-zinc-400">Padrão: Meme Frame</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'meme_frame', name: 'Meme Frame', desc: 'Foto + Título + Vídeo Flutuante' },
                { id: 'single_speaker', name: 'Tela Cheia 9:16', desc: 'Vídeo preenchendo o fundo' },
                { id: 'split_screen', name: 'Tela Dividida', desc: 'Duas câmeras ou gameplay embaixo' },
                { id: 'screen_react', name: 'Reação / React', desc: 'Vídeo principal com react no topo' },
              ].map(layout => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setSelectedLayout(layout.id as VideoLayoutType)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedLayout === layout.id
                      ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                      : 'border-white/[0.08] bg-[#16161a] hover:border-white/20'
                  }`}
                >
                  <span className={`text-xs font-bold block ${selectedLayout === layout.id ? 'text-orange-400' : 'text-white'}`}>
                    {layout.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block line-clamp-1">
                    {layout.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. COR DE FUNDO DO MEME */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-orange-400" />
              2. Fundo da Moldura
            </h2>
            <div className="flex gap-2.5">
              {[
                { id: 'white', label: 'Branco Viral (Meme Twitter/Insta)', bg: 'bg-white text-black border-zinc-300' },
                { id: 'dark', label: 'Dark / OLED Black', bg: 'bg-zinc-950 text-white border-zinc-700' },
                { id: 'gradient', label: 'Cinza Moderno', bg: 'bg-zinc-800 text-zinc-100 border-zinc-600' },
              ].map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setTemplateBg(b.id as any)}
                  className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    templateBg === b.id
                      ? 'border-orange-500 ring-2 ring-orange-500/40'
                      : 'border-white/10 hover:border-white/30'
                  } ${b.bg}`}
                >
                  {templateBg === b.id && <Check className="w-3.5 h-3.5" />}
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. CATÁLOGO DE 18 ESTILOS DE LEGENDAS VIRAIS */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-orange-400" />
                  3. Escolha o Estilo de Legenda
                </h2>
                <p className="text-xs text-zinc-400">Clique em qualquer estilo para aplicar imediatamente na tela ao lado.</p>
              </div>
              <span className="text-xs text-orange-400 font-mono font-bold">18 Presets</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto p-1 pr-2">
              {SUBTITLE_PRESETS_18.map(sub => {
                const isSelected = selectedSubtitle === sub.id
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubtitle(sub.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center items-center min-h-[64px] ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/[0.12] ring-2 ring-orange-500/40 scale-[1.02]'
                        : 'border-white/[0.08] bg-[#16161a] hover:border-white/20'
                    }`}
                  >
                    <div
                      className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-tight"
                      style={{
                        backgroundColor: sub.bgColor || 'transparent',
                        color: sub.textColor,
                        border: sub.borderColor ? `1px solid ${sub.borderColor}` : 'none',
                        boxShadow: sub.glow || 'none'
                      }}
                    >
                      {sub.sampleText}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 font-mono">
                      {sub.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* AJUSTES MANUAIS POR SLIDERS (OPCIONAL) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" />
              Ajuste Fino por Sliders
            </h2>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Posição Vertical do Vídeo</span>
                  <span className="font-mono text-orange-400">{videoYOffset}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="75"
                  value={videoYOffset}
                  onChange={e => setVideoYOffset(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Tamanho / Zoom do Vídeo</span>
                  <span className="font-mono text-orange-400">{videoScale}%</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="98"
                  value={videoScale}
                  onChange={e => setVideoScale(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: CELULAR INTERATIVO COM EDIÇÃO DIRETA */}
        <div className="lg:col-span-6 flex flex-col items-center">
          
          <div className="w-full max-w-[340px] flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Editor WYSIWYG ao Vivo
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono font-semibold">
              Arraste & Clique
            </span>
          </div>

          {/* MOCKUP DO IPHONE */}
          <div className="relative w-[340px] h-[660px] bg-black rounded-[48px] p-3 shadow-2xl ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-40 flex items-center justify-end px-2 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
            </div>

            {/* SCREEN CANVAS (9:16) */}
            <div
              ref={phoneScreenRef}
              className={`relative flex-1 w-full rounded-[38px] overflow-hidden flex flex-col p-4 select-none transition-colors duration-200 ${
                templateBg === 'white'
                  ? 'bg-white text-zinc-900'
                  : templateBg === 'dark'
                  ? 'bg-black text-white'
                  : 'bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-white'
              }`}
            >
              
              {/* HEADER INTERATIVO: FOTO + TÍTULO + HANDLE + HOOK */}
              <div className="pt-6 flex flex-col items-center text-center relative z-20">
                
                {/* AVATAR CLICÁVEL COM UPLOAD */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 p-0.5 mb-2 shadow-lg cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all"
                  title="Clique para trocar foto de perfil"
                >
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-full"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity rounded-full">
                    <Camera className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] font-bold uppercase">Trocar</span>
                  </div>
                </div>

                {/* TÍTULO EDITÁVEL INLINE + SELO DE VERIFICADO */}
                <div className="flex items-center justify-center gap-1.5 w-full px-2">
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    placeholder="NOME DA PÁGINA"
                    className={`font-black text-xs tracking-tight uppercase text-center bg-transparent border-b border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded px-1 max-w-[200px] transition-all ${
                      templateBg === 'white' ? 'text-zinc-900' : 'text-white'
                    }`}
                  />
                  
                  {/* SELO DE VERIFICADO CLICÁVEL */}
                  <button
                    type="button"
                    onClick={() => setHasVerified(!hasVerified)}
                    title={hasVerified ? 'Selo de verificado ativo (clique para desativar)' : 'Sem selo (clique para ativar)'}
                    className="cursor-pointer hover:scale-120 active:scale-95 transition-transform shrink-0"
                  >
                    {hasVerified ? (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-black shadow-sm">
                        ✓
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-dashed border-zinc-400 text-zinc-400 flex items-center justify-center text-[8px] opacity-40 hover:opacity-100">
                        +
                      </div>
                    )}
                  </button>
                </div>

                {/* @HANDLE EDITÁVEL INLINE */}
                <input
                  type="text"
                  value={brandHandle}
                  onChange={e => setBrandHandle(e.target.value)}
                  placeholder="@seucanal"
                  className={`text-[10px] font-mono text-center bg-transparent border-b border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded px-1 max-w-[180px] transition-all ${
                    templateBg === 'white' ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                />

                {/* HOOK CAPTION EDITÁVEL INLINE */}
                <textarea
                  value={hookText}
                  onChange={e => setHookText(e.target.value)}
                  placeholder="Digite sua chamada viral aqui..."
                  rows={2}
                  className={`font-bold text-xs text-center bg-transparent border border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded-lg p-1.5 mt-2 w-full resize-none transition-all leading-snug ${
                    templateBg === 'white' ? 'text-zinc-900' : 'text-zinc-100'
                  }`}
                />
              </div>

              {/* VÍDEO ARRASTÁVEL INTERATIVO (DRAGGABLE & RESIZABLE) */}
              <div
                onMouseDown={(e) => handleStartDrag(e.clientY)}
                onTouchStart={(e) => handleStartDrag(e.touches[0].clientY)}
                className={`absolute left-1/2 -translate-x-1/2 select-none group ${
                  isDragging ? 'cursor-grabbing scale-[1.01]' : 'cursor-grab'
                }`}
                style={{
                  top: `${videoYOffset}%`,
                  width: `${videoScale}%`,
                  aspectRatio: '1/1',
                  transition: isDragging ? 'none' : 'box-shadow 0.2s',
                  zIndex: 30
                }}
              >
                {/* Bounding Box com borda azul e handles */}
                <div className={`relative w-full h-full rounded-2xl overflow-hidden border-2 shadow-2xl ${
                  isDragging ? 'border-orange-500 ring-4 ring-orange-500/30' : 'border-blue-500 hover:border-orange-400'
                }`}>
                  
                  {/* Imagem de preview do vídeo */}
                  <img
                    src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80"
                    alt="Video Preview"
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  {/* Âncora Central de Movimento */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl transition-all ${
                      isDragging
                        ? 'bg-orange-600 text-white scale-110 shadow-orange-500/40'
                        : 'bg-blue-600/90 text-white group-hover:bg-orange-600'
                    }`}>
                      <Move className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold font-mono tracking-tight">
                        {isDragging ? `Y: ${videoYOffset}%` : 'Arraste Aqui'}
                      </span>
                    </div>
                  </div>

                  {/* Corner Handles de Redimensionamento */}
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 bg-blue-500 rounded-sm border border-white shadow pointer-events-none" />
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-sm border border-white shadow pointer-events-none" />
                  <div className="absolute bottom-1.5 left-1.5 w-3 h-3 bg-blue-500 rounded-sm border border-white shadow pointer-events-none" />
                  
                  {/* Resize Handle Interativo no canto inferior direito */}
                  <div
                    onMouseDown={(e) => handleStartResize(e.clientX, e)}
                    className="absolute bottom-1 right-1 w-4 h-4 bg-orange-500 rounded-sm border-2 border-white shadow-lg cursor-nwse-resize z-40 hover:scale-125 transition-transform"
                    title="Arraste para redimensionar o vídeo"
                  />

                  {/* LEGENDA DINÂMICA DENTRO DO VÍDEO (CLICÁVEL E INTERATIVA) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      cycleNextSubtitle()
                    }}
                    className="absolute bottom-3 inset-x-2 flex flex-col items-center cursor-pointer group/sub z-40"
                    title="Clique para trocar o estilo da legenda!"
                  >
                    <div
                      className="px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-tight shadow-xl transition-all hover:scale-105 active:scale-95 text-center"
                      style={{
                        backgroundColor: activeSubPreset.bgColor || 'rgba(0,0,0,0.85)',
                        color: activeSubPreset.textColor,
                        border: activeSubPreset.borderColor ? `1px solid ${activeSubPreset.borderColor}` : 'none',
                        boxShadow: activeSubPreset.glow || '0 4px 12px rgba(0,0,0,0.6)'
                      }}
                    >
                      {activeSubPreset.sampleText}
                    </div>

                    <span className="text-[8px] font-mono text-white/90 bg-black/70 px-1.5 py-0.5 rounded mt-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                      Estilo: {activeSubPreset.name} (Clique para mudar)
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* DICAS DE CONTROLE RÁPIDO DO CELULAR */}
          <div className="w-full max-w-[340px] mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Sugestões de Hooks Virais:</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {HOOK_PRESETS.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHookText(h)}
                  className="p-1.5 rounded-lg bg-[#16161a] border border-white/[0.08] hover:border-orange-500/40 text-[10px] text-zinc-300 hover:text-white truncate text-left transition-colors cursor-pointer"
                  title={h}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2">
              <span>Avatares Rápidos:</span>
            </div>
            <div className="flex gap-2">
              {AVATAR_PRESETS.map((av, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarPreview(av.url)}
                  className="flex-1 p-1 rounded-lg bg-[#16161a] border border-white/[0.08] hover:border-orange-500/50 text-[10px] text-zinc-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <img src={av.url} alt="" className="w-4 h-4 rounded-full object-cover" />
                  <span className="truncate">{av.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
