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
  CheckCircle2,
  Camera,
  Type,
  X,
  Palette,
  Eye,
  Sliders,
  CheckCheck
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
  { id: 'hormozi_orange', name: 'Hormozi Orange', tag: 'Mais Retenção', badgeColor: '#ea580c', textColor: '#ffffff', bgColor: '#ea580c', sampleText: 'AUTOMATICALLY' },
  { id: 'hormozi_yellow', name: 'Hormozi Yellow', tag: 'Viral Clássico', badgeColor: '#facc15', textColor: '#000000', bgColor: '#facc15', sampleText: 'HEY THERE' },
  { id: 'neon_cyan', name: 'Neon Cyan', tag: 'Gamer / Tech', badgeColor: '#06b6d4', textColor: '#22d3ee', glow: '0 0 12px rgba(6,182,212,0.8)', sampleText: 'HEY THERE' },
  { id: 'neon_magenta', name: 'Neon Magenta', tag: 'Cyberpunk', badgeColor: '#ec4899', textColor: '#f472b6', glow: '0 0 12px rgba(236,72,153,0.8)', sampleText: 'HEY THERE' },
  { id: 'neon_green', name: 'Neon Green', tag: 'Finanças / Crypto', badgeColor: '#22c55e', textColor: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.8)', sampleText: 'HEY THERE' },
  { id: 'karaoke_active', name: 'Karaoke Verde', tag: 'Dinâmico', badgeColor: '#22c55e', textColor: '#ffffff', bgColor: '#22c55e', sampleText: 'PALAVRA ATIVA' },
  { id: 'two_tone_red', name: 'Two Tone Red', tag: 'Atenção Total', badgeColor: '#ef4444', textColor: '#f87171', sampleText: 'TO GET STARTED' },
  { id: 'two_tone_orange', name: 'Two Tone Orange', tag: 'Podcast', badgeColor: '#f97316', textColor: '#fb923c', sampleText: 'TO GET STARTED' },
  { id: 'two_tone_blue', name: 'Two Tone Blue', tag: 'Profissional', badgeColor: '#3b82f6', textColor: '#60a5fa', sampleText: 'TO GET STARTED' },
  { id: 'typewriter_underline', name: 'Typewriter Underline', tag: 'Editorial', badgeColor: '#d4d4d8', textColor: '#f4f4f5', sampleText: 'HEY THERE' },
  { id: 'apple_sf', name: 'Apple SF Pro', tag: 'Sofisticado', badgeColor: '#e4e4e7', textColor: '#f4f4f5', sampleText: 'Simplicidade pura' },
  { id: 'bold_stroke', name: 'Bold Stroke', tag: 'Alto Contraste', badgeColor: '#ffffff', textColor: '#ffffff', sampleText: 'ESTE SEGREDO' },
  { id: 'purple_pill', name: 'Purple Pill', tag: 'Tech', badgeColor: '#7c3aed', textColor: '#ffffff', bgColor: '#7c3aed', sampleText: 'Hey there' },
  { id: 'retro_gradient', name: 'Retro Sunset', tag: 'Lifestyle', badgeColor: '#f43f5e', textColor: '#fb7185', sampleText: 'VEJA O VÍDEO' },
  { id: 'minimal_dark', name: 'Minimal Dark', tag: 'Discreto', badgeColor: '#71717a', textColor: '#f4f4f5', bgColor: 'rgba(0,0,0,0.7)', sampleText: 'SUBTÍTULO' }
]

