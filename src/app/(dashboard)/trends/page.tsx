'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Flame,
  Search,
  Mic,
  TrendingUp,
  Cpu,
  Brain,
  Smile,
  Scissors,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Eye,
  Radio
} from 'lucide-react'

interface TrendItem {
  id: string
  title: string
  channel: string
  platform: 'youtube' | 'instagram' | 'tiktok' | 'reddit'
  url: string
  thumbnail: string
  views: number
  virality_score: number
  estimated_clips: number
  category: string
  hook_analysis: string
  duration_str: string
}

const INITIAL_TRENDS: TrendItem[] = [
  {
    id: 'trend-pod-1',
    title: 'A verdade cruel sobre trabalhar mais de 12 horas por dia',
    channel: 'Flow Podcast',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80',
    views: 1840000,
    virality_score: 98,
    estimated_clips: 7,
    category: 'podcasts',
    hook_analysis: 'Quebra de expectativa brutal nos primeiros 3 segundos sobre burnout vs ambição.',
    duration_str: '1h 45m',
  },
  {
    id: 'trend-tech-1',
    title: '10 ferramentas de IA que substituem uma agência inteira de graça',
    channel: 'AI Creators Lab',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    views: 3100000,
    virality_score: 99,
    estimated_clips: 10,
    category: 'tech_ai',
    hook_analysis: 'Lista acelerada com prova visual. Cada ferramenta funciona como um mini-corte de 45 segundos.',
    duration_str: '35m',
  },
  {
    id: 'trend-biz-1',
    title: 'Como construir um negócio digital de 1 pessoa que fatura 50k/mês',
    channel: 'Primo Rico & Convidados',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    views: 1200000,
    virality_score: 96,
    estimated_clips: 6,
    category: 'business',
    hook_analysis: 'Promessa tangível com prova social forte. Gera salvamento massivo no Instagram Reels.',
    duration_str: '58m',
  },
  {
    id: 'trend-mind-1',
    title: 'Se você acordar às 5 da manhã sem saber disso, você só vai se cansar',
    channel: 'Alta Performance Podcast',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80',
    views: 2100000,
    virality_score: 97,
    estimated_clips: 8,
    category: 'mindset',
    hook_analysis: 'Contraria o conselho comum do clube das 5 da manhã com embasamento biológico.',
    duration_str: '1h 15m',
  },
  {
    id: 'trend-pod-3',
    title: 'O hábito invisível que destrói sua dopamina todos os dias',
    channel: 'Huberman Lab Brasil',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
    views: 2400000,
    virality_score: 99,
    estimated_clips: 9,
    category: 'podcasts',
    hook_analysis: 'Tom científico e alarmante. Retenção média superior a 85% no primeiro minuto.',
    duration_str: '1h 30m',
  },
  {
    id: 'trend-humor-1',
    title: 'O cliente que tentou dar golpe na loja e se deu muito mal',
    channel: 'Standup & Histórias',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&auto=format&fit=crop&q=80',
    views: 4200000,
    virality_score: 99,
    estimated_clips: 12,
    category: 'humor',
    hook_analysis: 'Timing cômico rápido. História completa que se resolve em menos de 60 segundos.',
    duration_str: '22m',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'Todos os Nichos', icon: Flame },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
  { id: 'business', label: 'Negócios & Riqueza', icon: TrendingUp },
  { id: 'tech_ai', label: 'IA & Tech', icon: Cpu },
  { id: 'mindset', label: 'Mentalidade', icon: Brain },
  { id: 'humor', label: 'Humor & Entretenimento', icon: Smile },
]

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://clippost-backend.fly.dev'

export default function TrendsPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [trends, setTrends] = useState<TrendItem[]>(INITIAL_TRENDS)

  const fetchTrends = async (category: string, query: string) => {
    try {
      const params = new URLSearchParams({ category })
      if (query.trim()) params.set('query', query.trim())
      const res = await fetch(`${BACKEND}/api/trends/explore?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.items) && data.items.length > 0) {
          setTrends(data.items)
        }
      }
    } catch {
      // keep existing trends
    }
  }

  useEffect(() => {
    fetchTrends(selectedCategory, searchQuery)
  }, [selectedCategory])

  const filteredTrends = useMemo(() => {
    return trends.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory
      const matchQuery = !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.hook_analysis.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchQuery
    })
  }, [trends, selectedCategory, searchQuery])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchTrends(selectedCategory, searchQuery)
    setTimeout(() => setIsRefreshing(false), 400)
  }

  const handleQuickCut = (videoUrl: string) => {
    router.push(`/upload?url=${encodeURIComponent(videoUrl)}`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32">
      {/* Header com badge futurista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
              Radar Viral 24/7 Ativo
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Stealth Scraper Conectado
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Radar de Tendências & Ingestão Social
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Descubra conteúdos com pico anormal de engajamento no YouTube, Reddit e Instagram antes que saturem. Escolha qualquer vídeo para recortar e legendar automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar Feed</span>
          </button>
          <Link
            href="/upload"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-semibold text-white flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Importar Link Avulso</span>
          </Link>
        </div>
      </div>

      {/* Metrics Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#121216] border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider block">Score Médio</span>
            <span className="text-base font-bold text-white">97.4% Viral</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121216] border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider block">Redes Rastreadas</span>
            <span className="text-base font-bold text-white">YouTube, X, Reddit</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121216] border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider block">Bypass Anti-Bot</span>
            <span className="text-base font-bold text-white">Cloudflare Safe</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121216] border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider block">Cortes Estimados</span>
            <span className="text-base font-bold text-white">43 Disponíveis</span>
          </div>
        </div>
      </div>

      {/* Busca & Categorias */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquise por tema, criador, podcast ou cole o link direto de um vídeo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#121216] border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const active = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid de Tendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTrends.map(item => (
          <div
            key={item.id}
            className="group rounded-2xl bg-[#121216] border border-white/[0.06] hover:border-indigo-500/30 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5"
          >
            <div>
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {/* Score Pill */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 shadow-lg">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{item.virality_score}% Viral</span>
                </div>

                {/* Duração */}
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-zinc-300 font-mono text-[10px] font-medium">
                  {item.duration_str}
                </div>

                {/* Canal & Views na base da thumb */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                  <span className="font-semibold drop-shadow">{item.channel}</span>
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1 drop-shadow">
                    <Eye className="w-3 h-3" />
                    {(item.views / 1000000).toFixed(1)}M views
                  </span>
                </div>
              </div>

              {/* Detalhes & Análise do Gancho */}
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                  {item.title}
                </h3>

                {/* Hook Insight */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Por que viraliza:
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {item.hook_analysis}
                  </p>
                </div>

                {/* Cortes previstos */}
                <div className="flex items-center justify-between text-xs pt-1 text-zinc-400">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                    <strong className="text-white">{item.estimated_clips}</strong> cortes em potencial
                  </span>
                  <span className="text-[11px] text-zinc-500 uppercase font-mono">
                    {item.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="p-4 pt-0">
              <button
                onClick={() => handleQuickCut(item.url)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Criar Cortes com Este Vídeo</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
