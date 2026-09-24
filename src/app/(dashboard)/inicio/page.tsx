import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import {
  Scissors, Flame, PenTool, Layers, Sparkles, Zap, Calendar, Settings, FolderOpen, ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'

interface Feature {
  title: string
  description: string
  href: string
  icon: LucideIcon
  wide?: boolean
}

const FEATURES: Feature[] = [
  {
    title: 'Criar Cortes',
    description: 'Cole o link de um vídeo longo e receba cortes verticais com legenda, título e o seu template.',
    href: '/upload',
    icon: Scissors,
    wide: true,
  },
  {
    title: 'Edição em Massa',
    description: 'Aplique seu template em vários vídeos ou em um perfil inteiro de uma vez.',
    href: '/bulk',
    icon: Layers,
  },
  {
    title: 'Radar Viral',
    description: 'Veja o que está em alta para cortar antes de todo mundo.',
    href: '/trends',
    icon: Flame,
  },
  {
    title: 'Roteiros IA',
    description: 'Gere roteiros prontos para gravar, com ganchos que prendem.',
    href: '/creator',
    icon: PenTool,
  },
  {
    title: 'Templates',
    description: 'Monte a identidade visual que vai em todos os cortes.',
    href: '/templates',
    icon: Sparkles,
  },
  {
    title: 'Autopilot',
    description: 'Monitore canais e gere cortes sozinho a cada vídeo novo.',
    href: '/autopilot',
    icon: Zap,
  },
  {
    title: 'Agendamentos',
    description: 'Programe as postagens nas suas redes sociais.',
    href: '/schedule',
    icon: Calendar,
  },
  {
    title: 'Meus Projetos',
    description: 'Todos os vídeos que você já enviou e os cortes gerados.',
    href: '/dashboard',
    icon: FolderOpen,
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  return (
    <Link
      href={feature.href}
      className={`group relative flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        feature.wide ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-md">{feature.description}</p>
      </div>
    </Link>
  )
}

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c]">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-white tracking-wide">Início</h1>
        <ProfileSwitcher userId={user.id} align="center" />
        <span />
      </header>

      <div className="max-w-5xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white text-balance">O que vamos criar hoje?</h2>
          <p className="text-sm text-zinc-400">Escolha uma ferramenta para começar.</p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => <FeatureCard key={f.href} feature={f} />)}
        </section>

        <Link
          href="/settings"
          className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
            <Settings className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Ajustes</h3>
            <p className="text-xs text-zinc-400">Conta, redes conectadas, plano e preferências.</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
        </Link>
      </div>
    </div>
  )
}
