'use client'

import Link from 'next/link'
import {
  Scissors,
  Zap,
  Calendar,
  Download,
  ArrowRight,
  Check,
  Flame,
  Sparkles,
  Smartphone,
  Layers,
  Play,
  TrendingUp,
  ShieldCheck,
  Star,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Clock,
  Video
} from 'lucide-react'
import { useState } from 'react'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'creators' | 'agencies' | 'podcasts'>('creators')

  return (
    <div className="min-h-screen bg-[#060608] text-[#f4f4f6] font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[20%] left-[20%] w-[350px] h-[350px] bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="absolute top-[25%] right-[20%] w-[350px] h-[350px] bg-purple-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '36px 36px',
        }}
      />

      {/* Header / Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060608]/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center">
              clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">ost</span>
              <span className="ml-2 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                v3.0
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <Link href="#recursos" className="hover:text-white transition-colors">Recursos</Link>
            <Link href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</Link>
            <Link href="#modelos" className="hover:text-white transition-colors">Estilos de Legenda</Link>
            <Link href="#planos" className="hover:text-white transition-colors">Preços</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 text-zinc-300 hover:text-white hover:bg-white/[0.04] rounded-xl transition-all"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-all shadow-md shadow-white/10 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Começar Grátis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>IA de Mineração Acústica & Enquadramento 9:16</span>
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400/70" />
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-white">
            Transforme vídeos longos em{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              cortes virais magnéticos
            </span>{' '}
            em minutos.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Cole links do YouTube ou envie podcasts. A IA detecta os pontos de mais alta retenção, centraliza os rostos em 9:16, queima legendas estilo Hormozi e agenda diretamente para o seu feed.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ring-1 ring-white/20"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Gerar Meus Primeiros Cortes Grátis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="#como-funciona"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-zinc-400" />
              <span>Ver Demonstração</span>
            </Link>
          </div>

          {/* Social Proof Mini Bar */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Sem necessidade de cartão</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Renderização 60fps 1080x1920</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Transcrições Groq Whisper</span>
            </div>
          </div>
        </div>

        {/* Live Interactive Mockup Showcase */}
        <div className="mt-14 max-w-4xl mx-auto rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="bg-[#0b0b10] rounded-2xl p-6 sm:p-8 border border-white/[0.06] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Phone Mockup Screen */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative w-[240px] sm:w-[260px] h-[460px] sm:h-[500px] bg-black rounded-[36px] p-2 border-4 border-zinc-800 ring-1 ring-white/10 shadow-2xl overflow-hidden flex flex-col justify-between">
                
                {/* Header Mock */}
                <div className="flex items-center justify-between px-3 pt-2 text-[10px] text-zinc-400 font-mono z-10">
                  <span>9:41</span>
                  <div className="w-16 h-3 bg-zinc-900 rounded-full" />
                  <span>5G 100%</span>
                </div>

                {/* Simulated Viral Video Center */}
                <div className="relative flex-1 rounded-[26px] overflow-hidden my-1 bg-gradient-to-br from-indigo-950/70 via-black to-zinc-950 flex flex-col items-center justify-center p-4 text-center">
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center text-[7px] font-bold text-white">C</div>
                    <span className="text-[9px] font-mono text-white/90">@clipost_oficial</span>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-2 shadow-inner">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>

                  {/* Hormozi Animated Caption Badge */}
                  <div className="mt-8 px-3.5 py-1.5 rounded-xl bg-yellow-400 text-black font-black text-xs uppercase tracking-tight shadow-xl shadow-yellow-400/20 transform -rotate-1 animate-bounce">
                    O SEGREDO VIRAL ⚡
                  </div>

                  {/* Virality Pill Floating */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-[9px] font-mono text-zinc-400 px-2 py-1 rounded-lg bg-black/70 border border-white/10">
                    <span className="text-indigo-400 font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3 text-indigo-400" /> 98% Retenção
                    </span>
                    <span>48s</span>
                  </div>
                </div>

                {/* Bottom Bar Mock */}
                <div className="w-24 h-1 bg-white/30 rounded-full mx-auto pb-1" />
              </div>
            </div>

            {/* Features Description Alongside Mockup */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
                  ESTÚDIO DE AUTOMAÇÃO EM ALTA DEFINIÇÃO
                </span>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Tudo o que você precisa para dominar o algoritmo de vídeos curtos.
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Deixe a edição manual de horas no passado. O Clipost executa o trabalho pesado de dezenas de editores em poucos segundos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>IA Curadora</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Identifica os momentos de fala com maior potencial de compartilhamento e retenção.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-semibold">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Legendas Virais</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    16 estilos prontos (Hormozi, Apple Minimal, Karaokê, Neon) com suporte a emojis.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-semibold">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Enquadramento 9:16</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Recorte vertical inteligente que mantém quem está falando no centro exato da tela.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Post Automático</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Agende posts direto para Instagram Reels, TikTok e YouTube Shorts sem sair do app.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>Experimentar minerador de links agora</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="border-y border-white/[0.06] bg-white/[0.01] py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">10x</span>
            <p className="text-xs text-zinc-400">Mais rápido que edição manual</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-indigo-400 tracking-tight">60fps</span>
            <p className="text-xs text-zinc-400">Renderização fluida em 1080x1920</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">16+</span>
            <p className="text-xs text-zinc-400">Estilos de legendas e templates</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-purple-400 tracking-tight">100%</span>
            <p className="text-xs text-zinc-400">Nuvem e pronto para publicação</p>
          </div>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section id="como-funciona" className="py-20 px-6 max-w-7xl mx-auto space-y-14">
        <div className="text-center max-w-xl mx-auto space-y-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
            FLUXO SIMPLES E PODEROSO
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Como o Clipost funciona
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Três passos do link bruto até a publicação com visual cinematográfico.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-lg">
              01
            </div>
            <h3 className="text-base font-bold text-white">Importe ou Cole o Link</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Aceitamos links diretos do YouTube, Reels, TikTok ou upload de arquivos locais MP4 de podcasts e aulas gravadas.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-lg">
              02
            </div>
            <h3 className="text-base font-bold text-white">Mineração & Corte por IA</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O modelo acústico transcreve com precisão de milissegundos, encontra ganchos de alta retenção e queima as legendas no seu template de marca.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-black text-lg">
              03
            </div>
            <h3 className="text-base font-bold text-white">Baixe ou Agende nas Redes</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Baixe individualmente, exporte em lote ou programe no calendário integrado para publicação automática sem precisar logar em cada rede.
            </p>
          </div>
        </div>
      </section>

      {/* Planos Section */}
      <section id="planos" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-xl mx-auto space-y-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
            PLANOS TRANSPARENTES
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Escolha o plano ideal para a sua produção
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Cancele a qualquer momento. Sem pegadinhas ou cobranças ocultas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">Iniciante</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">R$ 0</span>
                <span className="text-xs text-zinc-500">/mês</span>
              </div>
              <p className="text-xs text-zinc-400">Perfeito para testar e validar o potencial dos seus vídeos.</p>
              
              <ul className="space-y-2.5 text-xs text-zinc-300 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>5 cortes mensais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Vídeos de até 20 minutos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Legendas dinâmicas automáticas</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-bold text-center transition-all cursor-pointer"
            >
              Começar Grátis
            </Link>
          </div>

          {/* Pro Tier (Highlighted) */}
          <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-indigo-900/40 via-[#0d0d16] to-[#07070b] border-2 border-indigo-500/60 shadow-2xl shadow-indigo-500/20 flex flex-col justify-between space-y-6">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-[10px] uppercase tracking-wider shadow-md">
              Mais Escolhido
            </div>

            <div className="space-y-4 pt-1">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-400">Criador Pro</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">R$ 49</span>
                <span className="text-xs text-zinc-400">/mês</span>
              </div>
              <p className="text-xs text-zinc-300">Para criadores e páginas que precisam de postagens consistentes.</p>
              
              <ul className="space-y-2.5 text-xs text-zinc-200 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>100 cortes gerados por mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sem marca d&apos;água</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Agendamento automático em redes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Todos os 16 estilos de legendas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Prioridade de renderização 60fps</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold text-center shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Assinar Plano Pro
            </Link>
          </div>

          {/* Agency Tier */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">Agências & Podcasts</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">R$ 149</span>
                <span className="text-xs text-zinc-500">/mês</span>
              </div>
              <p className="text-xs text-zinc-400">Escala industrial com múltiplos perfis e edição em massa.</p>
              
              <ul className="space-y-2.5 text-xs text-zinc-300 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cortes ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edição em lote e perfis ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Autopilot para monitorar canais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Suporte prioritário via WhatsApp</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-bold text-center transition-all cursor-pointer"
            >
              Contratar Escala
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-12 px-6 bg-[#040406]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Scissors className="w-3 h-3" />
            </div>
            <span className="font-bold text-zinc-300">Clipost</span>
            <span>— A Plataforma Definitiva de Vídeos Curtos</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Entrar</Link>
            <Link href="/signup" className="hover:text-zinc-300 transition-colors">Criar Conta</Link>
            <Link href="/templates" className="hover:text-zinc-300 transition-colors">Templates</Link>
          </div>

          <div>
            <span>© 2026 Clipost. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