export default function TemplatesCleanPage() {
  const supabase = createClient()

  // Cores de fundo (bolinhas à esquerda)
  const [templateBg, setTemplateBg] = useState<'white' | 'dark' | 'gray'>('white')

  // Posições verticais individuais (em %) para cada elemento ser 100% móvel
  const [avatarY, setAvatarY] = useState(5) // % topo
  const [headerY, setHeaderY] = useState(16) // % topo (Nome e @)
  const [titleY, setTitleY] = useState(25) // % topo (Título explicativo)
  const [videoY, setVideoY] = useState(45) // % topo (Vídeo)
  const [subtitleY, setSubtitleY] = useState(82) // % topo (Legenda independente do vídeo)
  const [videoScale, setVideoScale] = useState(88) // % largura

  // Conteúdo textual e visual
  const [brandName, setBrandName] = useState('HUMOR DO BICHANO')
  const [brandHandle, setBrandHandle] = useState('@humordobichano')
  const [hasVerified, setHasVerified] = useState(true)
  const [titleText, setTitleText] = useState('É assim que o seu título vai aparecer no template quando você fizer uma edição de vídeo')
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')
  const [selectedSubtitle, setSelectedSubtitle] = useState('hormozi_orange')

  // Modais e seletores
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false)
  const [draggingTarget, setDraggingTarget] = useState<'avatar' | 'header' | 'title' | 'video' | 'subtitle' | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const phoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragStartY = useRef(0)
  const initialElemY = useRef(0)

  // Carregar dados salvos
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
          if (c.avatarY !== undefined) setAvatarY(c.avatarY)
          if (c.headerY !== undefined) setHeaderY(c.headerY)
          if (c.titleY !== undefined) setTitleY(c.titleY)
          if (c.videoY !== undefined) setVideoY(c.videoY)
          if (c.subtitleY !== undefined) setSubtitleY(c.subtitleY)
          if (c.videoScale !== undefined) setVideoScale(c.videoScale)
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
          if (c.avatarY !== undefined) setAvatarY(c.avatarY)
          if (c.headerY !== undefined) setHeaderY(c.headerY)
          if (c.titleY !== undefined) setTitleY(c.titleY)
          if (c.videoY !== undefined) setVideoY(c.videoY)
          if (c.subtitleY !== undefined) setSubtitleY(c.subtitleY)
          if (c.videoScale !== undefined) setVideoScale(c.videoScale)
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
  const saveState = useCallback(() => {
    const payload = {
      name: 'Template 9:16 Oficial',
      layout: 'meme_frame',
      subtitle_preset: selectedSubtitle,
      avatar_url: avatarUrl,
      config: {
        templateBg,
        avatarY,
        headerY,
        titleY,
        videoY,
        subtitleY,
        videoScale,
        brandName,
        brandHandle,
        hasVerified,
        titleText
      }
    }
    try {
      localStorage.setItem('clippost_active_template', JSON.stringify(payload))
    } catch {}
  }, [templateBg, avatarY, headerY, titleY, videoY, subtitleY, videoScale, brandName, brandHandle, hasVerified, titleText, selectedSubtitle, avatarUrl])

  useEffect(() => {
    saveState()
  }, [saveState])

  // Salvar no Supabase
  const handleSave = async () => {
    setSaving(true)
    try {
      saveState()
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
            avatarY,
            headerY,
            titleY,
            videoY,
            subtitleY,
            videoScale,
            brandName,
            hasVerified,
            titleText
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

  // Sistema de Drag and Drop Livre
  const startDrag = (target: 'avatar' | 'header' | 'title' | 'video' | 'subtitle', clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setDraggingTarget(target)
    dragStartY.current = clientY

    if (target === 'avatar') initialElemY.current = avatarY
    else if (target === 'header') initialElemY.current = headerY
    else if (target === 'title') initialElemY.current = titleY
    else if (target === 'video') initialElemY.current = videoY
    else if (target === 'subtitle') initialElemY.current = subtitleY

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!phoneRef.current) return
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      const h = phoneRef.current.clientHeight
      const delta = ((curY - dragStartY.current) / h) * 100
      const nextY = Math.max(2, Math.min(94, initialElemY.current + delta))

      if (target === 'avatar') setAvatarY(Math.round(nextY))
      else if (target === 'header') setHeaderY(Math.round(nextY))
      else if (target === 'title') setTitleY(Math.round(nextY))
      else if (target === 'video') setVideoY(Math.round(nextY))
      else if (target === 'subtitle') setSubtitleY(Math.round(nextY))
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

  const activeSub = SUBTITLE_PRESETS.find(s => s.id === selectedSubtitle) || SUBTITLE_PRESETS[0]

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      {/* Input oculto para upload de imagem */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* HEADER LIMPO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Editor de Template 9:16 - Clipost
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Personalize seu template oficial. Arraste qualquer elemento para posicionar e clique para editar.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAvatarY(5)
              setHeaderY(16)
              setTitleY(24)
              setVideoY(45)
              setSubtitleY(82)
              setVideoScale(88)
              setTemplateBg('white')
              setBrandName('HUMOR DO BICHANO')
              setBrandHandle('@humordobichano')
              setHasVerified(true)
              setTitleText('É assim que o seu título vai aparecer no template quando você fizer uma edição de vídeo')
              setSelectedSubtitle('hormozi_orange')
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20 cursor-pointer active:scale-95"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <CheckCheck className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Template'}
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL DO EDITOR */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 pt-2">
        
        {/* BARRA LATERAL ESQUERDA: CORES DE FUNDO & ATALHOS */}
        <div className="flex lg:flex-col items-center gap-4 bg-[#121216] border border-white/[0.08] p-3.5 rounded-2xl shadow-xl">
          <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider hidden lg:block">
            Fundo
          </span>

          {/* Bolinhas de Cores */}
          <div className="flex lg:flex-col gap-3">
            {/* Branco Padrão */}
            <button
              type="button"
              onClick={() => setTemplateBg('white')}
              title="Branco Padrão (Meme clássico)"
              className={`w-7 h-7 rounded-full bg-white border-2 transition-all cursor-pointer flex items-center justify-center ${
                templateBg === 'white' ? 'border-orange-500 ring-2 ring-orange-500/40 scale-110 shadow-lg' : 'border-zinc-300 hover:scale-105'
              }`}
            >
              {templateBg === 'white' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
            </button>

            {/* Preto OLED */}
            <button
              type="button"
              onClick={() => setTemplateBg('dark')}
              title="Preto OLED"
              className={`w-7 h-7 rounded-full bg-black border-2 transition-all cursor-pointer flex items-center justify-center ${
                templateBg === 'dark' ? 'border-orange-500 ring-2 ring-orange-500/40 scale-110 shadow-lg' : 'border-zinc-700 hover:scale-105'
              }`}
            >
              {templateBg === 'dark' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
            </button>

            {/* Cinza Moderno */}
            <button
              type="button"
              onClick={() => setTemplateBg('gray')}
              title="Cinza Moderno"
              className={`w-7 h-7 rounded-full bg-zinc-800 border-2 transition-all cursor-pointer flex items-center justify-center ${
                templateBg === 'gray' ? 'border-orange-500 ring-2 ring-orange-500/40 scale-110 shadow-lg' : 'border-zinc-600 hover:scale-105'
              }`}
            >
              {templateBg === 'gray' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
            </button>
          </div>

          <div className="w-px h-6 lg:w-6 lg:h-px bg-white/10" />

          {/* Botão de Trocar Foto */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Trocar Foto de Perfil"
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Botão de Trocar Legenda */}
          <button
            type="button"
            onClick={() => setSubtitleModalOpen(true)}
            title="Escolher Estilo de Legenda"
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        {/* CELULAR INTERATIVO (CANVAS 9:16) */}
        <div className="relative flex flex-col items-center">
          
          {/* Indicador de Status Superior */}
          <div className="text-[11px] text-zinc-400 mb-2 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Arraste os elementos para reposicionar livremente
          </div>

          {/* Moldura do Celular */}
          <div className="relative w-[340px] h-[670px] bg-black rounded-[48px] p-3 shadow-2xl ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden select-none">
            
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-40 flex items-center justify-end px-2 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-800" />
            </div>

            {/* Tela Canvas 9:16 */}
            <div
              ref={phoneRef}
              className={`relative flex-1 w-full rounded-[38px] overflow-hidden transition-colors duration-200 ${
                templateBg === 'white'
                  ? 'bg-white text-zinc-900'
                  : templateBg === 'dark'
                  ? 'bg-[#09090b] text-white'
                  : 'bg-zinc-800 text-white'
              }`}
            >
              
              {/* 1. FOTO / AVATAR MÓVEL (SEM BORDA VERMELHA) */}
              <div
                onMouseDown={(e) => startDrag('avatar', e.clientY, e)}
                onTouchStart={(e) => startDrag('avatar', e.touches[0].clientY, e)}
                style={{ top: `${avatarY}%` }}
                className={`absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing z-30 transition-all ${
                  draggingTarget === 'avatar' ? 'ring-2 ring-orange-500 scale-105' : ''
                }`}
                title="Arraste para mover a foto. Clique para trocar."
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-14 h-14 rounded-full overflow-hidden border border-zinc-200/80 shadow-md hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer bg-zinc-100"
                >
                  <img
                    src={avatarUrl}
                    alt="Foto de Perfil"
                    className="w-full h-full object-cover rounded-full"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                    <Camera className="w-3.5 h-3.5" />
                    <span className="text-[7px] font-bold uppercase mt-0.5">Trocar</span>
                  </div>
                </div>
              </div>

              {/* 2. NOME DA PÁGINA + VERIFICADO + @HANDLE MÓVEL */}
              <div
                onMouseDown={(e) => startDrag('header', e.clientY, e)}
                onTouchStart={(e) => startDrag('header', e.touches[0].clientY, e)}
                style={{ top: `${headerY}%` }}
                className={`absolute left-1/2 -translate-x-1/2 w-full px-4 text-center cursor-grab active:cursor-grabbing z-30 flex flex-col items-center ${
                  draggingTarget === 'header' ? 'ring-1 ring-orange-500/50 rounded-lg py-1' : ''
                }`}
                title="Arraste para mover o cabeçalho. Clique nos textos para editar."
              >
                <div className="flex items-center justify-center gap-1">
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
                    title={hasVerified ? 'Selo de verificado ativo (clique para remover)' : 'Sem selo (clique para adicionar)'}
                    className="cursor-pointer hover:scale-125 transition-transform"
                  >
                    {hasVerified ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black shadow-sm">
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

              {/* 3. TÍTULO / GANCHO MÓVEL & EDITÁVEL */}
              <div
                onMouseDown={(e) => startDrag('title', e.clientY, e)}
                onTouchStart={(e) => startDrag('title', e.touches[0].clientY, e)}
                style={{ top: `${titleY}%` }}
                className={`absolute left-1/2 -translate-x-1/2 w-full px-5 text-center cursor-grab active:cursor-grabbing z-30 ${
                  draggingTarget === 'title' ? 'ring-1 ring-orange-500/50 rounded-lg py-1' : ''
                }`}
                title="Arraste para mover o título. Clique para editar o texto."
              >
                <textarea
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="É assim que o seu título vai aparecer no template..."
                  rows={3}
                  className={`w-full font-bold text-xs text-center bg-transparent border border-dashed border-transparent hover:border-orange-500/50 focus:border-orange-500 outline-none rounded-lg p-1 resize-none leading-snug transition-all ${
                    templateBg === 'white' ? 'text-zinc-900' : 'text-zinc-100'
                  }`}
                />
              </div>

              {/* 4. VÍDEO MÓVEL (DRAGGABLE & RESIZABLE) */}
              <div
                onMouseDown={(e) => startDrag('video', e.clientY, e)}
                onTouchStart={(e) => startDrag('video', e.touches[0].clientY, e)}
                style={{
                  top: `${videoY}%`,
                  width: `${videoScale}%`,
                  aspectRatio: '1/1'
                }}
                className={`absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing z-20 group transition-shadow ${
                  draggingTarget === 'video' ? 'ring-4 ring-orange-500/30' : ''
                }`}
                title="Arraste para posicionar o vídeo na tela."
              >
                <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-blue-500 shadow-2xl bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80"
                    alt="Vídeo"
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  {/* Âncora Central de Movimento */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="px-2.5 py-1 rounded-full bg-blue-600/90 text-white text-[9px] font-bold font-mono flex items-center gap-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Move className="w-3 h-3" />
                      Arraste o Vídeo
                    </div>
                  </div>

                  {/* Handles nos Cantos */}
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                  <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white" />
                </div>
              </div>

              {/* 5. LEGENDA INDEPENDENTE & MÓVEL (NÃO FICA PRESA AO VÍDEO) */}
              <div
                onMouseDown={(e) => startDrag('subtitle', e.clientY, e)}
                onTouchStart={(e) => startDrag('subtitle', e.touches[0].clientY, e)}
                style={{ top: `${subtitleY}%` }}
                className={`absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing z-40 flex flex-col items-center select-none group/sub ${
                  draggingTarget === 'subtitle' ? 'scale-105' : ''
                }`}
                title="Arraste para mover a legenda para qualquer lugar da tela. Clique para trocar o estilo!"
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setSubtitleModalOpen(true)
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
                  style={{
                    backgroundColor: activeSub.bgColor || 'rgba(0,0,0,0.85)',
                    color: activeSub.textColor,
                    border: activeSub.borderColor ? `1px solid ${activeSub.borderColor}` : 'none',
                    boxShadow: activeSub.glow || '0 4px 14px rgba(0,0,0,0.6)'
                  }}
                >
                  {activeSub.sampleText}
                </div>

                <span className="text-[8px] font-mono text-white/90 bg-black/70 px-1.5 py-0.5 rounded mt-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                  {activeSub.name} • Clique para trocar estilo
                </span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* MODAL SUSPENSO: SELETOR DE 15+ ESTILOS DE LEGENDAS */}
      {subtitleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-orange-400" />
                  Escolha o Estilo de Legenda
                </h3>
                <p className="text-xs text-zinc-400">Clique para aplicar diretamente no template.</p>
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
                        ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/40'
                        : 'border-white/[0.08] bg-[#16161a] hover:border-white/20'
                    }`}
                  >
                    <div
                      className="px-2 py-0.5 rounded text-[11px] font-black uppercase"
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
        </div>
      )}
    </div>
  )
}
