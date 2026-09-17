'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  Sparkles,
  Check,
  Upload,
  Layers,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Music,
  Camera,
  Home,
  Search,
  ShoppingBag,
  Film,
  Maximize2,
  Minimize2,
  Sliders,
  Palette,
  Crosshair,
  User,
  LayoutTemplate,
  ShieldCheck,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Save,
  HelpCircle,
  Move
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
  { id: 'hormozi_yellow', name: 'Hormozi Amarelo', tag: 'Mais Viral', badgeColor: '#facc15', textColor: '#000000', bgColor: '#facc15', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'hormozi_orange', name: 'Hormozi Laranja', tag: 'Alto CTR', badgeColor: '#ea580c', textColor: '#ffffff', bgColor: '#ea580c', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'clean_white', name: 'Clean White', tag: 'Minimalista', badgeColor: '#ffffff', textColor: '#09090b', bgColor: '#ffffff', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'dark_box', name: 'Dark Box', tag: 'Contraste', badgeColor: '#27272a', textColor: '#f97316', bgColor: '#18181b', borderColor: '#3f3f46', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'neon_cyan', name: 'Neon Cyan', tag: 'Tech', badgeColor: '#06b6d4', textColor: '#22d3ee', glow: '0 0 12px rgba(6,182,212,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
  { id: 'neon_magenta', name: 'Neon Magenta', tag: 'Hype', badgeColor: '#ec4899', textColor: '#f472b6', glow: '0 0 12px rgba(236,72,153,0.8)', sampleText: 'SUA LEGENDA APARECERÁ AQUI' },
]

