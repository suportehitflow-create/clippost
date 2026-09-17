'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  Move,
  Check,
  Upload,
  RefreshCw,
  RotateCcw,
  Camera,
  Type,
  X,
  Palette,
  Square,
  Circle,
  Sliders,
  CheckCheck,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2
} from 'lucide-react'

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

const SUBTITLE_PRESETS: SubtitlePreset[] = [
  { id: 'hormozi_orange', name: 'Hormozi Orange', tag: 'Mais Retenção', badgeColor: '#ea580c', textColor: '#ffffff', bgColor: '#ea580c', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'hormozi_yellow', name: 'Hormozi Yellow', tag: 'Viral Clássico', badgeColor: '#facc15', textColor: '#000000', bgColor: '#facc15', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'neon_cyan', name: 'Neon Cyan', tag: 'Tech', badgeColor: '#06b6d4', textColor: '#22d3ee', glow: '0 0 12px rgba(6,182,212,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'neon_magenta', name: 'Neon Magenta', tag: 'Cyberpunk', badgeColor: '#ec4899', textColor: '#f472b6', glow: '0 0 12px rgba(236,72,153,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'neon_green', name: 'Neon Green', tag: 'Finanças', badgeColor: '#22c55e', textColor: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'karaoke_active', name: 'Karaoke Verde', tag: 'Dinâmico', badgeColor: '#22c55e', textColor: '#ffffff', bgColor: '#22c55e', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'two_tone_red', name: 'Two Tone Red', tag: 'Atenção', badgeColor: '#ef4444', textColor: '#f87171', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'two_tone_orange', name: 'Two Tone Orange', tag: 'Podcast', badgeColor: '#f97316', textColor: '#fb923c', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'two_tone_blue', name: 'Two Tone Blue', tag: 'Business', badgeColor: '#3b82f6', textColor: '#60a5fa', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'typewriter_underline', name: 'Typewriter', tag: 'Editorial', badgeColor: '#d4d4d8', textColor: '#f4f4f5', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'apple_sf', name: 'Apple SF Pro', tag: 'Apple Style', badgeColor: '#e4e4e7', textColor: '#f4f4f5', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'bold_stroke', name: 'Bold Stroke', tag: 'Contraste', badgeColor: '#ffffff', textColor: '#ffffff', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'purple_pill', name: 'Purple Pill', tag: 'Modern', badgeColor: '#7c3aed', textColor: '#ffffff', bgColor: '#7c3aed', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'minimal_dark', name: 'Minimal Dark', tag: 'Discreto', badgeColor: '#71717a', textColor: '#f4f4f5', bgColor: 'rgba(0,0,0,0.75)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' }
]

const FONT_OPTIONS = [
  { id: 'sf_pro', name: 'SF Pro (Apple)', family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'inter', name: 'Inter', family: 'Inter, sans-serif' },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat, sans-serif' },
  { id: 'anton', name: 'Impact / Anton', family: 'Impact, "Arial Black", sans-serif' },
  { id: 'outfit', name: 'Outfit', family: 'Outfit, sans-serif' }
]

export default function TemplatesAppleStandard() {
  const supabase = createClient()

  // Fundo do template (Branco, Preto, Cinza)
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'gray'>('white')

  // Borda do vídeo: 'square' (0px) ou 'rounded' (20px)
  const [videoBorderRadius, setVideoBorderRadius] = useState<'rounded' | 'square'>('rounded')

  // Posicionamento 2D livre (X e Y em %)
  const [avatarPos, setAvatarPos] = useState<{ x: number, y: number }>({ x: 50, y: 7 })
  const [headerPos, setHeaderPos] = useState<{ x: number, y: number }>({ x: 50, y: 17 })
  const [titlePos, setTitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 26 })
  const [videoPos, setVideoPos] = useState<{ x: number, y: number }>({ x: 50, y: 46 })
  const [subtitlePos, setSubtitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 84 })

  // Escala / Dimensão do vídeo
  const [videoScale, setVideoScale] = useState(88) // % largura

  // Tipografia do Título (Padrão Apple)
  const [fontFamily, setFontFamily] = useState('system-ui, -apple-system, BlinkMacSystemFont, sans-serif')
  const [fontSize, setFontSize] = useState(13) // px
  const [textAlign, setTextAlign] = useState<'center' | 'left' | 'right'>('center')
  const [fontWeight, setFontWeight] = useState<'font-bold' | 'font-black' | 'font-semibold'>('font-bold')

  // Conteúdos textuais e visuais
  const [brandName, setBrandName] = useState('HUMOR DO BICHANO')
  const [brandHandle, setBrandHandle] = useState('@humordobichano')
  const [hasVerified, setHasVerified] = useState(true)
  const [titleText, setTitleText] = useState('É assim que o seu título vai aparecer no template quando você fizer uma edição de vídeo')
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')
  const [selectedSubtitle, setSelectedSubtitle] = useState('hormozi_orange')

  // Modais e seletores
  const [fontBarOpen, setFontBarOpen] = useState(false)
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false)
  const [draggingTarget, setDraggingTarget] = useState<'avatar' | 'header' | 'title' | 'video' | 'subtitle' | null>(null)
  const [isResizingVideo, setIsResizingVideo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const phoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const initialElemPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const resizeStartX = useRef(0)
  const initialScale = useRef(88)

  // Carregar configurações salvas
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clippost_active_template')
      if (saved) {
        const p = JSON.parse(saved)
        if (p.subtitle_preset) setSelectedSubtitle(p.subtitle_preset)
        if (p.avatar_url) setAvatarUrl(p.avatar_url)
        if (p.config) {
          const c = p.config
          if (c.templateBg) setTemplateBg(c.templateBg)
          if (c.videoBorderRadius) setVideoBorderRadius(c.videoBorderRadius)
          if (c.avatarPos) setAvatarPos(c.avatarPos)
          if (c.headerPos) setHeaderPos(c.headerPos)
          if (c.titlePos) setTitlePos(c.titlePos)
          if (c.videoPos) setVideoPos(c.videoPos)
          if (c.subtitlePos) setSubtitlePos(c.subtitlePos)
          if (c.videoScale !== undefined) setVideoScale(c.videoScale)
          if (c.fontSize) setFontSize(c.fontSize)
          if (c.fontFamily) setFontFamily(c.fontFamily)
          if (c.textAlign) setTextAlign(c.textAlign)
          if (c.brandName) setBrandName(c.brandName)
          if (c.brandHandle) setBrandHandle(c.brandHandle)
          if (c.hasVerified !== undefined) setHasVerified(c.hasVerified)
          if (c.titleText) setTitleText(c.titleText)
        }
      }
    } catch {}

    async function fetchSupabase() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
        if (bk?.layout_config) {
          const c = bk.layout_config
          if (c.templateBg) setTemplateBg(c.templateBg)
          if (c.videoBorderRadius) setVideoBorderRadius(c.videoBorderRadius)
          if (c.avatarPos) setAvatarPos(c.avatarPos)
          if (c.headerPos) setHeaderPos(c.headerPos)
          if (c.titlePos) setTitlePos(c.titlePos)
          if (c.videoPos) setVideoPos(c.videoPos)
          if (c.subtitlePos) setSubtitlePos(c.subtitlePos)
          if (c.videoScale !== undefined) setVideoScale(c.videoScale)
          if (c.fontSize) setFontSize(c.fontSize)
          if (c.fontFamily) setFontFamily(c.fontFamily)
          if (c.textAlign) setTextAlign(c.textAlign)
          if (c.brandName) setBrandName(c.brandName)
          if (c.titleText) setTitleText(c.titleText)
          if (c.hasVerified !== undefined) setHasVerified(c.hasVerified)
          if (c.subtitle_preset) setSelectedSubtitle(c.subtitle_preset)
        }
        if (bk?.avatar_url) setAvatarUrl(bk.avatar_url)
        if (bk?.username) setBrandHandle(bk.username)
      } catch {}
    }
    fetchSupabase()
  }, [])

  // Salvar no localStorage
  const saveToLocal = useCallback(() => {
    const payload = {
      name: 'Template 9:16',
      layout: 'meme_frame',
      subtitle_preset: selectedSubtitle,
      avatar_url: avatarUrl,
      config: {
        templateBg,
        videoBorderRadius,
        avatarPos,
        headerPos,
        titlePos,
        videoPos,
        subtitlePos,
        videoScale,
        fontFamily,
        fontSize,
        textAlign,
        brandName,
        brandHandle,
        hasVerified,
        titleText
      }
    }
    try {
      localStorage.setItem('clippost_active_template', JSON.stringify(payload))
    } catch {}
  }, [templateBg, videoBorderRadius, avatarPos, headerPos, titlePos, videoPos, subtitlePos, videoScale, fontFamily, fontSize, textAlign, brandName, brandHandle, hasVerified, titleText, selectedSubtitle, avatarUrl])

  useEffect(() => {
    saveToLocal()
  }, [saveToLocal])

  // Salvar explícito
  const handleSave = async () => {
    setSaving(true)
    try {
      saveToLocal()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('brand_kits').upsert({
          user_id: user.id,
          name: 'Template 9:16',
          username: brandHandle,
          avatar_url: avatarUrl,
          is_default: true,
          layout_config: {
            layout: 'meme_frame',
            subtitle_preset: selectedSubtitle,
            templateBg,
            videoBorderRadius,
            avatarPos,
            headerPos,
            titlePos,
            videoPos,
            subtitlePos,
            videoScale,
            fontFamily,
            fontSize,
            textAlign,
            brandName,
            hasVerified,
            titleText
          }
        })
      }
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Upload de Imagem de Perfil
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      const r = new FileReader()
      r.onload = (ev) => {
        if (ev.target?.result) {
          setAvatarUrl(ev.target.result as string)
        }
      }
      r.readAsDataURL(f)
    }
  }

  // Drag 2D (Eixos X e Y Livres)
  const startDrag2D = (target: 'avatar' | 'header' | 'title' | 'video' | 'subtitle', clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setDraggingTarget(target)
    dragStartPos.current = { x: clientX, y: clientY }

    if (target === 'avatar') initialElemPos.current = { ...avatarPos }
    else if (target === 'header') initialElemPos.current = { ...headerPos }
    else if (target === 'title') initialElemPos.current = { ...titlePos }
    else if (target === 'video') initialElemPos.current = { ...videoPos }
    else if (target === 'subtitle') initialElemPos.current = { ...subtitlePos }

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      const w = phoneRef.current.clientWidth
      const h = phoneRef.current.clientHeight

      const deltaX = ((curX - dragStartPos.current.x) / w) * 100
      const deltaY = ((curY - dragStartPos.current.y) / h) * 100

      const nextX = Math.max(10, Math.min(90, Math.round(initialElemPos.current.x + deltaX)))
      const nextY = Math.max(2, Math.min(96, Math.round(initialElemPos.current.y + deltaY)))

      if (target === 'avatar') setAvatarPos({ x: nextX, y: nextY })
      else if (target === 'header') setHeaderPos({ x: nextX, y: nextY })
      else if (target === 'title') setTitlePos({ x: nextX, y: nextY })
      else if (target === 'video') setVideoPos({ x: nextX, y: nextY })
      else if (target === 'subtitle') setSubtitlePos({ x: nextX, y: nextY })
    }

    const onUp = () => {
      setDraggingTarget(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
  }

  // Redimensionamento do Vídeo pelos Cantos
  const startResizeVideo = (clientX: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    resizeStartX.current = clientX
    initialScale.current = videoScale

    const onResizeMove = (ev: MouseEvent) => {
      if (!phoneRef.current) return
      const w = phoneRef.current.clientWidth
      const deltaPercent = ((ev.clientX - resizeStartX.current) / w) * 100
      const newScale = Math.max(50, Math.min(98, Math.round(initialScale.current + deltaPercent)))
      setVideoScale(newScale)
    }

    const onResizeUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
    }

    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeUp)
  }

  const activeSub = SUBTITLE_PRESETS.find(s => s.id === selectedSubtitle) || SUBTITLE_PRESETS[0]

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center p-4 sm:p-8">
      {/* File input invisível */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* CABEÇALHO LIMPO - PADRÃO APPLE */}
      <header className="w-full max-w-4xl flex items-center justify-between pb-6 mb-2 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Template</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAvatarPos({ x: 50, y: 7 })
              setHeaderPos({ x: 50, y: 17 })
              setTitlePos({ x: 50, y: 26 })
              setVideoPos({ x: 50, y: 46 })
              setSubtitlePos({ x: 50, y: 84 })
              setVideoScale(88)
              setVideoBorderRadius('rounded')
              setTemplateBg('white')
              setBrandName('HUMOR DO BICHANO')
              setBrandHandle('@humordobichano')
              setHasVerified(true)
              setTitleText('É assim que o seu título vai aparecer no template quando você fizer uma edição de vídeo')
              setSelectedSubtitle('hormozi_orange')
              setFontSize(13)
              setTextAlign('center')
            }}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <CheckCheck className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {savedSuccess ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </header>

      {/* ÁREA DE TRABALHO: BALÃO DE OPÇÕES NA ESQUERDA + IPHONE 16 PRO */}
      <div className="relative w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-8 pt-4">
        
        {/* BALÃO FLUTUANTE DE OPÇÕES NA ESQUERDA (PADRÃO APPLE FLOATING DOCK) */}
        <aside className="bg-[#141416]/90 border border-white/[0.1] backdrop-blur-2xl rounded-3xl p-3 shadow-2xl flex md:flex-col items-center gap-4 z-40">
          
          {/* SELEÇÃO DE CORES: BOLINHAS MINIMALISTAS */}
          <div className="flex md:flex-col gap-2.5 items-center">
            {/* Branco Padrão */}
            <button
              type="button"
              onClick={() => setTemplateBg('white')}
              title="Fundo Branco Padrão"
              className={`w-6 h-6 rounded-full bg-white border-2 transition-transform cursor-pointer flex items-center justify-center ${
                templateBg === 'white' ? 'border-orange-500 ring-2 ring-orange-500/50 scale-110' : 'border-zinc-300 hover:scale-105'
              }`}
            >
              {templateBg === 'white' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </button>

            {/* Preto OLED */}
            <button
              type="button"
              onClick={() => setTemplateBg('dark')}
              title="Fundo Preto OLED"
              className={`w-6 h-6 rounded-full bg-black border-2 transition-transform cursor-pointer flex items-center justify-center ${
                templateBg === 'dark' ? 'border-orange-500 ring-2 ring-orange-500/50 scale-110' : 'border-zinc-700 hover:scale-105'
              }`}
            >
              {templateBg === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </button>

            {/* Cinza Moderno */}
            <button
              type="button"
              onClick={() => setTemplateBg('gray')}
              title="Fundo Cinza Moderno"
              className={`w-6 h-6 rounded-full bg-zinc-800 border-2 transition-transform cursor-pointer flex items-center justify-center ${
                templateBg === 'gray' ? 'border-orange-500 ring-2 ring-orange-500/50 scale-110' : 'border-zinc-600 hover:scale-105'
              }`}
            >
              {templateBg === 'gray' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </button>
          </div>

          <div className="w-px h-5 md:w-5 md:h-px bg-white/10" />

          {/* BORDA DO VÍDEO: ARREDONDADA VS QUADRADA */}
          <button
            type="button"
            onClick={() => setVideoBorderRadius(prev => prev === 'rounded' ? 'square' : 'rounded')}
            title={videoBorderRadius === 'rounded' ? 'Borda Arredondada (clique para Quadrada)' : 'Borda Quadrada (clique para Arredondada)'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              videoBorderRadius === 'rounded'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-white/[0.05] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            {videoBorderRadius === 'rounded' ? (
              <Circle className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>

          {/* CONTROLE INTEGRADO DE TIPOGRAFIA (FONTE E TAMANHO) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFontBarOpen(!fontBarOpen)}
              title="Ajustar Fonte e Tamanho do Texto"
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                fontBarOpen
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'bg-white/[0.05] text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              <Type className="w-4 h-4" />
            </button>

            {/* POPOVER MINIMALISTA PADRÃO APPLE DE TIPOGRAFIA */}
            {fontBarOpen && (
              <div className="absolute left-10 md:left-12 top-0 bg-[#1c1c1f] border border-white/15 rounded-2xl p-3 shadow-2xl w-60 z-50 space-y-3 backdrop-blur-xl animate-in fade-in slide-in-from-left-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-[11px] font-semibold text-white">Tipografia</span>
                  <button type="button" onClick={() => setFontBarOpen(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Seleção de Fonte */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">Fonte</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs text-white outline-none focus:border-orange-500"
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.id} value={f.family} className="bg-zinc-900 text-white">
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stepper de Tamanho */}
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Tamanho</label>
                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
                      className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[11px] font-mono text-white px-1">{fontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setFontSize(prev => Math.min(22, prev + 1))}
                      className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Alinhamento de Texto */}
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Alinhar</label>
                  <div className="flex gap-1">
                    {[
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight }
                    ].map(a => {
                      const Icon = a.icon
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setTextAlign(a.id as any)}
                          className={`p-1.5 rounded-md text-xs cursor-pointer ${
                            textAlign === a.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-5 md:w-5 md:h-px bg-white/10" />

          {/* TROCAR FOTO */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Trocar Foto de Perfil"
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* SELETOR DE ESTILO DE LEGENDA */}
          <button
            type="button"
            onClick={() => setSubtitleModalOpen(true)}
            title="Escolher Estilo de Legenda"
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </aside>

        {/* TELA DO IPHONE 16 PRO (MICRO-BEZEL, SEM SOMBRAS INTERNAS) */}
        <div className="relative flex flex-col items-center">
          
          {/* MOCKUP IPHONE 16 PRO */}
          <div className="relative w-[340px] h-[690px] bg-[#0c0c0e] rounded-[52px] p-2.5 border-[3px] border-[#27272a] ring-1 ring-white/10 flex flex-col overflow-hidden select-none">
            
            {/* DYNAMIC ISLAND DO IPHONE 16 PRO */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50 flex items-center justify-end px-2.5 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#141416] border border-white/[0.06]" />
            </div>

            {/* CANVAS 9:16 (SEM SOMBRAS INTERNAS) */}
            <div
              ref={phoneRef}
              className={`relative flex-1 w-full rounded-[44px] overflow-hidden transition-colors duration-150 ${
                templateBg === 'white'
                  ? 'bg-white text-zinc-900'
                  : templateBg === 'dark'
                  ? 'bg-black text-white'
                  : 'bg-zinc-800 text-white'
              }`}
            >
              
              {/* 1. LOGO / AVATAR SOLTO 2D (SEM BORDA VERMELHA, MÓVEL EM X E Y) */}
              <div
                onMouseDown={(e) => startDrag2D('avatar', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('avatar', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${avatarPos.x}%`,
                  top: `${avatarPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-30 transition-shadow ${
                  draggingTarget === 'avatar' ? 'ring-2 ring-orange-500 rounded-full' : ''
                }`}
                title="Arraste a logo para onde quiser (para baixo, cima ou lados)"
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-14 h-14 rounded-full overflow-hidden border border-zinc-300/60 hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer bg-zinc-100"
                >
                  <img
                    src={avatarUrl}
                    alt="Foto de Perfil"
                    className="w-full h-full object-cover rounded-full"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                    <Camera className="w-3.5 h-3.5" />
                    <span className="text-[7px] font-semibold uppercase mt-0.5">Trocar</span>
                  </div>
                </div>
              </div>

              {/* 2. NOMES & VERIFICADO SOLTOS 2D (MÓVEIS EM X E Y) */}
              <div
                onMouseDown={(e) => startDrag2D('header', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('header', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${headerPos.x}%`,
                  top: `${headerPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute w-full px-4 text-center cursor-grab active:cursor-grabbing z-30 flex flex-col items-center ${
                  draggingTarget === 'header' ? 'ring-1 ring-orange-500/50 rounded-lg py-1' : ''
                }`}
                title="Arraste os nomes para onde quiser"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="NOME DA PÁGINA"
                    className={`font-black text-xs uppercase tracking-tight text-center bg-transparent border-b border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded px-1 transition-all ${
                      templateBg === 'white' ? 'text-zinc-900' : 'text-white'
                    }`}
                  />

                  {/* Selo de Verificado Clicável */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHasVerified(!hasVerified)
                    }}
                    title={hasVerified ? 'Verificado ativo (clique para desligar)' : 'Sem selo (clique para ligar)'}
                    className="cursor-pointer hover:scale-125 transition-transform"
                  >
                    {hasVerified ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black">
                        ✓
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-dashed border-zinc-400 text-zinc-400 flex items-center justify-center text-[7px] opacity-40 hover:opacity-100">
                        +
                      </div>
                    )}
                  </button>
                </div>

                {/* @Handle */}
                <input
                  type="text"
                  value={brandHandle}
                  onChange={(e) => setBrandHandle(e.target.value)}
                  placeholder="@seucanal"
                  className={`text-[10px] font-mono text-center bg-transparent border-b border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded px-1 transition-all mt-0.5 ${
                    templateBg === 'white' ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                />
              </div>

              {/* 3. TÍTULO / GANCHO COM FONTE E TAMANHO APPLE (MÓVEL EM X E Y) */}
              <div
                onMouseDown={(e) => startDrag2D('title', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('title', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${titlePos.x}%`,
                  top: `${titlePos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute w-full px-5 cursor-grab active:cursor-grabbing z-30 ${
                  draggingTarget === 'title' ? 'ring-1 ring-orange-500/50 rounded-lg py-1' : ''
                }`}
                title="Arraste o título para onde quiser"
              >
                <textarea
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="É assim que o seu título vai aparecer no template..."
                  rows={3}
                  style={{
                    fontFamily: fontFamily,
                    fontSize: `${fontSize}px`,
                    textAlign: textAlign,
                  }}
                  className={`w-full font-bold bg-transparent border border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded-lg p-1 resize-none leading-snug transition-all ${
                    templateBg === 'white' ? 'text-zinc-900' : 'text-zinc-100'
                  }`}
                />
              </div>

              {/* 4. VÍDEO MÓVEL E REDIMENSIONÁVEL (COM BORDA ARREDONDADA OU QUADRADA) */}
              <div
                onMouseDown={(e) => startDrag2D('video', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('video', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${videoPos.x}%`,
                  top: `${videoPos.y}%`,
                  width: `${videoScale}%`,
                  transform: 'translate(-50%, -50%)',
                  aspectRatio: '1/1'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-20 group ${
                  draggingTarget === 'video' ? 'ring-2 ring-orange-500' : ''
                }`}
                title="Arraste o vídeo. Use o ponto no canto para redimensionar."
              >
                <div className={`relative w-full h-full overflow-hidden border-2 border-blue-500 bg-black ${
                  videoBorderRadius === 'rounded' ? 'rounded-2xl' : 'rounded-none'
                }`}>
                  <img
                    src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80"
                    alt="Vídeo"
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  {/* Âncora Central */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="px-2.5 py-1 rounded-full bg-blue-600/90 text-white text-[9px] font-bold font-mono flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Move className="w-3 h-3" />
                      Arraste o Vídeo
                    </div>
                  </div>

                  {/* Handle nos Cantos */}
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  
                  {/* Handle Interativo de Redimensionamento */}
                  <div
                    onMouseDown={(e) => startResizeVideo(e.clientX, e)}
                    className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-orange-500 border-2 border-white cursor-nwse-resize z-40 hover:scale-125 transition-transform"
                    title="Arraste para mudar o tamanho do vídeo"
                  />
                </div>
              </div>

              {/* 5. LEGENDA INDEPENDENTE: 'SUA LEGENDA APARECERÁ AQUI' */}
              <div
                onMouseDown={(e) => startDrag2D('subtitle', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('subtitle', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${subtitlePos.x}%`,
                  top: `${subtitlePos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-40 flex flex-col items-center select-none ${
                  draggingTarget === 'subtitle' ? 'scale-105 ring-2 ring-orange-500 rounded-lg' : ''
                }`}
                title="Arraste a legenda para qualquer lugar. Clique para trocar o estilo!"
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setSubtitleModalOpen(true)
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20 whitespace-nowrap"
                  style={{
                    backgroundColor: activeSub.bgColor || 'rgba(0,0,0,0.85)',
                    color: activeSub.textColor,
                    border: activeSub.borderColor ? `1px solid ${activeSub.borderColor}` : 'none',
                    boxShadow: activeSub.glow || 'none'
                  }}
                >
                  SUA LEGENDA APARECERÁ AQUI
                </div>
              </div>

              {/* HOME BAR DO IPHONE 16 PRO */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-zinc-400/40 rounded-full pointer-events-none" />

            </div>
          </div>
        </div>

      </div>

      {/* MODAL SUSPENSO DE ESTILOS DE LEGENDA */}
      {subtitleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Estilos de Legenda</h3>
                <p className="text-xs text-zinc-400">Escolha o preset visual para seus cortes.</p>
              </div>
              <button
                type="button"
                onClick={() => setSubtitleModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto p-1">
              {SUBTITLE_PRESETS.map(sub => {
                const isSel = selectedSubtitle === sub.id
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubtitle(sub.id)
                      setSubtitleModalOpen(false)
                    }}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center items-center ${
                      isSel
                        ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/40'
                        : 'border-white/[0.08] bg-[#1a1a1e] hover:border-white/20'
                    }`}
                  >
                    <div
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase truncate max-w-[130px]"
                      style={{
                        backgroundColor: sub.bgColor || 'transparent',
                        color: sub.textColor,
                        border: sub.borderColor ? `1px solid ${sub.borderColor}` : 'none',
                        boxShadow: sub.glow || 'none'
                      }}
                    >
                      {sub.name}
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-1 font-mono">
                      {sub.tag}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
