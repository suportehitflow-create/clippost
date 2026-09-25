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
  Wrench,
  Search,
  ArrowUpRight,
  Video,
  Clock,
  TrendingUp,
  Radio,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'

interface Feature {
  /** id da capa gerada com o Gemini (backend/gerar_capas.py → videos/site/capas/<capa>.png) */
  capa: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  /** degradê de fundo (aparece sozinho enquanto a capa não existe) */
  cor: string
  badge?: string
  wide?: boolean
  /** ocupa a linha inteira da grade */
  inteiro?: boolean
}

// Ordem = ranking das ferramentas (o número do card é a posição)
const FEATURES: Feature[] = [
  { capa: 'cortes', title: 'Criar cortes', description: 'Cole um vídeo longo e receba os melhores momentos em 9:16, com legenda e o seu template.', href: '/upload', icon: Scissors, cor: '99,102,241', wide: true },
  { capa: 'massa', title: 'Edição em Massa', description: 'Dezenas de vídeos no seu template de uma vez: texto, música, legendas e efeitos.', href: '/bulk', icon: Layers, cor: '147,51,234' },
  { capa: 'autopilot', title: 'Autopilot', description: 'Monitora YouTube, Instagram e TikTok e deixa os cortes de cada vídeo novo prontos sozinho.', href: '/autopilot', icon: Zap, cor: '16,185,129', badge: '24/7' },
  { capa: 'templates', title: 'Identidade Visual', description: 'Seu template: perfil, fontes, cores, marca d’água e posição do vídeo e das legendas.', href: '/templates', icon: Sparkles, cor: '236,72,153' },
  { capa: 'explorar', title: 'Explorar perfis', description: 'Digite um @ e veja reels, posts e carrosséis com views e curtidas. Baixe, salve ou edite com o seu template.', href: '/explorar', icon: Search, cor: '14,165,233', badge: 'Novo' },
  { capa: 'aovivo', title: 'Cortes Ao Vivo', description: 'Clipe lives da Twitch e do YouTube até 2 minutos para trás, em um clique.', href: '/live', icon: Radio, cor: '239,68,68', badge: 'Ao vivo' },
  { capa: 'radar', title: 'Radar de Viralidade', description: 'Os vídeos que estão explodindo nas últimas 24h, antes da concorrência.', href: '/trends', icon: Flame, cor: '249,115,22' },
  { capa: 'roteiros', title: 'Roteiros IA', description: 'Roteiros e ganchos com técnicas de retenção e storytelling.', href: '/creator', icon: PenTool, cor: '59,130,246' },
  { capa: 'calendario', title: 'Calendário & Publicações', description: 'Programe as postagens no Instagram, TikTok e YouTube e acompanhe tudo no calendário.', href: '/schedule', icon: Calendar, cor: '245,158,11', wide: true },
  { capa: 'biblioteca', title: 'Biblioteca', description: 'Todos os seus cortes e vídeos exportados, com a ferramenta que gerou cada um.', href: '/dashboard', icon: FolderOpen, cor: '161,161,170' },
  { capa: 'ferramentas', title: 'Ferramentas', description: 'Legenda e hashtags com IA, Raio-X de perfil, YouTube → texto, melhores horários, contador, quebra de linha e limites das redes.', href: '/ferramentas', icon: Wrench, cor: '129,140,248', inteiro: true },
]

const CAPAS_URL = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[﻿​-‍\s]/g, '').replace(/\/$/, '')}/storage/v1/object/public/videos/site/capas`

function FeatureCard({ feature, posicao }: { feature: Feature; posicao: number }) {
  const Icon = feature.icon
  return (
    <Link
      href={feature.href}
      className={`group relative flex flex-col overflow-hidden rounded-[28px] bg-[#0d0d12] border border-white/[0.07] hover:border-white/[0.18] transition-all duration-300 hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        feature.inteiro ? 'sm:col-span-2 lg:col-span-3' : feature.wide ? 'sm:col-span-2' : ''
      }`}
    >
      {/* capa (Gemini) sobre o degradê da ferramenta */}
      <div
        className="relative h-40 sm:h-44 w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
        style={{
          backgroundImage: `url(${CAPAS_URL}/${feature.capa}.png), radial-gradient(120% 90% at 30% 20%, rgba(${feature.cor},0.55), rgba(${feature.cor},0.08) 55%, transparent 80%), linear-gradient(135deg, #15151d, #0b0b10)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/30 to-transparent" />
        <span className="absolute top-3.5 left-4 text-[11px] font-semibold tabular-nums text-white/70 tracking-wide">
          {String(posicao).padStart(2, '0')}
        </span>
        {feature.badge && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white">
            {feature.badge}
          </span>
        )}
      </div>

      <div className="relative flex items-end justify-between gap-4 px-5 pb-5 -mt-7">
        <div className="min-w-0 space-y-1.5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center ring-1 ring-white/20 shadow-lg"
            style={{ background: `linear-gradient(135deg, rgba(${feature.cor},1), rgba(${feature.cor},0.55))` }}
          >
            <Icon className="w-[18px] h-[18px] text-white" />
          </div>
          <h3 className="pt-1.5 text-[17px] font-semibold text-white tracking-tight">{feature.title}</h3>
          <p className="text-[13px] text-zinc-400 leading-snug max-w-md">{feature.description}</p>
        </div>
        <span className="shrink-0 w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-zinc-900 transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </span>
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
          {FEATURES.map((f, i) => <FeatureCard key={f.href} feature={f} posicao={i + 1} />)}
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
