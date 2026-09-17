'use client'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { SweepStepper } from '@/components/ui/SweepStepper'
import { AspectRatioSelector, AspectFormat } from '@/components/ui/AspectRatioSelector'
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
  Wifi,
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
    brandName: 'Nome da Página',
    brandHandle: '@nomedapagina',
    showVerifiedBadge: true,
    title: 'ASSIM QUE SEU TITULO APARECERA NO VIDEOS',
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
type ActiveTool = 'templates' | 'text' | 'brand' | 'subtitles' | 'background' | null

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
  const [videoAspect, setVideoAspect] = useState<'9:16' | '4:5' | '1:1' | '16:9'>('9:16')

  // Conteúdo textual e identidade
  const [brandName, setBrandName] = useState('Nome da Página')
  const [brandHandle, setBrandHandle] = useState('@nomedapagina')
  const [brandAlign, setBrandAlign] = useState<'left' | 'center' | 'right'>('center')
  const [brandLayout, setBrandLayout] = useState<'inline' | 'stacked'>('inline')
  const [showVerifiedBadge, setShowVerifiedBadge] = useState<boolean>(true)
  const DEFAULT_BRAND_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><defs><linearGradient id='cp_grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='50%' stop-color='%238b5cf6'/><stop offset='100%' stop-color='%23ec4899'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23cp_grad)'/><path d='M60 34 A15 15 0 1 0 60 64 A15 15 0 0 0 60 34 Z M40 88 C40 73 50 68 60 68 C70 68 80 73 80 88 Z' fill='white' opacity='0.95'/></svg>"
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_BRAND_AVATAR)
  const [titleText, setTitleText] = useState('AQUI QUE O SEU TITULO VAI ESTAR POSICIONADO NO VÍDEO')

  // Tipografia
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].family)
  const [fontSize, setFontSize] = useState(14)
  const [titleColor, setTitleColor] = useState<string>('#ffffff')
  const [titleStroke, setTitleStroke] = useState<'none' | 'thin' | 'medium' | 'thick'>('none')
  const [titleStrokeColor, setTitleStrokeColor] = useState<string>('#000000')
  const [titleCapsLock, setTitleCapsLock] = useState<boolean>(true)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')

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
        if (p.avatar_url && !p.avatar_url.includes('photo-1514888286974-6c03e2ca1dba')) setAvatarUrl(p.avatar_url)
        else setAvatarUrl(DEFAULT_BRAND_AVATAR)
        if (p.config) {
          const c = p.config
          if (c.templateBg) setTemplateBg(c.templateBg)
          if (c.showVerifiedBadge !== undefined) setShowVerifiedBadge(c.showVerifiedBadge)
          if (c.brandName && c.brandName !== 'HUMOR DA IGUANA') setBrandName(c.brandName)
          else setBrandName('Nome da Página')
          if (c.brandHandle && c.brandHandle !== '@humordaiguana') setBrandHandle(c.brandHandle)
          else setBrandHandle('@nomedapagina')
          if (c.titleText && !c.titleText.includes('arrependimento') && !c.titleText.includes('É assim que')) {
            setTitleText(c.titleText)
          } else {
            setTitleText('ASSIM QUE SEU TITULO APARECERA NO VIDEOS')
          }
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
          if (bk.avatar_url && !bk.avatar_url.includes('photo-1514888286974-6c03e2ca1dba')) setAvatarUrl(bk.avatar_url)
          else setAvatarUrl(DEFAULT_BRAND_AVATAR)
          if (bk.username && bk.username !== '@humordaiguana') setBrandHandle(bk.username)
          else setBrandHandle('@nomedapagina')
          if (bk.layout_config) {
            const cfg = bk.layout_config
            if (cfg.brandName && cfg.brandName !== 'HUMOR DA IGUANA') setBrandName(cfg.brandName)
            else setBrandName('Nome da Página')
            if (cfg.templateBg) setTemplateBg(cfg.templateBg)
            if (cfg.showVerifiedBadge !== undefined) setShowVerifiedBadge(cfg.showVerifiedBadge)
            if (cfg.fontFamily) setFontFamily(cfg.fontFamily)
            if (cfg.fontSize) setFontSize(cfg.fontSize)
            if (cfg.subtitle_preset) setSelectedSubtitle(cfg.subtitle_preset)
            if (cfg.videoWidth) setVideoWidth(cfg.videoWidth)
            if (cfg.videoHeight) setVideoHeight(cfg.videoHeight)
            if (cfg.videoPos) setVideoPos(cfg.videoPos)
            if (cfg.headerPos) setHeaderPos(cfg.headerPos)
            if (cfg.titlePos) setTitlePos(cfg.titlePos)
            if (cfg.subtitlePos) setSubtitlePos(cfg.subtitlePos)
            if (cfg.brandAlign) setBrandAlign(cfg.brandAlign)
            if (cfg.brandLayout) setBrandLayout(cfg.brandLayout)
            if (cfg.titleColor) setTitleColor(cfg.titleColor)
            if (cfg.titleStroke) setTitleStroke(cfg.titleStroke)
            if (cfg.titleStrokeColor) setTitleStrokeColor(cfg.titleStrokeColor)
            if (cfg.titleCapsLock !== undefined) setTitleCapsLock(cfg.titleCapsLock)
            if (cfg.textAlign) setTextAlign(cfg.textAlign)
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
        brandAlign,
        brandLayout,
        titleText,
        fontFamily,
        fontSize,
        textAlign,
        titleColor,
        titleStroke,
        titleStrokeColor,
        titleCapsLock,
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
    setShowVerifiedBadge(preset.showVerifiedBadge !== false)
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

      // Delimitação estrita para nenhum elemento vazar das bordas do iPhone
      let minX = 20, maxX = 80, minY = 10, maxY = 90
      if (target === 'header') { minX = 30; maxX = 70; minY = 12; maxY = 84 }
      else if (target === 'title') { minX = 25; maxX = 75; minY = 16; maxY = 85 }
      else if (target === 'video') { minX = 40; maxX = 60; minY = 30; maxY = 70 }
      else if (target === 'subtitle') { minX = 25; maxX = 75; minY = 25; maxY = 82 }

      let nextX = Math.max(minX, Math.min(maxX, Math.round(initialElemPos.current.x + deltaX)))
      let nextY = Math.max(minY, Math.min(maxY, Math.round(initialElemPos.current.y + deltaY)))

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

  // Redimensionamento Lateral Direito (Puxar para o lado para mudar a largura / proporção horizontal)
  const startResizeRight = (clientX: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    const startX = clientX
    const initW = videoWidth

    const onRightMove = (ev: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const w = phoneRef.current.clientWidth
      const deltaX = curX - startX
      const deltaW = (deltaX / w) * 100 * 2
      const newW = Math.max(25, Math.min(100, Math.round(initW + deltaW)))
      setVideoWidth(newW)
    }

    const onRightUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onRightMove)
      window.removeEventListener('mouseup', onRightUp)
      window.removeEventListener('touchmove', onRightMove)
      window.removeEventListener('touchend', onRightUp)
    }

    window.addEventListener('mousemove', onRightMove)
    window.addEventListener('mouseup', onRightUp)
    window.addEventListener('touchmove', onRightMove)
    window.addEventListener('touchend', onRightUp)
  }

  // Redimensionamento Lateral Esquerdo
  const startResizeLeft = (clientX: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsResizingVideo(true)
    const startX = clientX
    const initW = videoWidth

    const onLeftMove = (ev: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const w = phoneRef.current.clientWidth
      const deltaX = startX - curX
      const deltaW = (deltaX / w) * 100 * 2
      const newW = Math.max(25, Math.min(100, Math.round(initW + deltaW)))
      setVideoWidth(newW)
    }

    const onLeftUp = () => {
      setIsResizingVideo(false)
      window.removeEventListener('mousemove', onLeftMove)
      window.removeEventListener('mouseup', onLeftUp)
      window.removeEventListener('touchmove', onLeftMove)
      window.removeEventListener('touchend', onLeftUp)
    }

    window.addEventListener('mousemove', onLeftMove)
    window.addEventListener('mouseup', onLeftUp)
    window.addEventListener('touchmove', onLeftMove)
    window.addEventListener('touchend', onLeftUp)
  }


  const handleSave = async () => {
    setSaving(true)
    try {
      const layoutConfig = {
        brandName,
        brandHandle,
        brandAlign,
        brandLayout,
        showVerifiedBadge,
        templateBg,
        subtitle_preset: selectedSubtitle,
        fontFamily,
        fontSize,
        textAlign,
        titleColor,
        titleStroke,
        titleStrokeColor,
        titleCapsLock,
        videoWidth,
        videoHeight,
        avatarPos,
        headerPos,
        titlePos,
        videoPos,
        subtitlePos,
      }

      // Salva localmente primeiro (100% resiliente)
      localStorage.setItem('clippost_active_template', JSON.stringify({
        layout: 'meme_frame',
        subtitle_preset: selectedSubtitle,
        avatar_url: avatarUrl,
        template_bg: templateBg,
        config: layoutConfig,
      }))
      localStorage.setItem('clippost_template_config', JSON.stringify(layoutConfig))

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Envia para /api/brand-kit sem erros 400
        await fetch('/api/brand-kit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            avatar_url: avatarUrl,
            username: brandHandle,
            layout_config: layoutConfig,
          }),
        }).catch(() => null)
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch {
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  // Upload de Foto
  const handleBrandAlign = (align: 'left' | 'center' | 'right') => {
    setBrandAlign(align)
  }

  const handleBrandLayout = (layout: 'inline' | 'stacked') => {
    setBrandLayout(layout)
  }

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
              <LayoutTemplate className="w-4 h-4 text-white" />
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
        <aside className="w-16 sm:w-[72px] bg-[#0c0c0f] border-r border-white/[0.08] flex flex-col items-center py-3 gap-1 z-20 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'templates' ? null : 'templates')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'templates'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 font-semibold'
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
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 font-semibold'
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
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 font-semibold'
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
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">Legenda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'background' ? null : 'background')}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'background'
                ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 font-semibold'
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

                {/* SELETOR DE PROPORÇÃO BENCHO (EQUAL-AREA MORPHING) */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <AspectRatioSelector
                    currentAspect={videoAspect}
                    onSelectAspect={(format) => {
                      setVideoAspect(format.id)
                      setVideoWidth(format.widthPercent)
                      setVideoHeight(format.heightPercent)
                    }}
                  />
                </div>

                {/* PÍLULA SAFEZONE DENTRO DE MODELOS */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        instagramDecal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'
                      }`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">Decalque Safe Zone</span>
                        <span className="text-[10px] text-zinc-400">Guia de segurança 9:16</span>
                      </div>
                    </div>
                    <LiquidToggle
                      checked={instagramDecal}
                      onChange={setInstagramDecal}
                      activeColor="emerald"
                    />
                  </div>
              </div>
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

                <div className="space-y-4">
                  {/* TAMANHO DA FONTE (BENCHO SWEEP STEPPER: TAP FOR ONE, HOLD TO SWEEP) */}
                  <div className="space-y-1.5">
                    <SweepStepper
                      label="Tamanho da Fonte (11 a 18px):"
                      value={fontSize}
                      onChange={setFontSize}
                      min={11}
                      max={18}
                      step={1}
                      unit="px"
                    />
                  </div>

                  {/* COR DA LETRA */}
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <label className="text-zinc-400 font-medium text-xs">Cor da Letra:</label>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: titleColor }} />
                        <span className="font-mono text-[10px] text-zinc-400 uppercase">{titleColor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Branco', color: '#ffffff' },
                        { label: 'Preto', color: '#000000' },
                        { label: 'Amarelo', color: '#facc15' },
                        { label: 'Ciano', color: '#06b6d4' },
                        { label: 'Laranja', color: '#fb923c' },
                        { label: 'Verde', color: '#4ade80' },
                        { label: 'Rosa', color: '#ec4899' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => setTitleColor(c.color)}
                          title={c.label}
                          className={`w-6 h-6 rounded-lg border transition-transform cursor-pointer ${
                            titleColor.toLowerCase() === c.color.toLowerCase()
                              ? 'scale-110 ring-2 ring-indigo-500 border-white'
                              : 'border-white/20 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                      <label className="w-6 h-6 rounded-lg border border-dashed border-white/30 flex items-center justify-center cursor-pointer hover:border-indigo-400 text-zinc-400 text-[10px]" title="Cor personalizada">
                        +
                        <input
                          type="color"
                          value={titleColor.startsWith('#') ? titleColor : '#ffffff'}
                          onChange={(e) => setTitleColor(e.target.value)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  {/* FUNÇÃO DE BORDA DO TEXTO (CONTORNO) */}
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <label className="text-zinc-400 font-medium text-xs">Borda do Texto (Contorno):</label>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">
                        {titleStroke === 'none' ? 'Sem Borda' : titleStroke}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: 'none', label: 'Sem' },
                        { id: 'thin', label: '1px' },
                        { id: 'medium', label: '2px' },
                        { id: 'thick', label: '3px' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setTitleStroke(s.id as any)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            titleStroke === s.id
                              ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                              : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {titleStroke !== 'none' && (
                      <div className="flex items-center gap-1.5 pt-1.5">
                        <span className="text-[10px] text-zinc-400">Cor da Borda:</span>
                        {['#000000', '#ffffff', '#ef4444', '#facc15'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setTitleStrokeColor(color)}
                            className={`w-5 h-5 rounded-md border transition-all ${
                              titleStrokeColor === color ? 'ring-2 ring-indigo-500 scale-110 border-white' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* TOGGLE CAPS LOCK (BOTÕES COMPACTOS AA / Aa) */}
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <label className="text-zinc-400 font-medium text-xs">Formatação de Caixa:</label>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">{titleCapsLock ? 'AA' : 'Aa'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-1">
                      <button
                        type="button"
                        onClick={() => setTitleCapsLock(true)}
                        className={`py-2 rounded-lg text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center ${
                          titleCapsLock
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                        title="Tudo em Maiúsculas (AA)"
                      >
                        AA
                      </button>
                      <button
                        type="button"
                        onClick={() => setTitleCapsLock(false)}
                        className={`py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                          !titleCapsLock
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                        title="Normal (Aa)"
                      >
                        Aa
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 font-medium text-xs">Alinhamento do Texto:</label>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">{textAlign}</span>
                  </div>
                  <div className="grid grid-cols-3 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-1">
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
                          className={`py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            textAlign === a.id
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                          title={a.label}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{a.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                </div>
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

                {/* FERRAMENTA DE ALINHAMENTO DO PERFIL */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 font-medium text-xs">Alinhamento do Perfil:</label>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">{brandAlign}</span>
                  </div>
                  <div className="grid grid-cols-3 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-1">
                    {[
                      { id: 'left', icon: AlignLeft, label: 'Esquerda' },
                      { id: 'center', icon: AlignCenter, label: 'Centro' },
                      { id: 'right', icon: AlignRight, label: 'Direita' },
                    ].map((a) => {
                      const Icon = a.icon
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleBrandAlign(a.id as any)}
                          className={`py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            brandAlign === a.id
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                          title={a.label}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{a.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* TOGGLE SELO DE VERIFICADO */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-zinc-400 font-medium text-xs">Selo de Verificado:</label>
                      <svg className="w-3 h-3 text-blue-500 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <LiquidToggle checked={showVerifiedBadge} onChange={setShowVerifiedBadge} activeColor="indigo" />
                  </div>
                </div>

                {/* DISPOSIÇÃO DO PERFIL (LADO A LADO VS EMPILHADO) */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 font-medium text-xs">Disposição do Perfil:</label>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">{brandLayout === 'inline' ? 'Lado a Lado' : 'Empilhado'}</span>
                  </div>
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-1">
                    <button
                      type="button"
                      onClick={() => handleBrandLayout('inline')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                        brandLayout === 'inline'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      Lado a Lado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBrandLayout('stacked')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                        brandLayout === 'stacked'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      Empilhado
                    </button>
                  </div>
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

            {/* ABA 6: COR DE FUNDO & UPLOAD PERSONALIZADO (PADRÃO HARMONIOSO) */}
            {activeTool === 'background' && (
              <div className="space-y-5 text-xs">
                <div className="space-y-2.5">
                  <label className="text-zinc-300 font-semibold block text-xs tracking-tight">
                    Cor da Tela do Template:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark', label: 'Preto Puro', color: '#000000', border: 'border-white/20' },
                      { id: 'white', label: 'Branco Neve', color: '#ffffff', border: 'border-zinc-400' },
                      { id: 'gray', label: 'Grafite', color: '#27272a', border: 'border-white/20' }
                    ].map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setTemplateBg(b.id as any)
                          setCustomBgImage(null)
                          if (b.id === 'white') {
                            if (titleColor.toLowerCase() === '#ffffff') setTitleColor('#000000')
                          } else {
                            if (titleColor.toLowerCase() === '#000000') setTitleColor('#ffffff')
                          }
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                          templateBg === b.id && !customBgImage
                            ? 'bg-[#6366f1]/15 text-white border-[#6366f1] ring-1 ring-[#6366f1]/50 shadow-md shadow-[#6366f1]/10 font-bold'
                            : 'bg-white/[0.02] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.05] font-medium'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full border shadow-sm shrink-0 ${b.border}`}
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="text-[11px] leading-tight text-center">{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload de Imagem de Fundo */}
                <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
                  <label className="text-zinc-300 font-semibold block text-xs tracking-tight">
                    Fundo Personalizável (Upload):
                  </label>
                  
                  {customBgImage ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-28 rounded-xl overflow-hidden border border-[#6366f1]/40 shadow-md">
                        <img src={customBgImage} alt="Fundo Personalizado" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-xs font-bold text-white bg-black/70 px-3 py-1 rounded-full border border-white/20">
                            Fundo Ativo
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <label className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white font-semibold text-center cursor-pointer transition-colors text-xs flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4 text-indigo-400" />
                          <span>Trocar Imagem</span>
                          <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={() => setCustomBgImage(null)}
                          className="py-2.5 px-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs cursor-pointer transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2.5 py-6 px-4 rounded-xl border border-dashed border-white/20 hover:border-[#6366f1]/60 bg-white/[0.01] hover:bg-[#6366f1]/[0.02] cursor-pointer transition-all">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-[#6366f1]/30 flex items-center justify-center text-[#6366f1]">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-center space-y-0.5">
                        <p className="font-bold text-white text-xs">Fazer Upload de Imagem de Fundo</p>
                        <p className="text-[10px] text-zinc-500">PNG, JPG ou WebP (proporção 9:16 recomendada)</p>
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
          
          {/* MOCKUP DO IPHONE 16/18 PRO (TITÂNIO, PROPORÇÃO 19.5:9, STATUS BAR REALISTA, SEM DYNAMIC ISLAND) */}
          <div
            style={{
              transform: `scale(${canvasZoom / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out'
            }}
            className="relative p-[10px] bg-gradient-to-b from-[#38383e] via-[#202025] to-[#121215] rounded-[54px] shadow-[0_30px_90px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.8)] ring-1 ring-white/20 shrink-0 select-none my-auto"
          >
            {/* BOTÕES LATERAIS FÍSICOS DO IPHONE (TITÂNIO 3D) */}
            <div className="absolute -left-[4px] top-[110px] w-[4px] h-[26px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -left-[4px] top-[152px] w-[4px] h-[48px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -left-[4px] top-[212px] w-[4px] h-[48px] bg-zinc-600 rounded-l-sm shadow-sm" />
            <div className="absolute -right-[4px] top-[170px] w-[4px] h-[68px] bg-zinc-600 rounded-r-sm shadow-sm" />
            <div className="absolute -right-[4px] top-[440px] w-[4px] h-[48px] bg-zinc-600/80 rounded-r-sm ring-1 ring-white/10" />

            {/* TELA OLED DO IPHONE (PROPORÇÃO REAL 19.5:9 -> 324 x 702 px) */}
            <div
              ref={phoneRef}
              style={{ width: "324px", height: "702px", aspectRatio: "9 / 19.5" }}
              className={`relative rounded-[44px] overflow-hidden transition-colors ${
                templateBg === 'white'
                  ? 'bg-white text-zinc-950'
                  : templateBg === 'gray'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-black text-white'
              }`}
            >
              {/* STATUS BAR DO IPHONE (9:41 + SINAL, WI-FI, BATERIA - ADAPTAÇÃO DINÂMICA) */}
              <div className={`absolute top-0 left-0 right-0 h-10 px-6 pt-2.5 flex items-center justify-between z-50 pointer-events-none select-none transition-colors ${
                templateBg === 'white' ? 'text-zinc-950' : 'text-white'
              }`}>
                <span className="text-[12px] font-bold tracking-tight">9:41</span>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-0.5 h-2.5">
                    <div className={`w-[2px] h-1 rounded-xs ${templateBg === 'white' ? 'bg-zinc-950' : 'bg-white'}`} />
                    <div className={`w-[2px] h-1.5 rounded-xs ${templateBg === 'white' ? 'bg-zinc-950' : 'bg-white'}`} />
                    <div className={`w-[2px] h-2 rounded-xs ${templateBg === 'white' ? 'bg-zinc-950' : 'bg-white'}`} />
                    <div className={`w-[2px] h-2.5 rounded-xs ${templateBg === 'white' ? 'bg-zinc-950' : 'bg-white'}`} />
                  </div>
                  <Wifi className="w-3.5 h-3.5 stroke-[2.4]" />
                  <div className={`w-5 h-2.5 rounded-[4px] border p-0.5 flex items-center ${
                    templateBg === 'white' ? 'border-zinc-900' : 'border-white/80'
                  }`}>
                    <div className={`w-3 h-full rounded-[2px] ${templateBg === 'white' ? 'bg-zinc-900' : 'bg-white'}`} />
                  </div>
                </div>
              </div>

              {/* Imagem de Fundo Personalizada (se selecionada) */}
              {customBgImage && (
                <img
                  src={customBgImage}
                  alt="Fundo"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              )}
              
              {/* LINHA GUIA MAGNÉTICA HORIZONTAL (CENTRO X: 50%) */}
              {snapActiveX && (
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] z-50 pointer-events-none flex items-center justify-center">
                  <span className="bg-cyan-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow absolute top-12">
                    Centro X 50%
                  </span>
                </div>
              )}

              {/* 1 & 2. PERFIL DO CANAL UNIFICADO (FOTO + NOME + ARROBA — NUNCA CORTA) */}
              <div
                onMouseDown={(e) => startDrag2D('header', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('header', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  top: `${headerPos.y}%`,
                }}
                className={`absolute left-5 right-5 -translate-y-1/2 z-30 flex items-center select-none cursor-grab active:cursor-grabbing transition-all ${
                  brandAlign === 'left' ? 'justify-start' : brandAlign === 'right' ? 'justify-end' : 'justify-center'
                } ${
                  draggingTarget === 'header' ? 'ring-2 ring-[#6366f1] rounded-2xl p-1 bg-indigo-500/10' : ''
                }`}
                title="Arraste o perfil para reposicionar verticalmente"
              >
                <div className={`flex items-center gap-2.5 max-w-full ${brandLayout === 'stacked' ? 'flex-col text-center' : 'flex-row'}`}>
                  <div className={`w-10 h-10 rounded-full border-2 overflow-hidden shadow-md shrink-0 ${
                    templateBg === 'white' ? 'border-zinc-300 bg-zinc-100' : 'border-white/60 bg-zinc-900'
                  }`}>
                    <img
                      src={avatarUrl}
                      alt={brandName}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                  <div className={`flex flex-col min-w-0 ${brandAlign === 'center' ? 'items-center text-center' : brandAlign === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-bold tracking-tight truncate ${
                        templateBg === 'white' ? 'text-zinc-950' : 'text-white'
                      }`}>
                        {brandName}
                      </span>
                      {showVerifiedBadge && (
                        <svg className="w-3 h-3 text-blue-500 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium truncate ${
                      templateBg === 'white' ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {brandHandle}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. TÍTULO / GANCHO COM PERSONALIZAÇÃO DE TIPOGRAFIA (SEM SOMBRA BORRADA) */}
              <div
                onMouseDown={(e) => startDrag2D('title', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('title', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${titlePos.x}%`,
                  top: `${titlePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '88%',
                  fontFamily: fontFamily,
                  fontSize: `${fontSize}px`,
                  color: templateBg === 'white' && titleColor.toLowerCase() === '#ffffff' ? '#000000' : titleColor,
                  textAlign: textAlign,
                  textTransform: titleCapsLock ? 'uppercase' : 'none',
                  paintOrder: 'stroke fill',
                  textShadow: titleStroke !== 'none'
                    ? (() => {
                        const r = titleStroke === 'thin' ? 1.2 : titleStroke === 'medium' ? 2.2 : 3.2
                        const pts = []
                        for (let i = 0; i < 16; i++) {
                          const a = (i * Math.PI) / 8
                          pts.push(`${(Math.cos(a) * r).toFixed(1)}px ${(Math.sin(a) * r).toFixed(1)}px 0 ${titleStrokeColor}`)
                        }
                        return pts.join(', ')
                      })()
                    : 'none',
                  WebkitTextStroke: titleStroke !== 'none'
                    ? `${titleStroke === 'thin' ? '1.5px' : titleStroke === 'medium' ? '2.5px' : '3.5px'} ${titleStrokeColor}`
                    : 'none'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-30 font-black leading-tight tracking-tight select-none ${
                  draggingTarget === 'title' ? 'ring-2 ring-[#6366f1] rounded-xl p-1 bg-white/5' : ''
                }`}
                title="Arraste o título para posicionar livremente"
              >
                {titleText}
              </div>

              {/* 4. QUADRO DO VÍDEO (RESIZABLE COM ALÇAS) */}
              <div
                style={{
                  left: `${videoPos.x}%`,
                  top: `${videoPos.y}%`,
                  width: `${videoWidth}%`,
                  height: `${videoHeight}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: isResizingVideo
                    ? 'none'
                    : 'width 520ms cubic-bezier(0.22, 1, 0.36, 1), height 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                className="absolute z-20 group"
              >
                {/* ALÇA SUPERIOR */}
                <div
                  onMouseDown={(e) => startResizeTop(e.clientY, e)}
                  onTouchStart={(e) => startResizeTop(e.touches[0].clientY, e)}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 flex items-center justify-center cursor-ns-resize z-40 group/top"
                  title="Arrastar borda superior para redimensionar"
                >
                  <div className="w-9 h-1.5 bg-white rounded-full shadow group-hover/top:scale-110 group-hover/top:bg-indigo-400 transition-all border border-black/30" />
                </div>

                {/* ALÇA INFERIOR */}
                <div
                  onMouseDown={(e) => startResizeBottom(e.clientY, e)}
                  onTouchStart={(e) => startResizeBottom(e.touches[0].clientY, e)}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-5 flex items-center justify-center cursor-ns-resize z-40 group/bottom"
                  title="Arrastar borda inferior para redimensionar"
                >
                  <div className="w-9 h-1.5 bg-white rounded-full shadow group-hover/bottom:scale-110 group-hover/bottom:bg-indigo-400 transition-all border border-black/30" />
                </div>

                {/* ALÇA LATERAL ESQUERDA */}
                <div
                  onMouseDown={(e) => startResizeLeft(e.clientX, e)}
                  onTouchStart={(e) => startResizeLeft(e.touches[0].clientX, e)}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 h-16 w-5 flex items-center justify-center cursor-ew-resize z-40 group/left"
                  title="Arrastar borda esquerda para largura"
                >
                  <div className="h-9 w-1.5 bg-white rounded-full shadow group-hover/left:scale-110 group-hover/left:bg-indigo-400 transition-all border border-black/30" />
                </div>

                {/* ALÇA LATERAL DIREITA */}
                <div
                  onMouseDown={(e) => startResizeRight(e.clientX, e)}
                  onTouchStart={(e) => startResizeRight(e.touches[0].clientX, e)}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 h-16 w-5 flex items-center justify-center cursor-ew-resize z-40 group/right"
                  title="Arrastar borda direita para largura"
                >
                  <div className="h-9 w-1.5 bg-white rounded-full shadow group-hover/right:scale-110 group-hover/right:bg-indigo-400 transition-all border border-black/30" />
                </div>

                {/* CONTAINER DO VÍDEO */}
                <div
                  onMouseDown={(e) => startDrag2D('video', e.clientX, e.clientY, e)}
                  onTouchStart={(e) => startDrag2D('video', e.touches[0].clientX, e.touches[0].clientY, e)}
                  className={`w-full h-full rounded-2xl overflow-hidden bg-black/90 shadow-xl relative cursor-grab active:cursor-grabbing border-2 ${
                    draggingTarget === 'video' ? 'border-[#6366f1] ring-4 ring-[#6366f1]/30' : templateBg === 'white' ? 'border-zinc-300 group-hover:border-indigo-400/80' : 'border-white/40 group-hover:border-indigo-400/80'
                  } transition-colors`}
                >
                  <img
                    src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80"
                    alt="Vídeo Preview"
                    className="w-full h-full object-cover pointer-events-none opacity-90"
                  />
                  
                  <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-400 bg-white shadow-sm pointer-events-none" />
                  <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-400 bg-white shadow-sm pointer-events-none" />
                  <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-400 bg-white shadow-sm pointer-events-none" />
                  <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-400 bg-white shadow-sm pointer-events-none" />
                </div>
              </div>

              {/* 5. ÁREA DAS LEGENDAS DINÂMICAS */}
              <div
                onMouseDown={(e) => startDrag2D('subtitle', e.clientX, e.clientY, e)}
                onTouchStart={(e) => startDrag2D('subtitle', e.touches[0].clientX, e.touches[0].clientY, e)}
                style={{
                  left: `${subtitlePos.x}%`,
                  top: `${subtitlePos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-grab active:cursor-grabbing z-30 select-none ${
                  draggingTarget === 'subtitle' ? 'ring-2 ring-[#6366f1] rounded-xl p-1 bg-white/5' : ''
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

              {/* 6. DECALQUE REELS (ÁREA ESCURECIDA TRANSLÚCIDA + ZONA SEGURA — SEM ÍCONES) */}
              {instagramDecal && (
                <div className="absolute inset-0 pointer-events-none z-40 select-none overflow-hidden rounded-[44px]">
                  {/* Zona Morta Inferior Escurecida (21% da altura) */}
                  <div className="absolute bottom-0 left-0 right-0 h-[21%] bg-gradient-to-t from-black/90 via-black/80 to-black/60 border-t border-dashed border-white/25 flex flex-col justify-end pb-3.5 px-4">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest text-center">
                      Área Segura de Legendas (Reels 9:16)
                    </span>
                  </div>

                  {/* Coluna Lateral Direita Escurecida (16% da largura) */}
                  <div className="absolute right-0 top-[48%] bottom-[21%] w-[16%] bg-black/55 border-l border-t border-dashed border-white/20 rounded-tl-xl" />
                </div>
              )}

              {/* BARRA HOME DO IPHONE */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/70 rounded-full pointer-events-none z-50 shadow-sm" />
            </div>
          </div>

        </main>

      </div>

      {/* 3. BARRA INFERIOR PADRÃO CANVA (ZOOM, CONTROLE DE ESCALA E DIMENSÕES) */}
      <footer className="h-10 bg-[#0e0e11] border-t border-white/[0.08] px-4 sm:px-6 flex items-center justify-between text-xs text-zinc-400 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-400">iPhone 18 Pro (19.5:9 Display) • 1080 × 1920 px</span>
          <div className="h-3 w-px bg-white/10" />
          <span className="text-[11px] flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${instagramDecal ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span>Decalque Reels</span>
          </span>
        </div>

        {/* Controles de Zoom do Canvas (Bencho Sweep Stepper) */}
        <div className="flex items-center gap-2">
          <ZoomOut className="w-3.5 h-3.5 text-zinc-500" />
          <SweepStepper
            value={canvasZoom}
            onChange={setCanvasZoom}
            min={50}
            max={150}
            step={5}
            unit="%"
            size="sm"
            className="w-28"
          />
          <ZoomIn className="w-3.5 h-3.5 text-zinc-500" />
          <button
            type="button"
            onClick={() => setCanvasZoom(100)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors border border-white/[0.06]"
            title="Restaurar zoom para 100%"
          >
            100%
          </button>
        </div>
      </footer>

    </div>
  )
}