const FONT_OPTIONS = [
  { id: 'instagram_sans', name: 'Instagram Sans (Nativa)', family: "'Instagram Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif" },
  { id: 'sf_pro_rounded', name: 'SF Pro Rounded (iOS Meme)', family: "'SF Pro Rounded', system-ui, -apple-system, sans-serif" },
  { id: 'sf_pro_bold', name: 'SF Pro Bold (Apple)', family: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" },
  { id: 'anton_impact', name: 'Anton / Impact (Meme Forte)', family: "Impact, 'Anton', sans-serif" },
  { id: 'montserrat', name: 'Montserrat (Viral)', family: "Montserrat, sans-serif" },
]

// Modelo Único Padrão
const TEMPLATE_PRESETS = [
  {
    id: 'corte_padrao',
    name: 'CORTE PADRÃO',
    bg: 'dark',
    brandName: 'HUMOR DA IGUANA',
    brandHandle: '@humordaiguana',
    title: 'É assim que o seu título vai aparecer no vídeo 🔥',
    font: "-apple-system, BlinkMacSystemFont, 'Apple Color Emoji', 'SF Pro Display', 'SF Pro Text', sans-serif",
    fontSize: 14,
    subtitle: 'hormozi_yellow',
    avatarPos: { x: 50, y: 8 },
    headerPos: { x: 50, y: 16 },
    titlePos: { x: 50, y: 24 },
    videoPos: { x: 50, y: 52 },
    subtitlePos: { x: 50, y: 74 },
    videoWidth: 92,
    videoHeight: 48,
  }
]
type ActiveTool = 'templates' | 'text' | 'brand' | 'subtitles' | 'safezone' | 'background' | null

// Renderizador Oficial de Emojis Nativos Apple iOS (Emojipedia / Apple Assets)
function AppleEmojiText({ text, className }: { text: string; className?: string }) {
  if (!text) return null
  const emojiRegex = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u
  const parts = text.split(emojiRegex)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (emojiRegex.test(part)) {
          const codePoints = Array.from(part)
            .map(c => c.codePointAt(0)!.toString(16))
            .filter(c => c !== 'fe0f')
          const hex = codePoints.join('-').toLowerCase()
          return (
            <img
              key={i}
              src={`https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${hex}.png`}
              alt={part}
              className="inline-block w-[1.15em] h-[1.15em] align-[-0.18em] mx-[1px] select-none pointer-events-none"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none'
              }}
            />
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

export default function TemplatesPage() {
  const supabase = createClient()

  // Canva-Style Active Side Panel
  const [activeTool, setActiveTool] = useState<ActiveTool>('templates')

  // Cores de fundo do template
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'gray' | 'obsidian' | 'midnight'>('dark')
  const [customBgImage, setCustomBgImage] = useState<string | null>(null)

  // Posições Livres 2D (Eixos X e Y em porcentagem 0-100)
  const [avatarPos, setAvatarPos] = useState<{ x: number, y: number }>({ x: 50, y: 8 })
  const [headerPos, setHeaderPos] = useState<{ x: number, y: number }>({ x: 50, y: 16 })
  const [titlePos, setTitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 24 })
  const [videoPos, setVideoPos] = useState<{ x: number, y: number }>({ x: 50, y: 52 })
  const [subtitlePos, setSubtitlePos] = useState<{ x: number, y: number }>({ x: 50, y: 75 })

  // Dimensões livres do vídeo (Largura e Altura em % do canvas)
  const [videoWidth, setVideoWidth] = useState(92)
  const [videoHeight, setVideoHeight] = useState(48)

  // Conteúdo textual e identidade
  const [brandName, setBrandName] = useState('HUMOR DA IGUANA')
  const [brandHandle, setBrandHandle] = useState('@humordaiguana')
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')
  const [titleText, setTitleText] = useState('É assim que o seu título vai aparecer no vídeo')

  // Tipografia
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].family)
  const [fontSize, setFontSize] = useState(14)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')
  const [titleColor, setTitleColor] = useState<string>('auto') // 'auto' | '#ffffff' | '#000000' | '#f59e0b'

  // Presets de Legenda
  const [selectedSubtitle, setSelectedSubtitle] = useState('hormozi_yellow')

  // DECALQUE REELS SAFE ZONE (MÁSCARA TRANSLÚCIDA 1080x1440 COM ZONAS MORTAS 420px)
  const [instagramDecal, setInstagramDecal] = useState<boolean>(true)

  // Zoom do Canvas (Estilo Canva: 75%, 90%, 100%, 110%)
  const [canvasZoom, setCanvasZoom] = useState(100)

  // Feedback e Salvamento
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [draggingTarget, setDraggingTarget] = useState<'avatar' | 'header' | 'title' | 'video' | 'subtitle' | null>(null)
  const [isResizingVideo, setIsResizingVideo] = useState(false)

  // Snapping Magnético inteligente
  const [snapActiveX, setSnapActiveX] = useState(false)
  const [snapActiveY, setSnapActiveY] = useState(false)

  const phoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const initialElemPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const totalDragMovement = useRef(0)

  // Carregar template salvo
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
          if (c.brandName) setBrandName(c.brandName)
          if (c.brandHandle) setBrandHandle(c.brandHandle)
          if (c.titleText) setTitleText(c.titleText)
          if (c.fontFamily) setFontFamily(c.fontFamily)
          if (c.fontSize) setFontSize(c.fontSize)
          if (c.textAlign) setTextAlign(c.textAlign)
          if (c.videoWidth) setVideoWidth(c.videoWidth)
          if (c.videoHeight) setVideoHeight(c.videoHeight)
          if (c.avatarPos) setAvatarPos(c.avatarPos)
          if (c.headerPos) setHeaderPos(c.headerPos)
          if (c.titlePos) setTitlePos(c.titlePos)
          if (c.videoPos) setVideoPos(c.videoPos)
          if (c.subtitlePos) setSubtitlePos(c.subtitlePos)
        }
      }
    } catch {}

    async function fetchRemoteTemplate() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
        if (bk) {
          if (bk.avatar_url) setAvatarUrl(bk.avatar_url)
          if (bk.username) setBrandHandle(bk.username)
          if (bk.layout_config) {
            const cfg = bk.layout_config
            if (cfg.brandName) setBrandName(cfg.brandName)
            if (cfg.templateBg) setTemplateBg(cfg.templateBg)
            if (cfg.fontFamily) setFontFamily(cfg.fontFamily)
            if (cfg.fontSize) setFontSize(cfg.fontSize)
            if (cfg.subtitle_preset) setSelectedSubtitle(cfg.subtitle_preset)
          }
        }
      } catch {}
    }
    fetchRemoteTemplate()
  }, [])

  // Auto-Save no localStorage
  useEffect(() => {
    const templateData = {
      layout: 'meme_frame',
      subtitle_preset: selectedSubtitle,
      avatar_url: avatarUrl,
      template_bg: templateBg,
      config: {
        templateBg,
        avatarPos,
        headerPos,
        titlePos,
        videoPos,
        subtitlePos,
        videoWidth,
        videoHeight,
        brandName,
        brandHandle,
        titleText,
        fontFamily,
        fontSize,
        textAlign,
        videoScale: videoWidth,
      }
    }
    localStorage.setItem('clippost_active_template', JSON.stringify(templateData))
  }, [
    templateBg,
    avatarPos,
    headerPos,
    titlePos,
    videoPos,
    subtitlePos,
    videoWidth,
    videoHeight,
    brandName,
    brandHandle,
    titleText,
    fontFamily,
    fontSize,
    textAlign,
    selectedSubtitle,
    avatarUrl
  ])

  // Aplicar Preset de 1-Clique
  const applyPreset = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setTemplateBg(preset.bg as any)
    setBrandName(preset.brandName)
    setBrandHandle(preset.brandHandle)
    setTitleText(preset.title)
    setFontFamily(preset.font)
    setFontSize(preset.fontSize)
    setSelectedSubtitle(preset.subtitle)
    setAvatarPos(preset.avatarPos)
    setHeaderPos(preset.headerPos)
    setTitlePos(preset.titlePos)
    setVideoPos(preset.videoPos)
    setSubtitlePos(preset.subtitlePos)
    setVideoWidth(preset.videoWidth)
    setVideoHeight(preset.videoHeight)
  }

  // Auto-Enquadramento dos Elementos na Safe Zone Reels (1080x1440)
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomBgImage(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const autoAlignSafeZone = () => {
    setAvatarPos({ x: 50, y: 8 })
    setHeaderPos({ x: 50, y: 16 })
    setTitlePos({ x: 50, y: 24 })
    setVideoPos({ x: 50, y: 52 })
    setSubtitlePos({ x: 50, y: 75 })
    setVideoWidth(92)
    setVideoHeight(48)
    setSnapActiveX(true)
    setTimeout(() => setSnapActiveX(false), 1000)
  }

  // Drag 2D Inteligente com Snapping Magnético no Centro (X = 50%)
  const startDrag2D = (target: 'avatar' | 'header' | 'title' | 'video' | 'subtitle', clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setDraggingTarget(target)
    dragStartPos.current = { x: clientX, y: clientY }
    totalDragMovement.current = 0

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
      totalDragMovement.current += Math.abs(deltaX) + Math.abs(deltaY)

      let nextX = Math.max(10, Math.min(90, Math.round(initialElemPos.current.x + deltaX)))
      let nextY = Math.max(2, Math.min(96, Math.round(initialElemPos.current.y + deltaY)))

      // Snapping no Centro Horizontal (X = 50%)
      if (Math.abs(nextX - 50) <= 2.5) {
        nextX = 50
        setSnapActiveX(true)
      } else {
        setSnapActiveX(false)
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

  // Redimensionamento Proporcional pelos 4 Cantos (Canva/Apple Standard - Zero Distorção)
  const startResizeVideo = (
    corner: 'tl' | 'tr' | 'bl' | 'br',
    clientX: number,
    clientY: number,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    const startX = clientX
    const startY = clientY
    const initW = videoWidth
    const initH = videoHeight
    const aspectRatio = initW / (initH || 1)

    const onResizeMove = (ev: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const curY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY

      const deltaX = curX - startX
      const deltaY = curY - startY

      // Cálculo intuitivo para qualquer um dos 4 cantos:
      // br (inferior direito): arrastar para fora (baixo/direita) aumenta
      // bl (inferior esquerdo): arrastar para fora (baixo/esquerda) aumenta
      // tr (superior direito): arrastar para fora (cima/direita) aumenta
      // tl (superior esquerdo): arrastar para fora (cima/esquerda) aumenta
      let delta = 0
      if (corner === 'br') delta = (deltaX + deltaY) / 2
      else if (corner === 'bl') delta = (-deltaX + deltaY) / 2
      else if (corner === 'tr') delta = (deltaX - deltaY) / 2
      else if (corner === 'tl') delta = (-deltaX - deltaY) / 2

      // Fator de proporção suave (100px = +50% tamanho)
      const factor = 1 + (delta / 180)
      const newW = Math.max(35, Math.min(98, Math.round(initW * factor)))
      const newH = Math.max(18, Math.min(75, Math.round(newW / aspectRatio)))

      setVideoWidth(newW)
      setVideoHeight(newH)
    }

    const onResizeUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
      window.removeEventListener('touchmove', onResizeMove)
      window.removeEventListener('touchend', onResizeUp)
    }

    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeUp)
    window.addEventListener('touchmove', onResizeMove)
    window.addEventListener('touchend', onResizeUp)
  }

  // Salvar no Banco
    // Redimensionamento Vertical Superior (Puxar a linha de cima no meio para mudar a proporção vertical)
  const startResizeTop = (clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    const startY = clientY
    const initH = videoHeight

    const onTopMove = (ev: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
      const h = phoneRef.current.clientHeight
      // Puxar para cima (curY < startY) aumenta a altura e altera a proporção do vídeo
      const deltaY = startY - curY
      const deltaH = (deltaY / h) * 100
      const newH = Math.max(15, Math.min(85, Math.round(initH + deltaH)))
      setVideoHeight(newH)
    }

    const onTopUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onTopMove)
      window.removeEventListener('mouseup', onTopUp)
      window.removeEventListener('touchmove', onTopMove)
      window.removeEventListener('touchend', onTopUp)
    }

    window.addEventListener('mousemove', onTopMove)
    window.addEventListener('mouseup', onTopUp)
    window.addEventListener('touchmove', onTopMove)
    window.addEventListener('touchend', onTopUp)
  }

    // Redimensionamento Vertical Inferior
  const startResizeBottom = (clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    const startY = clientY
    const initH = videoHeight

    const onBottomMove = (ev: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
      const h = phoneRef.current.clientHeight
      const deltaY = curY - startY
      const deltaH = (deltaY / h) * 100
      const newH = Math.max(15, Math.min(85, Math.round(initH + deltaH)))
      setVideoHeight(newH)
    }

    const onBottomUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onBottomMove)
      window.removeEventListener('mouseup', onBottomUp)
      window.removeEventListener('touchmove', onBottomMove)
      window.removeEventListener('touchend', onBottomUp)
    }

    window.addEventListener('mousemove', onBottomMove)
    window.addEventListener('mouseup', onBottomUp)
    window.addEventListener('touchmove', onBottomMove)
    window.addEventListener('touchend', onBottomUp)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('brand_kits').upsert({
          user_id: user.id,
          avatar_url: avatarUrl,
          username: brandHandle,
          layout_config: {
            brandName,
            templateBg,
            subtitle_preset: selectedSubtitle,
            fontFamily,
            fontSize,
            textAlign,
            videoWidth,
            videoHeight,
            avatarPos,
            headerPos,
            titlePos,
            videoPos,
            subtitlePos,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch {
      // salvo no localStorage
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  // Upload de Foto
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarUrl(url)
    }
  }

  const activeSub = SUBTITLE_PRESETS.find(s => s.id === selectedSubtitle) || SUBTITLE_PRESETS[0]
  const isLight = templateBg === 'white'

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col select-none overflow-hidden">
      
      {/* 1. TOP BAR PADRÃO CANVA (HEADER COM TÍTULO, AUTO-SAVE E AÇÕES) */}
      <header className="h-14 bg-[#0e0e11] border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4 text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Editor de Template • Reels 9:16</span>
              </h1>
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" /> Salvo automaticamente
              </span>
            </div>
          </div>
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={autoAlignSafeZone}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Alinhar automaticamente todos os elementos na Área Segura"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Enquadrar na Safe Zone</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{savedSuccess ? 'Template Salvo!' : 'Salvar'}</span>
          </button>
        </div>
      </header>

      {/* 2. CORPO PRINCIPAL (CANVA WORKSPACE: BARRA LATERAL + PAINEL EXPANSÍVEL + ÁREA DO CANVAS) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* BARRA DE FERRAMENTAS LATERAL (CANVA SIDEBAR) */}
        <aside className="w-16 sm:w-[72px] bg-[#0e0e11] border-r border-white/[0.08] flex flex-col items-center py-3 gap-1 z-20 shrink-0 select-none">
          
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'templates' ? null : 'templates')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'templates'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <LayoutTemplate className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Modelos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'text'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Type className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Texto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'brand' ? null : 'brand')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'brand'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'subtitles' ? null : 'subtitles')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'subtitles'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Legenda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'safezone' ? null : 'safezone')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
              activeTool === 'safezone'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Safe Zone</span>
            {instagramDecal && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'background' ? null : 'background')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'background'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Palette className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Fundo</span>
          </button>

        </aside>

        {/* PAINEL EXPANSÍVEL LATERAL DO CANVA (DRAWER 280px - SEM COBRIR O CANVAS) */}
        {activeTool && (
          <div className="w-72 sm:w-80 bg-[#121215] border-r border-white/[0.08] p-4 flex flex-col gap-4 z-10 shrink-0 animate-in slide-in-from-left-4 duration-200 overflow-y-auto">
            
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                {activeTool === 'templates' && 'Modelos de 1-Clique'}
                {activeTool === 'text' && 'Tipografia & Ganchos'}
                {activeTool === 'brand' && 'Foto & Identidade'}
                {activeTool === 'subtitles' && 'Estilos de Legenda'}
                {activeTool === 'safezone' && 'Decalque Safe Zone Reels'}
                {activeTool === 'background' && 'Cor de Fundo do Template'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ABA 1: MODELOS PRONTOS */}
            {activeTool === 'templates' && (
              <div className="space-y-2">
                {TEMPLATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#6366f1]/40 transition-all text-left flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
                      <span className="text-xs font-bold text-white tracking-wide">{preset.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded border border-[#6366f1]/20">
                      Ativo
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ABA 2: TIPOGRAFIA */}
            {activeTool === 'text' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Fonte do Título (Nativas Instagram):</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-[#6366f1] cursor-pointer"
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.id} value={f.family} className="bg-zinc-900 text-white">
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 font-medium">Tamanho da Fonte:</label>
                    <span className="font-mono text-white font-bold">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={11}
                    max={22}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Alinhamento:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'left', icon: AlignLeft, label: 'Esquerda' },
                      { id: 'center', icon: AlignCenter, label: 'Centro' },
                      { id: 'right', icon: AlignRight, label: 'Direita' },
                    ].map(a => {
                      const Icon = a.icon
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setTextAlign(a.id as any)}
                          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            textAlign === a.id
                              ? 'bg-[#6366f1]/20 text-[#6366f1] border-[#6366f1]/40'
                              : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                  <label className="text-zinc-400 font-medium">Texto do Título:</label>
                  <textarea
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    rows={3}
                    placeholder="É assim que o seu título vai aparecer no vídeo"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-[#6366f1]/50 resize-none text-xs leading-relaxed"
                  />
                </div></div>
            )}

            {/* ABA 3: PERFIL E AVATAR */}
            {activeTool === 'brand' && (
              <div className="space-y-4 text-xs">
                <div className="flex flex-col items-center gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                  <div className="w-14 h-14 rounded-full border-2 border-[#6366f1]/50 overflow-hidden shadow-md">
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFile}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Upload className="w-3 h-3" /> Trocar Foto
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Nome da Página / Canal:</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-[#6366f1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Arroba (@):</label>
                  <input
                    type="text"
                    value={brandHandle}
                    onChange={(e) => setBrandHandle(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-[#6366f1] font-mono"
                  />
                </div>
              </div>
            )}

            {/* ABA 4: LEGENDAS */}
            {activeTool === 'subtitles' && (
              <div className="space-y-3 text-xs">
                <p className="text-zinc-400">Escolha o estilo das palavras faladas no corte:</p>
                <div className="space-y-2">
                  {SUBTITLE_PRESETS.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubtitle(sub.id)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedSubtitle === sub.id
                          ? 'bg-white/10 border-[#6366f1]/50 shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div>
                        <strong className="text-xs text-white block">{sub.name}</strong>
                        <span className="text-[10px] text-zinc-400">{sub.tag}</span>
                      </div>
                      <div
                        style={{
                          backgroundColor: sub.bgColor || '#18181b',
                          color: sub.textColor,
                          border: sub.borderColor ? `1px solid ${sub.borderColor}` : 'none'
                        }}
                        className="px-2 py-0.5 rounded text-[9px] font-black uppercase"
                      >
                        LEGENDA
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 5: SAFE ZONE REELS */}
            {activeTool === 'safezone' && (
              <div className="space-y-4 text-xs leading-relaxed">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Decalque Safe Zone:</span>
                    <button
                      type="button"
                      onClick={() => setInstagramDecal(!instagramDecal)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        instagramDecal
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                          : 'bg-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {instagramDecal ? 'LIGADO' : 'DESLIGADO'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Exibe a região inferior sombreada para evitar que a legenda fique escondida pela interface do Reels.
                  </p>
                </div>
              </div>
            )}

            {/* ABA 6: COR DE FUNDO & UPLOAD PERSONALIZADO */}
            {activeTool === 'background' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <span className="text-zinc-400 font-medium">Cor da Tela do Template:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark', label: 'Preto Puro', bg: 'bg-black text-white border-white/20' },
                      { id: 'white', label: 'Branco Neve', bg: 'bg-white text-zinc-900 border-zinc-300' },
                      { id: 'gray', label: 'Grafite', bg: 'bg-zinc-800 text-white border-white/20' }
                    ].map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setTemplateBg(b.id as any)
                          setCustomBgImage(null)
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${b.bg} ${
                          templateBg === b.id && !customBgImage ? 'ring-2 ring-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.35)] scale-105' : 'opacity-70 hover:opacity-100 border-white/10'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center">
                          {templateBg === b.id && !customBgImage && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-[11px] font-semibold">{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload de Fundo Personalizado */}
                <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                  <span className="text-zinc-400 font-medium">Fundo Personalizável (Upload):</span>
                  
                  {customBgImage ? (
                    <div className="space-y-2">
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-[#6366f1]/40 shadow-inner">
                        <img src={customBgImage} alt="Fundo Personalizado" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded">Fundo Ativo</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <label className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white font-medium text-center cursor-pointer transition-colors text-xs flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Trocar Imagem</span>
                          <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={() => setCustomBgImage(null)}
                          className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium text-xs cursor-pointer transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-white/20 hover:border-[#6366f1]/50 bg-black/30 hover:bg-white/[0.02] cursor-pointer transition-all">
                      <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-[#6366f1]/20 flex items-center justify-center text-[#6366f1]">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-white text-xs">Fazer Upload de Imagem de Fundo</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">PNG, JPG ou WebP (proporção 9:16 recomendada)</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÁREA CENTRAL DO WORKSPACE (CANVA CANVAS COM ZOOM E ESPAÇO LIVRE) */}
        <main className="flex-1 bg-[#090b0e] overflow-auto flex flex-col items-center justify-center p-4 sm:p-8 relative">
          
          {/* MOCKUP DO CANVA ARTBOARD (9:16 COM ELEVAÇÃO E PROPORÇÕES PERFEITAS) */}
          <div
            style={{
              transform: `scale(${canvasZoom / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out'
            }}
            className="relative w-[310px] sm:w-[340px] aspect-[9/16] bg-black rounded-[48px] p-2 shadow-[0_25px_70px_rgba(0,0,0,0.95)] shrink-0 overflow-hidden ring-1 ring-white/10"
          >
            {/* CANVAS INTERNO DO TEMPLATE */}
            <div
              ref={phoneRef}
              className={`relative w-full h-full rounded-[38px] overflow-hidden transition-colors ${
                templateBg === 'white'
                  ? 'bg-white text-zinc-950'
                  : templateBg === 'gray'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-black text-white'
              }`}
            >
              
              {/* LINHA GUIA MAGNÉTICA HORIZONTAL (CENTRO X: 50%) */}
              {snapActiveX && (
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] z-50 pointer-events-none flex items-center justify-center">
                  <span className="bg-cyan-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow absolute top-8">
                    Centro X 50%
                  </span>
                </div>
              )}

              {/* 1. AVATAR MÓVEL (EIXOS X E Y) */}
              <div
                onMouseDown={(e) => startDrag2D('avatar', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('avatar', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${avatarPos.x}%`,
                  top: `${avatarPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-30 ${
                  draggingTarget === 'avatar' ? 'ring-2 ring-[#6366f1] rounded-full scale-105' : ''
                }`}
                title="Arraste o avatar para posicionar livremente"
              >
                <div className="w-12 h-12 rounded-full border-2 border-white/60 overflow-hidden shadow-lg bg-zinc-900">
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover pointer-events-none" />
                </div>
              </div>

              {/* 2. NOME DO CANAL E ARROBA (MÓVEL) */}
              <div
                onMouseDown={(e) => startDrag2D('header', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('header', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${headerPos.x}%`,
                  top: `${headerPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-30 flex flex-col items-center select-none ${
                  draggingTarget === 'header' ? 'ring-1 ring-[#6366f1]/50 rounded-lg p-1' : ''
                }`}
                title="Arraste o nome e arroba para reposicionar"
              >
                <div className="flex items-center gap-1">
                  <span className={`text-[12px] font-black uppercase tracking-wide ${
                    templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                  }`}>
                    {brandName}
                  </span>
                  <span className="w-3 h-3 rounded-full bg-blue-500 text-white text-[8px] flex items-center justify-center font-bold">
                    ✓
                  </span>
                </div>
                <span className={`text-[10px] font-medium font-mono ${
                  templateBg === 'white' ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  {brandHandle}
                </span>
              </div>

              {/* 3. TÍTULO / GANCHO COM FONTE E TAMANHO NATIVOS (MÓVEL) */}
              <div
                onMouseDown={(e) => startDrag2D('title', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('title', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${titlePos.x}%`,
                  top: `${titlePos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute w-full px-5 cursor-grab active:cursor-grabbing z-30 select-none ${
                  draggingTarget === 'title' ? 'ring-1 ring-[#6366f1]/50 rounded-lg py-1' : ''
                }`}
                title="Arraste o título para reposicionar"
              >
                <h2
                  style={{
                    fontFamily: fontFamily,
                    fontSize: `${fontSize}px`,
                    textAlign: textAlign,
                  }}
                  className={`w-full font-bold leading-snug uppercase tracking-tight ${
                    templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                  }`}
                >
                  {titleText}
                </h2>
              </div>

              {/* 4. VÍDEO RETANGULAR/QUADRADO COM REDIMENSIONAMENTO LIVRE 2D (CANVA STYLE) */}
              <div
                onMouseDown={(e) => startDrag2D('video', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('video', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${videoPos.x}%`,
                  top: `${videoPos.y}%`,
                  width: `${videoWidth}%`,
                  height: `${videoHeight}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-20 group select-none shadow-2xl ${
                  draggingTarget === 'video' ? 'ring-2 ring-[#6366f1]' : ''
                }`}
                title="Arraste para mover. Use as alças para ajustar largura e altura livremente."
              >
                <div className="w-full h-full overflow-hidden bg-black flex items-center justify-center relative border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80"
                    alt="Preview"
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                  <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                </div>

                {/* ALÇA NA LINHA DE CIMA NO MEIO: PUXAR PARA CIMA AUMENTA A ALTURA E ALTERA A PROPORÇÃO */}
                <div
                  onMouseDown={(e) => startResizeTop(e.clientY, e)}
                  onTouchStart={(e) => startResizeTop(e.touches[0].clientY, e)}
                  title="Puxar para cima para aumentar a altura do vídeo (altera a proporção)"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-3.5 rounded-full bg-white border border-zinc-500 shadow-xl cursor-ns-resize z-40 hover:scale-110 flex items-center justify-center transition-all group"
                >
                  <div className="w-6 h-1 bg-zinc-700 rounded-full group-hover:bg-black" />
                </div>

                {/* ALÇA NA LINHA DE BAIXO NO MEIO: PUXAR PARA BAIXO AUMENTA A ALTURA */}
                <div
                  onMouseDown={(e) => startResizeBottom(e.clientY, e)}
                  onTouchStart={(e) => startResizeBottom(e.touches[0].clientY, e)}
                  title="Puxar para baixo para ajustar a altura"
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-3.5 rounded-full bg-white border border-zinc-500 shadow-xl cursor-ns-resize z-40 hover:scale-110 flex items-center justify-center transition-all group"
                >
                  <div className="w-6 h-1 bg-zinc-700 rounded-full group-hover:bg-black" />
                </div>

                {/* 4 Cantos para Escala Proporcional Suave */}
                <div
                  onMouseDown={(e) => startResizeVideo('tl', e.clientX, e.clientY, e)}
                  onTouchStart={(e) => startResizeVideo('tl', e.touches[0].clientX, e.touches[0].clientY, e)}
                  title="Redimensionar Canto Superior Esquerdo"
                  className="absolute -top-2.5 -left-2.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                />

                <div
                  onMouseDown={(e) => startResizeVideo('tr', e.clientX, e.clientY, e)}
                  onTouchStart={(e) => startResizeVideo('tr', e.touches[0].clientX, e.touches[0].clientY, e)}
                  title="Redimensionar Canto Superior Direito"
                  className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                />

                <div
                  onMouseDown={(e) => startResizeVideo('bl', e.clientX, e.clientY, e)}
                  onTouchStart={(e) => startResizeVideo('bl', e.touches[0].clientX, e.touches[0].clientY, e)}
                  title="Redimensionar Canto Inferior Esquerdo"
                  className="absolute -bottom-2.5 -left-2.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                />

                <div
                  onMouseDown={(e) => startResizeVideo('br', e.clientX, e.clientY, e)}
                  onTouchStart={(e) => startResizeVideo('br', e.touches[0].clientX, e.touches[0].clientY, e)}
                  title="Redimensionar Canto Inferior Direito"
                  className="absolute -bottom-2.5 -right-2.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                />
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
                  draggingTarget === 'subtitle' ? 'scale-105 ring-2 ring-[#6366f1] rounded-lg' : ''
                }`}
                title="Arraste a legenda para posicionar"
              >
                <div
                  style={{
                    backgroundColor: activeSub.bgColor || 'rgba(0,0,0,0.85)',
                    color: activeSub.textColor,
                    border: activeSub.borderColor ? `1px solid ${activeSub.borderColor}` : 'none',
                    boxShadow: activeSub.glow || 'none'
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight shadow-md border border-white/20 whitespace-nowrap"
                >
                  SUA LEGENDA APARECERÁ AQUI
                </div>
              </div>

              {/* 6. DECALQUE SAFE ZONE: PARTE DE BAIXO + COLUNA DIREITA ESCURECIDA (SEM ÍCONES) */}
              {instagramDecal && (
                <div className="absolute inset-0 pointer-events-none z-40 transition-opacity duration-150 overflow-hidden rounded-[40px]">
                  {/* Zona Morta Inferior (21%) */}
                  <div className="absolute bottom-0 left-0 right-0 h-[21%] bg-black/65 backdrop-blur-[0.5px] border-t border-dashed border-white/20" />

                  {/* Coluna Direita Escurecida onde ficam os botões do Reels (SEM ÍCONES) */}
                  <div className="absolute right-0 top-[48%] bottom-[21%] w-[16%] bg-black/65 backdrop-blur-[0.5px] border-l border-t border-dashed border-white/20 rounded-tl-xl" />
                </div>
              )}

              {/* HOME BAR DO IPHONE */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-zinc-400/40 rounded-full pointer-events-none z-50" />
            </div>
          </div>

        </main>

      </div>

      {/* 3. BARRA INFERIOR PADRÃO CANVA (ZOOM, CONTROLE DE ESCALA E DIMENSÕES) */}
      <footer className="h-10 bg-[#0e0e11] border-t border-white/[0.08] px-4 sm:px-6 flex items-center justify-between text-xs text-zinc-400 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-400">1080 × 1920 px (9:16 Reels)</span>
          <div className="h-3 w-px bg-white/10" />
          <span className="text-[11px] flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${instagramDecal ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span>Decalque Reels: <strong className="text-white">{instagramDecal ? 'Ativo' : 'Oculto'}</strong></span>
          </span>
        </div>

        {/* Controles de Zoom do Canvas (Canva Style) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCanvasZoom(z => Math.max(70, z - 10))}
            className="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={70}
            max={130}
            value={canvasZoom}
            onChange={(e) => setCanvasZoom(Number(e.target.value))}
            className="w-20 accent-indigo-500 cursor-pointer"
          />

          <span className="font-mono text-[11px] text-white w-9 text-center">{canvasZoom}%</span>

          <button
            type="button"
            onClick={() => setCanvasZoom(z => Math.min(130, z + 10))}
            className="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCanvasZoom(100)}
            className="px-2 py-0.5 rounded text-[10px] bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer"
          >
            Ajustar
          </button>
        </div>
      </footer>

    </div>
  )
}
