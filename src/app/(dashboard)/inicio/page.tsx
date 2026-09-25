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
  number: string
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
    number: '01',
    title: 'Criar cortes a partir de vídeos longos',
    description: 'Transforme vídeos longos do YouTube ou arquivos MP4 em clipes curtos verticais 9:16 com os melhores momentos e legendas virais automáticas.',
    href: '/upload',
    icon: Scissors,
    badge: 'Ferramenta #1',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    wide: true,
  },
  {
    number: '02',
    title: 'Edição em Massa & Perfis',
    description: 'Editor visual em grade com recorte 9:16, templates de marca e servidor FFmpeg dedicado para processar dezenas de vídeos.',
    href: '/bulk',
    icon: Layers,
    badge: 'Ferramenta #2',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  {
    number: '03',
    title: 'Radar de Viralidade',
    description: 'Monitore vídeos que estão explodindo em engajamento nas últimas 24h para minerar antes da concorrência.',
    href: '/trends',
    icon: Flame,
    badge: 'Ferramenta #3',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  {
    number: '04',
    title: 'Estúdio de Roteiros IA',
    description: 'Gere roteiros persuasivos e ganchos magnéticos estruturados com técnicas de retenção e storytelling.',
    href: '/creator',
    icon: PenTool,
    badge: 'Ferramenta #4',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  {
    number: '05',
    title: 'Identidade Visual & Templates',
    description: 'Configure layout, cores, fontes Apple/Instagram e posições de títulos e legendas para os seus cortes.',
    href: '/templates',
    icon: Sparkles,
    badge: 'Ferramenta #5',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  },
  {
    number: '06',
    title: 'Autopilot 24/7',
    description: 'Monitore canais do YouTube e perfis para minerar, cortar e preparar clipes sozinho a cada novo upload.',
    href: '/autopilot',
    icon: Zap,
    badge: 'Ferramenta #6',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    number: '07',
    title: 'Calendário & Publicações',
    description: 'Agende publicações programadas com legendas prontas e hashtags direto para Instagram, TikTok e Shorts.',
    href: '/schedule',
    icon: Calendar,
    badge: 'Ferramenta #7',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    number: '08',
    title: 'Meus Projetos & Vídeos',
    description: 'Acesse todo o histórico de vídeos processados, transcrições e cortes renderizados prontos para download.',
    href: '/dashboard',
    icon: FolderOpen,
    badge: 'Histórico',
    badgeColor: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-mono font-bold text-zinc-500 group-hover:text-indigo-400 transition-colors">
            #{feature.number}
          </span>
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
    { count: scheduledCount },
    { data: processingProjects }
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('clips').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'scheduled'),
    supabase.from('projects').select('id, title, status, created_at, error_message').eq('user_id', user.id).eq('status', 'processing').order('created_at', { ascending: false }).limit(3)
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
              <span>Motor de IA de Cortes Ativo</span>
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

        {/* Live Processing Card (Quando há cortes sendo gerados) */}
        {processingProjects && processingProjects.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Cortes Gerando em Segundo Plano ({processingProjects.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {processingProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-[#0d0d14] border border-indigo-500/30 hover:border-indigo-500/60 shadow-lg shadow-indigo-950/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-indigo-400 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">
                          {p.title || "Vídeo sem título"}
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 whitespace-nowrap flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          Gerando cortes...
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        A IA está analisando ganchos virais e renderizando seus cortes 9:16.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 transition-colors">
                      Acompanhar corte <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

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
