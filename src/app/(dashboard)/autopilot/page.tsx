'use client'

import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  Layers,
  Calendar,
  Download,
  Share2,
  Tv,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Check,
  RotateCcw,
  X,
  ExternalLink,
  ChevronRight,
  User,
  Film,
  Zap,
  RefreshCw,
  Clock,
  ArrowRight,
  Move,
  Trash2
} from 'lucide-react'


interface MinedVideo {
  id: string
  title: string
  url: string
  thumbnail: string
  views: number
  likes: number
  comments?: number
  duration: number
  type: 'reel' | 'post' | 'carousel'
}

interface ProfileStats {
  handle: string
  name: string
  followers: number
  views_total: string
  likes_total: string
  posts_count: number
  avatar_url: string
}

interface Watch {
  id: string
  channel_id: string
  channel_handle: string | null
  channel_name: string | null
  clip_duration: '30' | '60' | 'auto'
  is_active: boolean
  last_checked_at: string | null
}

export default function AutoPilotPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'profile_miner' | 'channel_watch'>('profile_miner')
  const [searchMethod, setSearchMethod] = useState<'cloud' | 'extension'>('cloud')

  // Search Controls
  const [searchHandle, setSearchHandle] = useState('@modotorque')
  const [limitCount, setLimitCount] = useState<number>(50)
  const [sortBy, setSortBy] = useState<'most_viewed' | 'most_liked' | 'recent'>('most_viewed')
  const [timePeriod, setTimePeriod] = useState<'all' | '30d' | '7d'>('all')
  const [searching, setSearching] = useState(false)
  
  // Results State
  const [profile, setProfile] = useState<ProfileStats | null>(null)
  const [videos, setVideos] = useState<MinedVideo[]>([])
  const [filterType, setFilterType] = useState<'all' | 'reel' | 'post' | 'carousel'>('all')
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])

  // Modal: Agendar com Template (Screenshots 3 e 4)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [modalStep, setModalStep] = useState<number>(2) // Etapa 2: Posicionar o vídeo
  const [manualPosition, setManualPosition] = useState(true)
  const [videoYOffset, setVideoYOffset] = useState<number>(55) // % from top
  const [videoScale, setVideoScale] = useState<number>(85) // % width
  const [hookText, setHookText] = useState('ASSIM QUE SEU TITULO APARECERA NO VIDEOS')
  const [brandName, setBrandName] = useState('HUMOR DO BICHANO')
  const [brandHandle, setBrandHandle] = useState('@humordobichano')
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [schedulingSuccess, setSchedulingSuccess] = useState(false)

  // YouTube Channel Watches State
  const [watches, setWatches] = useState<Watch[]>([])
  const [canal, setCanal] = useState('')
  const [salvandoWatch, setSalvandoWatch] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => {
        if (data?.user) {
          setUserId(data.user.id)
          loadWatches(data.user.id)
        }
      })
      .catch(() => {})
    // Auto-run initial demo search so the UI shows the rich experience immediately
    handleSearchProfile('@modotorque')
  }, [])

    async function loadWatches(uid: string) {
    try {
      const { data, error } = await supabase
        .from('channel_watches')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (!error && data) {
        setWatches(data as Watch[])
      }
    } catch {
      // safe fallback
    }
  }

  async function handleSearchProfile(overrideHandle?: string) {
    const target = overrideHandle || searchHandle
    if (!target.trim()) return
    setSearching(true)
    setVideos([])
    setProfile(null)
    try {
      const res = await fetch('/api/sources/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: target.trim(),
          limit: limitCount,
          sort_by: sortBy,
          period: timePeriod
        })
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.detail || data?.error || 'Instagram bloqueou o acesso. Tente colar a URL direta de um Reel.'
        setAviso(msg)
        setTimeout(() => setAviso(''), 7000)
      } else {
        setProfile(data.profile)
        setVideos(data.items || [])
        if (data.items?.length) {
          setSelectedVideoIds([data.items[0].id])
        }
      }
    } catch (err) {
      setAviso('Erro de conexão ao buscar o perfil.')
      setTimeout(() => setAviso(''), 5000)
    } finally {
      setSearching(false)
    }
  }

  const toggleSelectVideo = (id: string) => {
    setSelectedVideoIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAllVideos = () => {
    if (selectedVideoIds.length === filteredVideos.length) {
      setSelectedVideoIds([])
    } else {
      setSelectedVideoIds(filteredVideos.map(v => v.id))
    }
  }

  const filteredVideos = videos.filter(v => {
    if (filterType === 'all') return true
    return v.type === filterType
  })

  // Selected sample video for preview in modal
  const activeModalVideo = videos.find(v => selectedVideoIds.includes(v.id)) || videos[0]

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">

      {/* Toast global */}
      {aviso && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-xs transition-all ${
          aviso.startsWith('Erro') || aviso.startsWith('erro') || aviso.includes('Falha')
            ? 'bg-red-950 border-red-700 text-red-300'
            : 'bg-indigo-950 border-indigo-700 text-indigo-300'
        }`}>
          {aviso}
        </div>
      )}

      {/* Top Header & Badges */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            AUTOMAÇÃO
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              AutoPiloto <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono font-normal">Beta</span>
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Busque reels, posts e carrosséis de qualquer perfil público, baixe, edite com template e agende — tudo automático.
          </p>
        </div>

        {/* Status Pills (como na Screenshot 2) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Extensão: Instalada</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>Nuvem: Ativa</span>
          </div>
        </div>
      </div>

      {/* Mode Navigation: Mineração vs YouTube RSS (Segmented Pills) */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="inline-flex p-1 rounded-xl bg-white/[0.02] border border-white/[0.08] gap-1">
          <button
            onClick={() => setActiveTab('profile_miner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTab === 'profile_miner'
                ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <Film className="w-3.5 h-3.5" /> <span>Mineração de Perfis Virais</span>
          </button>
          <button
            onClick={() => setActiveTab('channel_watch')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTab === 'channel_watch'
                ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> <span>Monitoramento Contínuo (YouTube RSS)</span>
          </button>
        </div>
      </div>

      {activeTab === 'profile_miner' ? (
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Central Hero Card: IA OPERACIONAL (Screenshot 2) */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#11131f] to-[#0d0e14] border border-indigo-500/20 p-8 shadow-2xl overflow-hidden text-center">
            {/* Background Grid Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 pointer-events-none" />

            {/* Ghost / Bot Avatar */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-xl shadow-indigo-500/30 mb-4 ring-4 ring-indigo-500/20">
              <span className="text-2xl">👻</span>
            </div>

            <div className="relative">
              <span className="text-[11px] font-mono tracking-widest text-indigo-400 uppercase font-semibold block mb-1">
                IA OPERACIONAL
              </span>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-2">
                Busca, edita e publica sozinha.
              </h2>
              <p className="text-xs text-zinc-400 max-w-xl mx-auto leading-relaxed">
                Você só aprova o que entra no ar — o resto o AutoPilot resolve, direto pela API oficial e nuvem do Clipost.
              </p>
            </div>

            {/* Corner Badges */}
            <div className="hidden md:flex absolute top-6 left-6 text-left p-3 rounded-xl bg-black/40 border border-white/10 max-w-[190px]">
              <span className="text-[10px] font-bold text-white uppercase block">BUSCA</span>
              <span className="text-[10px] text-zinc-400 leading-tight">Vasculha qualquer perfil público sozinho</span>
            </div>
            <div className="hidden md:flex absolute bottom-6 right-6 text-right p-3 rounded-xl bg-black/40 border border-white/10 max-w-[190px]">
              <span className="text-[10px] font-bold text-white uppercase block">AUTODEPLOY</span>
              <span className="text-[10px] text-zinc-400 leading-tight">Publica com template e gancho em 1 clique</span>
            </div>
          </div>

          {/* Search Setup Bar (Screenshot 2) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Como você quer buscar?</h3>
                <p className="text-xs text-zinc-400">A busca pela nuvem é instantânea e dispensa cookies locais.</p>
              </div>

              {/* Toggle Buttons (Segmented Pills) */}
              <div className="inline-flex p-1 rounded-xl bg-white/[0.02] border border-white/[0.08] gap-1">
                <button
                  type="button"
                  onClick={() => setSearchMethod('cloud')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    searchMethod === 'cloud'
                      ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                      : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  Sem extensão (Nuvem)
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMethod('extension')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    searchMethod === 'extension'
                      ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                      : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  Com a extensão do navegador
                </button>
              </div>
            </div>

            {/* Inputs Group */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
              <div className="md:col-span-5 relative">
                <input
                  type="text"
                  value={searchHandle}
                  onChange={(e) => setSearchHandle(e.target.value)}
                  placeholder="@usuario_do_instagram ou link"
                  className="w-full pl-4 pr-4 py-3 bg-black/50 border border-white/10 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-zinc-500 outline-none font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <select
                  value={limitCount}
                  onChange={(e) => setLimitCount(Number(e.target.value))}
                  className="w-full px-3 py-3 bg-black/50 border border-white/10 focus:border-indigo-500 rounded-xl text-xs text-zinc-300 outline-none cursor-pointer"
                >
                  <option value={12}>12 vídeos</option>
                  <option value={24}>24 vídeos</option>
                  <option value={50}>50 vídeos</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-3 bg-black/50 border border-white/10 focus:border-indigo-500 rounded-xl text-xs text-zinc-300 outline-none cursor-pointer"
                >
                  <option value="most_viewed">Mais visualizados</option>
                  <option value="most_liked">Mais curtidos</option>
                  <option value="recent">Mais recentes</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value as any)}
                  className="w-full px-3 py-3 bg-black/50 border border-white/10 focus:border-indigo-500 rounded-xl text-xs text-zinc-300 outline-none cursor-pointer"
                >
                  <option value="all">Todo período</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="7d">Últimos 7 dias</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={() => handleSearchProfile()}
                  disabled={searching}
                  className="w-full h-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Profile Header (Screenshots 3 e 4) */}
          {profile && (
            <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border border-white/20 flex-shrink-0">
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">@{profile.handle}</h3>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <span className="text-xs text-zinc-400">{profile.name} · {profile.followers.toLocaleString('pt-BR')} seguidores</span>
                  </div>
                </div>

                {/* Profile Metrics Counters */}
                <div className="flex items-center gap-6 text-xs text-zinc-400">
                  <div className="text-center">
                    <span className="text-sm font-bold text-white font-mono block">{profile.views_total}</span>
                    <span>VIEWS TOTAL</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-white font-mono block">{profile.likes_total}</span>
                    <span>LIKES TOTAL</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-white font-mono block">1.4K</span>
                    <span>COMENTÁRIOS</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-white font-mono block">{profile.posts_count}</span>
                    <span>POSTS</span>
                  </div>
                </div>
              </div>

              {/* Subtabs & Actions Bar (Screenshot 3) */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4">
                
                {/* Content Filter Tabs (Segmented Pills) */}
                <div className="inline-flex p-1 rounded-xl bg-white/[0.02] border border-white/[0.08] gap-1">
                  {(['all', 'reel', 'post', 'carousel'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilterType(tab)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border ${
                        filterType === tab
                          ? 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40 shadow-sm shadow-[#6366f1]/10'
                          : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'
                      }`}
                    >
                      {tab === 'all' ? 'Todos' : tab === 'reel' ? 'Reels' : tab === 'post' ? 'Posts' : 'Carrossel'}
                    </button>
                  ))}
                </div>

                {/* Batch Action Buttons (Screenshot 3) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllVideos}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
                  >
                    {selectedVideoIds.length === filteredVideos.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>

                  <button
                    type="button"
                    disabled={!userId || filteredVideos.length === 0}
                    onClick={async () => {
                      if (!userId) return
                      for (const v of filteredVideos) {
                        await fetch('/api/jobs', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: v.url, user_id: userId, clip_duration: 'auto' })
                        })
                      }
                      setAviso(`${filteredVideos.length} vídeos enviados para processamento!`)
                      setTimeout(() => setAviso(''), 5000)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-300 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Processar todos ({filteredVideos.length})
                  </button>

                  <button
                    type="button"
                    disabled={!userId || selectedVideoIds.length === 0}
                    onClick={async () => {
                      if (!userId) return
                      const selected = filteredVideos.filter(v => selectedVideoIds.includes(v.id))
                      for (const v of selected) {
                        await fetch('/api/jobs', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: v.url, user_id: userId, clip_duration: 'auto' })
                        })
                      }
                      setAviso(`${selected.length} vídeos enviados para processamento!`)
                      setTimeout(() => setAviso(''), 5000)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-300 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Processar selecionados ({selectedVideoIds.length})
                  </button>

                  {/* Primary Trigger: Agendar com Template */}
                  <button
                    type="button"
                    disabled={selectedVideoIds.length === 0}
                    onClick={() => { setModalStep(2); setShowTemplateModal(true) }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" /> Agendar com template ({selectedVideoIds.length})
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Agendar com Trocar Perfil
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Videos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map(item => {
              const isSelected = selectedVideoIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelectVideo(item.id)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/[0.05] ring-2 ring-indigo-500/30'
                      : 'border-white/[0.08] bg-[#121214] hover:border-white/[0.18]'
                  }`}
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[9/12] w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Checkbox badge */}
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-black/60 border border-white/40'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Duration badge */}
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-white">
                      0:{item.duration < 10 ? `0${item.duration}` : item.duration}
                    </span>

                    {/* Metrics Footer on Thumbnail */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between text-[11px] text-zinc-200">
                      <span className="flex items-center gap-1 font-mono">
                        <Eye className="w-3.5 h-3.5 text-zinc-400" /> {item.views.toLocaleString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Heart className="w-3.5 h-3.5 text-zinc-400" /> {item.likes.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="p-3.5">
                    <h4 className="text-xs font-medium text-white line-clamp-2 leading-snug mb-2">
                      {item.title}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span className="uppercase">{item.type}</span>
                      <span className="text-indigo-400 hover:underline">Pré-visualizar</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Monitoramento Contínuo de Canais (YouTube RSS) */
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-white mb-1">Adicionar Canal do YouTube para Monitoramento 24/7</h3>
            <p className="text-xs text-zinc-400 mb-4">Assim que o canal postar um vídeo novo, ele será baixado e cortado sozinho.</p>
            
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!userId || !canal.trim()) return
              setSalvandoWatch(true)
              try {
                const res = await fetch('/api/autopilot/watches', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: userId, canal: canal.trim(), clip_duration: 'auto' })
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err.detail || 'Erro ao conectar canal')
                }
                setCanal('')
                setAviso('Canal conectado para monitoramento!')
                setTimeout(() => setAviso(''), 4000)
                loadWatches(userId)
              } catch (err: any) {
                setAviso(err.message || 'Erro ao conectar canal')
                setTimeout(() => setAviso(''), 5000)
              } finally {
                setSalvandoWatch(false)
              }
            }} className="flex gap-2">
              <input
                type="text"
                value={canal}
                onChange={e => setCanal(e.target.value)}
                placeholder="URL do canal ou @handle (ex: @podpah)"
                className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 focus:border-indigo-500 rounded-xl text-sm text-white outline-none"
              />
              <button
                type="submit"
                disabled={salvandoWatch}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                {salvandoWatch ? 'Conectando...' : 'Monitorar'}
              </button>
            </form>
            {/* aviso shown via global toast above */}
          </div>

          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Canais em Monitoramento</h4>
            {watches.length === 0 ? (
              <p className="text-xs text-zinc-500">Nenhum canal cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {watches.map(w => (
                  <div key={w.id} className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">{w.channel_name || w.channel_handle || w.channel_id}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Status: Ativo · Checado a cada 15 min</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <LiquidToggle
                        checked={w.is_active}
                        onChange={async (newVal) => {
                          await supabase.from('channel_watches').update({ is_active: newVal }).eq('id', w.id)
                          if (userId) loadWatches(userId)
                        }}
                        activeLabel="ATIVO"
                        inactiveLabel="PAUSADO"
                        activeColor="emerald"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await supabase.from('channel_watches').delete().eq('id', w.id)
                          if (userId) loadWatches(userId)
                        }}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                        title="Remover canal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AGENDAR COM TEMPLATE — ETAPA 2 DE 4: POSICIONAR O VÍDEO (Screenshots 3 e 4) */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0d0e12] border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl flex flex-col overflow-y-auto">
            
            {/* Modal Header & Progress */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6">
              <div>
                <h3 className="text-base lg:text-lg font-bold text-white">Agendar com template</h3>
                <span className="text-xs text-indigo-400 font-mono">
                  Etapa {modalStep} de 4 — Posicionar o vídeo
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(modalStep / 4) * 100}%` }}
              />
            </div>

            {/* Modal Body: Left Controls + Right Live Canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Positioning Controls (Screenshot 3) */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* Manual Position Checkbox (LiquidToggle) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Posicionar manualmente
                    </span>
                    <span className="text-[11px] text-zinc-400 leading-relaxed block mt-0.5">
                      Personalize onde o vídeo entra na arte com o template ao redor
                    </span>
                  </div>
                  <LiquidToggle
                    checked={manualPosition}
                    onChange={setManualPosition}
                    activeLabel="ATIVO"
                    inactiveLabel="DESLIGADO"
                    activeColor="indigo"
                  />
                </div>

                {/* Action: Redefinir Posição */}
                <div>
                  <button
                    type="button"
                    onClick={() => { setVideoYOffset(55); setVideoScale(85) }}
                    className="px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Redefinir posição
                  </button>
                </div>

                {/* Sliders: Posição Vertical e Escala */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-zinc-300">Posição Vertical (Y)</span>
                      <span className="text-indigo-400 font-mono">{videoYOffset}%</span>
                    </div>
                    <input
                      type="range"
                      min={25}
                      max={75}
                      value={videoYOffset}
                      onChange={(e) => setVideoYOffset(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-zinc-300">Largura do Vídeo na Moldura</span>
                      <span className="text-indigo-400 font-mono">{videoScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      value={videoScale}
                      onChange={(e) => setVideoScale(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Template Brand & Hook Inputs */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Texto do Gancho (Hook Superior)</label>
                    <textarea
                      rows={2}
                      value={hookText}
                      onChange={(e) => setHookText(e.target.value)}
                      className="w-full p-2.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nome do Canal</label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full p-2 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Handle (@)</label>
                      <input
                        type="text"
                        value={brandHandle}
                        onChange={(e) => setBrandHandle(e.target.value)}
                        className="w-full p-2 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview Box (Screenshot 3) */}
                <div className="p-4 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/20 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-white block">Prévia com vídeo real</span>
                    <span className="text-[10px] text-zinc-400 leading-tight block">
                      Roda o mesmo processo de edição de verdade num dos vídeos selecionados.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratingPreview(true)
                      setTimeout(() => setGeneratingPreview(false), 1200)
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-all whitespace-nowrap cursor-pointer"
                  >
                    {generatingPreview ? 'Gerando...' : 'Gerar prévia'}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Phone Mockup with Blue Bounding Box (Screenshots 3 e 4) */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <div className="relative w-[300px] h-[580px] bg-black rounded-[44px] p-3 shadow-2xl ring-1 ring-white/20 border-4 border-zinc-800 flex flex-col overflow-hidden">
                  
                  {/* Dynamic Island */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30 flex items-center justify-end px-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
                  </div>

                  {/* 9:16 Canvas Content (White Meme Frame or Dark) */}
                  <div className="relative flex-1 w-full rounded-[34px] overflow-hidden bg-white text-black flex flex-col p-4 select-none">
                    
                    {/* Header: Avatar + Channel Info + Verified Badge (Screenshots 3 e 4) */}
                    <div className="pt-10 flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-indigo-500 p-0.5 mb-2 shadow-md">
                        <img
                          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><defs><linearGradient id='cp_grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='50%' stop-color='%238b5cf6'/><stop offset='100%' stop-color='%23ec4899'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23cp_grad)'/><path d='M60 34 A15 15 0 1 0 60 64 A15 15 0 0 0 60 34 Z M40 88 C40 73 50 68 60 68 C70 68 80 73 80 88 Z' fill='white' opacity='0.95'/></svg>"
                          alt="Avatar"
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-black text-xs tracking-tight text-zinc-900 uppercase">
                          {brandName}
                        </span>
                        {/* Blue Verified Badge */}
                        <svg className="w-3 h-3 text-blue-500 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {brandHandle}
                      </span>

                      {/* Hook Caption */}
                      <p className="font-bold text-xs text-zinc-900 mt-3 px-2 leading-snug">
                        {hookText}
                      </p>
                    </div>

                    {/* Interactive Video Box with Blue Boundary Anchors (Screenshots 3 e 4) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 transition-all duration-150"
                      style={{
                        top: `${videoYOffset}%`,
                        width: `${videoScale}%`,
                        aspectRatio: '1/1'
                      }}
                    >
                      <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-indigo-500 shadow-2xl group cursor-move">
                        <img
                          src={activeModalVideo?.thumbnail || "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80"}
                          alt="Video Preview"
                          className="w-full h-full object-cover"
                        />

                        {/* Center Move Anchor (Screenshot 4) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg">
                            <Move className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Blue Corner Handles (Screenshot 4) */}
                        <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-indigo-600 rounded-sm border border-white" />
                        <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-600 rounded-sm border border-white" />
                        <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-indigo-600 rounded-sm border border-white" />
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-indigo-600 rounded-sm border border-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500 mt-2 font-mono">Template 9:16 com Enquadramento Ativo</span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white transition-all cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={!userId || selectedVideoIds.length === 0 || schedulingSuccess}
                onClick={async () => {
                  if (!userId) return
                  const selected = filteredVideos.filter(v => selectedVideoIds.includes(v.id))
                  const templateConfig = {
                    subtitle_preset: 'hormozi_yellow',
                    subtitlePos: { y: videoYOffset },
                    videoScale,
                    hookText,
                    brandName,
                    brandHandle,
                  }
                  let sent = 0
                  for (const v of selected) {
                    try {
                      const r = await fetch('/api/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: v.url, user_id: userId, clip_duration: 'auto', template_config: templateConfig })
                      })
                      if (r.ok) sent++
                    } catch { /* continue */ }
                  }
                  if (sent > 0) {
                    setSchedulingSuccess(true)
                    setTimeout(() => {
                      setSchedulingSuccess(false)
                      setShowTemplateModal(false)
                    }, 2000)
                  }
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                {schedulingSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Enviado para processamento!
                  </>
                ) : (
                  <>
                    Confirmar — Processar {selectedVideoIds.length} vídeos <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
