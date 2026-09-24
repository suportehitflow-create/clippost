'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Zap, Check, CreditCard, Sparkles, ArrowLeft, ShieldCheck, ArrowRight } from 'lucide-react'

interface PlanStatus {
  plan: 'free' | 'pro'
  clips_used: number
  clips_limit: number
  period_reset: string | null
  stripe_customer_id: string | null
}

export default function BillingPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const upgraded = searchParams?.get('success') === '1'
  const canceled = searchParams?.get('canceled') === '1'

  useEffect(() => {
    async function loadPlan() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUserId(data.user.id)
        setEmail(data.user.email ?? null)
        try {
          const { data: planData } = await supabase
            .from('user_plans')
            .select('*')
            .eq('user_id', data.user.id)
            .single()

          if (planData) {
            setStatus({
              plan: (planData.plan === 'free' ? 'free' : 'pro'),
              clips_used: planData.clips_used_this_month ?? 0,
              clips_limit: planData.clips_limit ?? 9999,
              period_reset: planData.period_reset ?? null,
              stripe_customer_id: planData.stripe_customer_id ?? null,
            })
          } else {
            setStatus({
              plan: 'pro',
              clips_used: 0,
              clips_limit: 9999,
              period_reset: null,
              stripe_customer_id: null,
            })
          }
        } catch {
          setStatus({
            plan: 'pro',
            clips_used: 0,
            clips_limit: 9999,
            period_reset: null,
            stripe_customer_id: null,
          })
        }
      }
    }
    loadPlan()
  }, [])

  async function handleUpgrade() {
    if (!userId || !email) return
    setLoading(true)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, email }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  async function handlePortal() {
    if (!userId) return
    setLoading(true)
    const res = await fetch(`/api/billing/portal/${userId}`)
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    }
    setLoading(false)
  }

  const isPro = status?.plan === 'pro'
  const usedPct = status ? Math.min(100, (status.clips_used / Math.max(status.clips_limit, 1)) * 100) : 0
  const resetDate = status?.period_reset ? new Date(status.period_reset).toLocaleDateString('pt-BR') : null

  return (
    <div className="min-h-screen bg-[#060608] text-[#ededed] font-sans">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/inicio"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono">Faturamento Seguro Stripe</span>
          </div>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Plano & Faturamento
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Gerencie sua assinatura, limites mensais de cortes e faturas.
          </p>
        </div>

        {/* Alerts */}
        {upgraded && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>Upgrade realizado com sucesso! Bem-vindo ao Clippost Pro.</span>
          </div>
        )}
        {canceled && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>Pagamento cancelado. Nenhuma cobrança foi efetuada.</span>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-[#0e0e13]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Assinatura Atual</span>
                <h3 className="text-lg font-bold text-white">
                  {isPro ? 'Plano Pro Unlimited' : 'Plano Gratuito (Starter)'}
                </h3>
              </div>
            </div>

            <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold border ${
              isPro
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
            }`}>
              {isPro ? '⚡ Ativo Ilimitado' : 'Modo Degustação'}
            </span>
          </div>

          {/* Usage Meter */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Cortes de IA gerados no ciclo</span>
              <span className="font-semibold text-white font-mono">
                {status ? `${status.clips_used} / ${isPro ? '∞ Ilimitado' : status.clips_limit}` : '—'}
              </span>
            </div>

            {!isPro && (
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            )}

            {resetDate && !isPro && (
              <p className="text-[11px] text-zinc-500">Ciclo reseta em {resetDate}</p>
            )}
          </div>
        </div>

        {/* Plan Tiers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          
          {/* Free Tier */}
          <div className={`p-6 sm:p-8 rounded-3xl bg-[#0e0e13]/60 border border-white/[0.06] flex flex-col justify-between ${isPro ? 'opacity-50' : 'ring-1 ring-white/10'}`}>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Starter</span>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold text-white">R$ 0</span>
                <span className="text-xs text-zinc-500 ml-1">/mês</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span>3 cortes mensais em 1080p</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span>Transcrição Groq Whisper Turbo</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span>Download em arquivo MP4</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] text-zinc-500">
              Plano de entrada para experimentação
            </div>
          </div>

          {/* Pro Tier */}
          <div className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#16132b] to-[#0e0e13] border-2 border-indigo-500/40 relative shadow-2xl shadow-indigo-950/40 flex flex-col justify-between ${isPro ? 'ring-2 ring-indigo-500/50' : ''}`}>
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                Mais Popular
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-indigo-400">
                <Zap className="w-3.5 h-3.5" /> Pro Creator
              </div>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold text-white">R$ 97</span>
                <span className="text-xs text-zinc-400 ml-1">/mês</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-200">
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span><strong>Cortes Ilimitados</strong> sem fila de espera</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Brand Kit completo (Logo, Selo e @handle)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Legendas dinâmicas estilo Hormozi & Karaokê</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Publicação Direta & Modo Trial Reels</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06]">
              {!isPro ? (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white font-semibold text-xs tracking-wide transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Redirecionando...' : 'Ativar Acesso Pro'}</span>
                </button>
              ) : (
                <button
                  onClick={handlePortal}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Abrindo portal...' : 'Gerenciar Assinatura Stripe'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

