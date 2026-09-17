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

export type VideoLayoutType = 'single_speaker' | 'split_screen' | 'screen_react' | 'meme_frame'

// 18+ Subtitle Styles (matching Screenshot 5)
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
    id: 'electric_green',
    name: 'Electric Green',
    tag: 'Crypto / Fin',
    badgeColor: '#22c55e',
    textColor: '#4ade80',
    glow: '0 0 10px rgba(34,197,94,0.7)',
    sampleText: 'HEY THERE'
  },
  {
    id: 'clean_white_box',
    name: 'Clean White Box',
    tag: 'Corporativo',
    badgeColor: '#ffffff',
    textColor: '#09090b',
    bgColor: '#ffffff',
    sampleText: 'Hey there'
  },
  {
    id: 'dark_box',
    name: 'Dark Box',
    tag: 'Minimalista',
    badgeColor: '#27272a',
    textColor: '#ffffff',
    bgColor: '#18181b',
    borderColor: '#3f3f46',
    sampleText: 'Hey there'
  },
  {
    id: 'two_tone_purple',
    name: 'Two Tone Purple',
    tag: 'Moderno',
    badgeColor: '#a855f7',
    textColor: '#c084fc',
    sampleText: 'TO GET STARTED'
  },
  {
    id: 'two_tone_orange',
    name: 'Two Tone Sunset',
    tag: 'Energia',
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
  }
]

