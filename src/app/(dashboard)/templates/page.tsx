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
  Maximize2,
  Crosshair,
  Magnet,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Music,
  Home,
  Search,
  ShoppingBag,
  User,
  Eye,
  EyeOff,
  Film
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
  { id: 'neon_magenta', name: 'Neon Magenta', tag: 'Hype', badgeColor: '#ec4899', textColor: '#f472b6', glow: '0 0 12px rgba(236,72,153,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'clean_white', name: 'Clean White', tag: 'Minimalista', badgeColor: '#ffffff', textColor: '#09090b', bgColor: '#ffffff', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'dark_box', name: 'Dark Box', tag: 'Contraste', badgeColor: '#27272a', textColor: '#f97316', bgColor: '#18181b', borderColor: '#3f3f46', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
]

const FONT_OPTIONS = [
  { id: 'sf_pro', name: 'SF Pro Display (Apple)', family: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'inter', name: 'Inter (Moderno)', family: 'Inter, sans-serif' },
  { id: 'montserrat', name: 'Montserrat (Viral)', family: 'Montserrat, sans-serif' },
  { id: 'impact', name: 'Impact / Anton (Forte)', family: 'Impact, sans-serif' },
  { id: 'outfit', name: 'Outfit (Geométrico)', family: 'Outfit, sans-serif' },
]

