import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import {
  Scissors,
  Flame,
  PenTool,
  Layers,
  Sparkles,
  Zap,
  Calendar,
  Settings,
  FolderOpen,
  ArrowUpRight,
  Video,
  Clock,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'

interface Feature {
  title: string
  description: string
  href: string
  icon: LucideIcon
  badge?: string
  badgeColor?: string
  wide?: boolean
}

const FEATURES: Feature[] = [
  {
    title: 'Criar Novos Cortes 9:16',
    description: 'Cole o link do YouTube, Reels ou TikTok. A IA detecta os pontos de retenção máxima e corta no formato vertical com legendas virais.',
    href: '/upload',
    icon: Scissors,
    badge: 'Mais Usado',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    wide: true,
  },
  {
    title: 'Edição em Massa & Perfis',
    description: 'Aplique seu template oficial em dezenas de vídeos ou raspe um perfil inteiro de uma vez só.',
    href: '/bulk',
    icon: Layers,
    badge: 'Escala',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  {
    title: 'Radar de Viralidade',
    description: 'Monitore vídeos que estão explodindo em engajamento nas últimas 24h para minerar antes da concorrência.',
    href: '/trends',
    icon: Flame,
    badge: 'Tempo Real',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  {
    title: 'Estúdio de Roteiros IA',
    description: 'Gere roteiros persuasivos e ganchos magnéticos estruturados com técnicas de retenção e storytelling.',
    href: '/creator',
    icon: PenTool,
  },
  {
    title: 'Identidade Visual & Templates',
    description: 'Configure layout, cores, fontes Apple/Instagram e posições de títulos e legendas para os seus cortes.',
    href: '/templates',
    icon: Sparkles,
  },
  {
    title: 'Autopilot 24/7',
    description: 'Monitore canais do YouTube e perfis para minerar, cortar e preparar clipes sozinho a cada novo upload.',
    href: '/autopilot',
    icon: Zap,
    badge: 'Automático',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    title: 'Calendário & Publicações',
    description: 'Agende publicações programadas com legendas prontas e hashtags direto para Instagram, TikTok e Shorts.',
    href: '/schedule',
    icon: Calendar,
  },
  {
    title: 'Meus Projetos & Vídeos',
    description: 'Acesse todo o histórico de vídeos processados, transcrições acústicas e cortes renderizados prontos para download.',
    href: '/dashboard',
    icon: FolderOpen,
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  return (
    <Link
      href={feature.href}
      className={`group relative flex flex-col justify-between gap-5 p-6 rounded-3xl bg-white/[0.02] border border-white/[0.07] hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        feature.wide ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          {feature.badge && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${feature.badgeColor}`}>
              {feature.badge}
            </span>
          )}
          <div className="w-7 h-7 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-white/[0.08] transition-all">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-white tracking-tight group-hover:text-indigo-200 transition-colors">
          {feature.title}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed font-normal">
          {feature.description}
        </p>
      </div>
    </Link>
  )
}

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Métricas do usuário em tempo real
  const [
    { count: projectCount },
    { count: clipCount },
    { count: scheduledCount }
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('clips').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'scheduled')
  ])

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-white/[0.06] grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <h1 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Clipost Studio
          </h1>
        </div>
        <ProfileSwitcher userId={user.id} align="center" />
        <div className="flex justify-end">
          <Link
            href="/settings"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span>Ajustes</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto p-6 md:p-10 space-y-8">
        
        {/* Welcome & Stats Ribbon */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-300">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Pipeline Acústico Groq Whisper Turbo Ativo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Painel de Criação Viral
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Gerencie cortes de alto impacto, automações contínuas e publicações programadas.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">Vídeos</span>
              <span className="text-lg font-bold text-white font-mono">{projectCount || 0}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">Cortes</span>
              <span className="text-lg font-bold text-indigo-400 font-mono">{clipCount || 0}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">Agendados</span>
              <span className="text-lg font-bold text-purple-400 font-mono">{scheduledCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => <FeatureCard key={f.href} feature={f} />)}
        </section>

        {/* Bottom Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Dica de Retenção
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">
              Vídeos com legendas de alto contraste (Hormozi Amarelo ou Clean White) e ganchos nos primeiros 3 segundos têm <strong>4.2x mais tempo de exibição</strong> no Reels e TikTok.
            </p>
          </div>
          <Link
            href="/templates"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-all text-center"
          >
            Personalizar Meu Template
          </Link>
        </div>

      </div>
    </div>
  )
}