export default function TemplatesPageEnhanced() {
  const supabase = createClient()

  // Layout & Positioning (Screenshots 3 e 4)
  const [selectedLayout, setSelectedLayout] = useState<VideoLayoutType>('meme_frame')
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('hormozi_orange')
  
  // Interactive Frame Positioning
  const [videoYOffset, setVideoYOffset] = useState<number>(55) // % from top
  const [videoScale, setVideoScale] = useState<number>(85) // % width
  const [hookText, setHookText] = useState('Meu maior arrependimento foi não ter seguido essa página antes 😭😭')
  const [brandName, setBrandName] = useState('HUMOR DO BICHANO')
  const [brandHandle, setBrandHandle] = useState('@humordobichano')
  const [avatarPreview, setAvatarPreview] = useState<string | null>('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80')
  const [isDefault, setIsDefault] = useState(true)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [activeWordIdx, setActiveWordIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live word simulation in preview
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clippost_active_template');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.layout) setSelectedLayout(parsed.layout);
        if (parsed.subtitle_preset) setSelectedSubtitle(parsed.subtitle_preset);
        if (parsed.config?.videoYOffset) setVideoYOffset(parsed.config.videoYOffset);
        if (parsed.config?.videoScale) setVideoScale(parsed.config.videoScale);
        if (parsed.config?.hookText) setHookText(parsed.config.hookText);
        if (parsed.config?.brandName) setBrandName(parsed.config.brandName);
        if (parsed.config?.brandHandle) setBrandHandle(parsed.config.brandHandle);
      }
    } catch {}

    async function loadRemote() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: bk } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle();
        if (bk?.layout_config) {
          const cfg = bk.layout_config;
          if (cfg.layout) setSelectedLayout(cfg.layout);
          if (cfg.subtitle_preset) setSelectedSubtitle(cfg.subtitle_preset);
          if (cfg.videoYOffset) setVideoYOffset(cfg.videoYOffset);
          if (cfg.videoScale) setVideoScale(cfg.videoScale);
          if (cfg.hookText) setHookText(cfg.hookText);
          if (cfg.brandName) setBrandName(cfg.brandName);
          if (bk.username) setBrandHandle(bk.username);
        }
      } catch {}
    }
    loadRemote();

    const timer = setInterval(() => {
      setActiveWordIdx(prev => (prev + 1) % 4);
    }, 450);
    return () => clearInterval(timer);
  }, [])

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        name: 'Template Meme & Posicionamento 9:16',
        layout: selectedLayout,
        layout_type: selectedLayout,
        subtitle_preset: selectedSubtitle,
        username: brandHandle,
        avatar_url: avatarPreview,
        is_default: isDefault,
        config: {
          videoYOffset,
          videoScale,
          hookText,
          brandName,
          brandHandle
        },
        updated_at: new Date().toISOString()
      };

      // 1. Sempre salva localmente
      try {
        localStorage.setItem('clippost_active_template', JSON.stringify(payload));
        window.dispatchEvent(new Event('clippost_template_updated'));
      } catch (err) {}

      // 2. Salva em brand_kits no Supabase
      if (user) {
        await supabase.from('brand_kits').upsert({
          user_id: user.id,
          username: brandHandle,
          avatar_url: avatarPreview,
          layout_config: {
            ...payload.config,
            layout: selectedLayout,
            subtitle_preset: selectedSubtitle
          },
          updated_at: new Date().toISOString()
        });

        // 3. Tenta tabela templates se existir
        await supabase.from('templates').upsert({
          user_id: user.id,
          ...payload
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.warn('Erro ao salvar template:', e);
    } finally {
      setSaving(false);
    }
  }

  const activeSubPreset = SUBTITLE_PRESETS_18.find(s => s.id === selectedSubtitle) || SUBTITLE_PRESETS_18[0]

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">
      
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
        <div>
          <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 inline-flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3 h-3" /> Templates Globais & Enquadramento
          </span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Modelos de Vídeo, Posição & Legendas
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Configure a área exata onde o vídeo entra na arte 9:16 e selecione entre 18+ estilos de legendas virais calibradas para alta retenção.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {savedSuccess ? 'Salvo como Padrão!' : 'Salvar como Padrão'}
        </button>
      </div>

      {/* Main Grid: Left Controls (7 cols) + Right Live Phone (5 cols) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Layouts, Posicionamento e Legendas */}
        <div className="lg:col-span-7 space-y-8">

          {/* SECTION 1: LAYOUT SELECTION */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-white mb-1">1. Formato do Template</h2>
            <p className="text-xs text-zinc-400 mb-4">Escolha a moldura de exibição para o vídeo vertical 9:16.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'meme_frame' as VideoLayoutType, title: 'Moldura Viral (Meme/Hook)', badge: 'Mais Usado', desc: 'Avatar, nome da página e texto em cima com o vídeo encaixado.' },
                { id: 'split_screen' as VideoLayoutType, title: 'Split Screen (50/50)', badge: 'Podcasts', desc: 'Tela dividida entre convidado e entrevistador com rastreamento.' },
                { id: 'single_speaker' as VideoLayoutType, title: 'Full 9:16 Sem Borda', badge: 'Solo Focus', desc: 'Preenchimento total da tela vertical mantendo o rosto no centro.' }
              ].map(lay => {
                const isSelected = selectedLayout === lay.id
                return (
                  <button
                    key={lay.id}
                    type="button"
                    onClick={() => setSelectedLayout(lay.id)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/[0.08] border-orange-500/50 shadow-md ring-1 ring-orange-500/30'
                        : 'bg-black/30 border-white/[0.06] hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 block w-fit mb-2">
                      {lay.badge}
                    </span>
                    <h3 className="text-xs font-bold text-white mb-1">{lay.title}</h3>
                    <p className="text-[11px] text-zinc-400 leading-snug">{lay.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* SECTION 2: ENQUADRAMENTO E POSICIONAMENTO MANUAL (Screenshots 3 e 4) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">2. Posicionamento do Vídeo na Arte</h2>
                <p className="text-xs text-zinc-400">Arraste os seletores para definir onde o vídeo entra na tela.</p>
              </div>
              <button
                type="button"
                onClick={() => { setVideoYOffset(55); setVideoScale(85) }}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Redefinir posição
              </button>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-zinc-300">Posição Vertical (Y)</span>
                  <span className="text-orange-400 font-mono">{videoYOffset}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={70}
                  value={videoYOffset}
                  onChange={e => setVideoYOffset(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-zinc-300">Largura / Escala</span>
                  <span className="text-orange-400 font-mono">{videoScale}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={100}
                  value={videoScale}
                  onChange={e => setVideoScale(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Identidade Visual da Moldura (Avatar, Nome, Gancho) */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Texto do Gancho (Hook)</label>
                <textarea
                  rows={2}
                  value={hookText}
                  onChange={e => setHookText(e.target.value)}
                  className="w-full p-2.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nome da Página</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">@ Handle</label>
                  <input
                    type="text"
                    value={brandHandle}
                    onChange={e => setBrandHandle(e.target.value)}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: 18+ ESTILOS DE LEGENDAS VIRAIS (Screenshot 5) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">3. Estilos de Legendas Dinâmicas</h2>
                <p className="text-xs text-zinc-400">Clique em qualquer estilo para aplicar instantaneamente na prévia ao vivo.</p>
              </div>
              <span className="text-xs text-orange-400 font-mono font-bold">18 Presets</span>
            </div>

            {/* Grid 3x6 (Screenshot 5) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-1">
              {SUBTITLE_PRESETS_18.map(sub => {
                const isSelected = selectedSubtitle === sub.id
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubtitle(sub.id)}
                    className={`relative p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center items-center min-h-[72px] ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/[0.08] ring-2 ring-emerald-500/40'
                        : 'border-white/[0.08] bg-[#16161a] hover:border-white/20'
                    }`}
                  >
                    {/* Visual Button Display */}
                    <div
                      className="px-2.5 py-1 rounded-md text-xs font-black tracking-tight uppercase"
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

        {/* Right Column: Live Phone Mockup with Blue Bounding Box (Screenshots 3 e 4) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" /> Prévia do Template 9:16
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-mono">
              Interativo
            </span>
          </div>

          {/* iPhone 16 Pro Frame */}
          <div className="relative w-[300px] h-[580px] bg-black rounded-[44px] p-3 shadow-2xl ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30 flex items-center justify-end px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
            </div>

            {/* Screen Canvas (9:16) */}
            <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-white text-black flex flex-col p-4 select-none">
              
              {/* Header: Avatar + Channel Info + Verified Badge (Screenshots 3 e 4) */}
              <div className="pt-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-red-500 p-0.5 mb-1.5 shadow-md">
                  <img
                    src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80"
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                
                <div className="flex items-center justify-center gap-1">
                  <span className="font-black text-xs tracking-tight text-zinc-900 uppercase">
                    {brandName}
                  </span>
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black">
                    ✓
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {brandHandle}
                </span>

                {/* Hook Caption */}
                <p className="font-bold text-xs text-zinc-900 mt-2 px-2 leading-snug">
                  {hookText}
                </p>
              </div>

              {/* Video Box with Blue Boundary Anchors (Screenshots 3 e 4) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 transition-all duration-150"
                style={{
                  top: `${videoYOffset}%`,
                  width: `${videoScale}%`,
                  aspectRatio: '1/1'
                }}
              >
                <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-blue-500 shadow-2xl group cursor-move">
                  <img
                    src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80"
                    alt="Video Preview"
                    className="w-full h-full object-cover"
                  />

                  {/* Center Move Anchor (Screenshot 4) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg">
                      <Move className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Corner Handles */}
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-blue-600 rounded-sm border border-white" />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-sm border border-white" />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-blue-600 rounded-sm border border-white" />
                  <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-sm border border-white" />
                </div>
              </div>

              {/* Dynamic Live Subtitle Preview in Canvas (Screenshot 5) */}
              <div className="absolute bottom-6 inset-x-3 z-30 text-center pointer-events-none">
                <div
                  className="inline-block px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-tight shadow-xl"
                  style={{
                    backgroundColor: activeSubPreset.bgColor || 'rgba(0,0,0,0.85)',
                    color: activeSubPreset.textColor,
                    border: activeSubPreset.borderColor ? `1px solid ${activeSubPreset.borderColor}` : 'none',
                    boxShadow: activeSubPreset.glow || '0 4px 12px rgba(0,0,0,0.5)'
                  }}
                >
                  {activeSubPreset.sampleText}
                </div>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 mt-2 font-mono">Mockup 9:16 Full HD (1080x1920)</span>
        </div>
      </div>
    </div>
  )
}