export default function TemplatesPage() {
  const supabase = createClient()

  // Cores de fundo do template
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'gray'>('white')
  const [videoBorderRadius, setVideoBorderRadius] = useState<'rounded' | 'square'>('rounded')

  // Posições Livres 2D (Eixos X e Y em porcentagem 0-100)
  const [avatarPos, setAvatarPos] = useState<{ x: number, y: number }>({ x: 50, y: 7 })
  const [headerPos, setHeaderPos] = useState<{ x: number, y: number }>({ x: 50, y: 17 })
  const [titlePos, setTitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 26 })
  const [videoPos, setVideoPos] = useState<{ x: number, y: number }>({ x: 50, y: 50 })
  const [subtitlePos, setSubtitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 84 })

  // Escala / Tamanho do Vídeo
  const [videoScale, setVideoScale] = useState(88) // % da largura da tela

  // Tipografia do Título (Padrão Apple)
  const [fontFamily, setFontFamily] = useState('system-ui, -apple-system, BlinkMacSystemFont, sans-serif')
  const [fontSize, setFontSize] = useState(13) // px
  const [textAlign, setTextAlign] = useState<'center' | 'left' | 'right'>('center')

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

  // NOVO: DECALQUE DO INSTAGRAM REELS (SAFE ZONES)
  // 'off' | 'semi' (40% de opacidade) | 'full' (100% de opacidade)
  const [instagramDecal, setInstagramDecal] = useState<boolean>(true)

  // NOVO: LINHAS GUIA E CENTRALIZAÇÃO MAGNÉTICA (SNAPPING)
  const [snapActiveX, setSnapActiveX] = useState(false)
  const [snapActiveY, setSnapActiveY] = useState(false)
  const [magneticSnapEnabled, setMagneticSnapEnabled] = useState(true)

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

  // Centralizar Tudo no Meio (1-Clique)
  const centerAllElementsHorizontally = () => {
    setAvatarPos(prev => ({ ...prev, x: 50 }))
    setHeaderPos(prev => ({ ...prev, x: 50 }))
    setTitlePos(prev => ({ ...prev, x: 50 }))
    setVideoPos(prev => ({ ...prev, x: 50 }))
    setSubtitlePos(prev => ({ ...prev, x: 50 }))
    setSnapActiveX(true)
    setTimeout(() => setSnapActiveX(false), 1200)
  }

  // Centralizar o Vídeo no Meio Vertical e Horizontal
  const centerVideoBoth = () => {
    setVideoPos({ x: 50, y: 50 })
    setSnapActiveX(true)
    setSnapActiveY(true)
    setTimeout(() => {
      setSnapActiveX(false)
      setSnapActiveY(false)
    }, 1200)
  }

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

  // Drag 2D com Snapping Magnético Inteligente (Guia Central X e Y)
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

      let nextX = Math.max(10, Math.min(90, Math.round(initialElemPos.current.x + deltaX)))
      let nextY = Math.max(2, Math.min(96, Math.round(initialElemPos.current.y + deltaY)))

      // SNAPPING MAGNÉTICO NO CENTRO HORIZONTAL (X = 50%)
      if (magneticSnapEnabled && Math.abs(nextX - 50) <= 2.5) {
        nextX = 50
        setSnapActiveX(true)
      } else {
        setSnapActiveX(false)
      }

      // SNAPPING NO CENTRO VERTICAL (Y = 50%)
      if (magneticSnapEnabled && Math.abs(nextY - 50) <= 2.5) {
        nextY = 50
        setSnapActiveY(true)
      } else {
        setSnapActiveY(false)
      }

      if (target === 'avatar') setAvatarPos({ x: nextX, y: nextY })
      else if (target === 'header') setHeaderPos({ x: nextX, y: nextY })
      else if (target === 'title') setTitlePos({ x: nextX, y: nextY })
      else if (target === 'video') setVideoPos({ x: nextX, y: nextY })
      else if (target === 'subtitle') setSubtitlePos({ x: nextX, y: nextY })
    }

    const onUp = () => {
      setDraggingTarget(null)
      setSnapActiveX(false)
      setSnapActiveY(false)
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
      let newScale = Math.max(50, Math.min(98, Math.round(initialScale.current + deltaPercent)))
      
      // Snap para larguras padrão (88% e 94%)
      if (Math.abs(newScale - 88) <= 1.5) newScale = 88
      if (Math.abs(newScale - 94) <= 1.5) newScale = 94

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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-white">Template</h1>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
            Edição Visual 9:16
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAvatarPos({ x: 50, y: 7 })
              setHeaderPos({ x: 50, y: 17 })
              setTitlePos({ x: 50, y: 26 })
              setVideoPos({ x: 50, y: 50 })
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
        <aside className="bg-[#141416]/90 border border-white/[0.1] backdrop-blur-2xl rounded-3xl p-3 shadow-2xl flex md:flex-col items-center gap-3.5 z-40">
          
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

          {/* NOVO: DECALQUE DO INSTAGRAM REELS (SAFE ZONE OVERLAY) */}
          <button
            type="button"
            onClick={() => setInstagramDecal(prev => !prev)}
            title={instagramDecal ? 'Decalque Instagram: Ligado (clique para Desligar)' : 'Decalque Instagram: Desligado (clique para Ligar)'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
              instagramDecal
                ? 'bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/30'
                : 'bg-white/[0.05] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Film className="w-4 h-4" />
            {instagramDecal && (
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
            )}
          </button>



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

          {/* CONTROLE INTEGRADO DE TIPOGRAFIA */}
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

        {/* TELA DO IPHONE 16 PRO (MICRO-BEZEL, COM LINHAS GUIAS E DECALQUE DO INSTAGRAM) */}
        <div className="relative flex flex-col items-center">
          
          {/* MOCKUP IPHONE 16 PRO */}
          <div className="relative w-[340px] h-[690px] bg-[#0c0c0e] rounded-[52px] p-2.5 border-[3px] border-[#27272a] ring-1 ring-white/10 flex flex-col overflow-hidden select-none">
            
            {/* DYNAMIC ISLAND DO IPHONE 16 PRO */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50 flex items-center justify-end px-2.5 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#141416] border border-white/[0.06]" />
            </div>

            {/* CANVAS 9:16 */}
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
              
              {/* LINHA GUIA MAGNÉTICA HORIZONTAL (CENTRO X: 50%) */}
              {snapActiveX && (
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] z-40 pointer-events-none animate-in fade-in duration-75 flex items-center justify-center">
                  <span className="bg-cyan-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow absolute top-8 whitespace-nowrap">
                    Centro X
                  </span>
                </div>
              )}

              {/* LINHA GUIA MAGNÉTICA VERTICAL (CENTRO Y: 50%) */}
              {snapActiveY && (
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] z-40 pointer-events-none animate-in fade-in duration-75 flex items-center justify-center">
                  <span className="bg-cyan-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow absolute left-4 whitespace-nowrap">
                    Centro Y
                  </span>
                </div>
              )}

              {/* 1. LOGO / AVATAR SOLTO 2D (MÓVEL EM X E Y) */}
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
                title="Arraste a foto para qualquer lugar (snaps no centro)"
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
                title="Arraste o título (snaps no centro)"
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

                  {/* Handles nos Cantos */}
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
                title="Arraste a legenda (snaps no centro). Clique para trocar o estilo!"
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

              {/* 6. DECALQUE OFICIAL DO INSTAGRAM REELS (DINÂMICO CONFORME COR DO FUNDO) */}
              {instagramDecal && (
                <div
                  className={`absolute inset-0 pointer-events-none z-45 transition-all duration-200 flex flex-col justify-between ${
                    templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                  }`}
                >
                  {/* Topo do Reels: Horário, Notch e 'Reels' Header */}
                  <div className="pt-2 px-4 flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono text-[11px] font-bold">9:41</span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span>5G</span>
                      <div className={`w-4 h-2 rounded-sm border p-0.5 flex items-center ${templateBg === 'white' ? 'border-zinc-900' : 'border-white'}`}>
                        <div className={`w-full h-full rounded-2xs ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 px-4 flex items-center justify-between">
                    <span className="text-sm font-black tracking-tight">Reels</span>
                    <Camera className="w-5 h-5" />
                  </div>

                  {/* Meio: Área Segura Pontilhada Discreta (Sem texto que atrapalhe) */}
                  <div className={`flex-1 mx-3 my-2 border border-dashed rounded-2xl pointer-events-none ${
                    templateBg === 'white' ? 'border-zinc-900/20' : 'border-white/20'
                  }`} />

                  {/* Coluna Lateral Direita: Like, Comentário, Enviar, Opções, Áudio */}
                  <div className="absolute right-3 bottom-20 flex flex-col items-center gap-3.5">
                    {/* Like */}
                    <div className="flex flex-col items-center">
                      <Heart className="w-6 h-6" />
                      <span className="text-[10px] font-bold mt-0.5">107,1 K</span>
                    </div>

                    {/* Comentário */}
                    <div className="flex flex-col items-center">
                      <MessageCircle className="w-6 h-6" />
                      <span className="text-[10px] font-bold mt-0.5">1.842</span>
                    </div>

                    {/* Compartilhar */}
                    <div className="flex flex-col items-center">
                      <Send className="w-5 h-5" />
                      <span className="text-[10px] font-bold mt-0.5">Share</span>
                    </div>

                    {/* Mais Opções */}
                    <MoreHorizontal className="w-5 h-5" />

                    {/* Disco de Áudio */}
                    <div className={`w-7 h-7 rounded-lg border-2 overflow-hidden flex items-center justify-center mt-1 ${
                      templateBg === 'white' ? 'border-zinc-900 bg-zinc-100 text-zinc-900' : 'border-white/80 bg-zinc-900 text-white'
                    }`}>
                      <Music className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  </div>

                  {/* Rodapé do Instagram: Perfil, Legenda e Áudio */}
                  <div className="pb-12 pl-4 pr-16 space-y-1.5">
                    {/* Perfil e Botão Seguir */}
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full border overflow-hidden ${
                        templateBg === 'white' ? 'border-zinc-900/30 bg-zinc-200' : 'border-white/40 bg-white/20'
                      }`}>
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-bold">{brandHandle}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        templateBg === 'white'
                          ? 'border-zinc-900/40 bg-zinc-900/10 text-zinc-900'
                          : 'border-white/60 bg-white/10 text-white'
                      }`}>
                        Seguir
                      </span>
                    </div>

                    {/* Descrição do Post */}
                    <p className={`text-[11px] leading-tight line-clamp-2 font-medium ${
                      templateBg === 'white' ? 'text-zinc-800' : 'text-white/90'
                    }`}>
                      É assim que o seu vídeo e legenda são vistos no feed do Instagram Reels 🔥 #viral #cortes
                    </p>

                    {/* Tag de Áudio Original */}
                    <div className={`flex items-center gap-1.5 text-[10px] font-medium ${
                      templateBg === 'white' ? 'text-zinc-600' : 'text-white/80'
                    }`}>
                      <Music className="w-3 h-3" />
                      <span>Áudio original • {brandHandle}</span>
                    </div>
                  </div>

                  {/* Barra de Navegação Inferior do Instagram */}
                  <div className={`h-10 backdrop-blur-md border-t flex items-center justify-around px-4 ${
                    templateBg === 'white'
                      ? 'bg-white/95 text-zinc-900 border-zinc-200/80 shadow-md'
                      : 'bg-black/85 text-white border-white/10'
                  }`}>
                    <Home className="w-5 h-5 opacity-90" />
                    <Search className="w-5 h-5 opacity-90" />
                    <div className="w-5 h-5 flex items-center justify-center">
                      <Film className="w-5 h-5" />
                    </div>
                    <ShoppingBag className="w-5 h-5 opacity-90" />
                    <div className={`w-5 h-5 rounded-full border overflow-hidden ${
                      templateBg === 'white' ? 'border-zinc-900' : 'border-white'
                    }`}>
                      <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              )}

              {/* HOME BAR DO IPHONE 16 PRO */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-zinc-400/40 rounded-full pointer-events-none z-50" />

            </div>
          </div>

          {/* BARRA DE CONTROLE LIMPA */}
          <div className="mt-4 flex items-center gap-3 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => setInstagramDecal(prev => !prev)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Film className="w-3.5 h-3.5 text-pink-400" />
              <span>Decalque Instagram: </span>
              <strong className={`font-mono ${instagramDecal ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {instagramDecal ? 'LIGADO' : 'DESLIGADO'}
              </strong>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DE ESTILOS DE LEGENDA */}
      {subtitleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white">Estilos de Legenda</h3>
                <p className="text-xs text-zinc-400">Escolha o preset que será aplicado no corte.</p>
              </div>
              <button
                type="button"
                onClick={() => setSubtitleModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
              {SUBTITLE_PRESETS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubtitle(st.id)
                    setSubtitleModalOpen(false)
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedSubtitle === st.id
                      ? 'bg-orange-500/20 border-orange-500 ring-1 ring-orange-500/40'
                      : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-white">{st.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.08] text-zinc-300">
                      {st.tag}
                    </span>
                  </div>
                  <div
                    className="w-full py-2 px-1 rounded-lg text-[10px] font-black uppercase text-center truncate border border-white/10"
                    style={{
                      backgroundColor: st.bgColor || 'rgba(0,0,0,0.85)',
                      color: st.textColor,
                      boxShadow: st.glow || 'none'
                    }}
                  >
                    EXEMPLO VIRAL
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
