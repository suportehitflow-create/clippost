'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

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
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setEmail(data.user.email ?? null)
        fetch(`${API}/api/billing/status/${data.user.id}`)
          .then(r => r.json())
          .then(setStatus)
      }
    })
  }, [])

  async function handleUpgrade() {
    if (!userId || !email) return
    setLoading(true)
    const res = await fetch(`${API}/api/billing/checkout`, {
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
    const res = await fetch(`${API}/api/billing/portal/${userId}`)
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    }
    setLoading(false)
  }

  const isPro = status?.plan === 'pro'
  const usedPct = status ? Math.min(100, (status.clips_used / Math.max(status.clips_limit, 1)) * 100) : 0
  const resetDate = status?.period_reset ? new Date(status.period_reset).toLocaleDateString('pt-BR') : null

  const card: React.CSSProperties = {
    background: 'var(--card, #18181b)', border: '1px solid var(--card-border, #27272a)',
    borderRadius: '0.875rem', padding: '1.5rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background, #09090b)', color: 'var(--foreground, #fafafa)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid var(--card-border, #27272a)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--muted, #71717a)', textDecoration: 'none', fontSize: '0.85rem' }}>← Dashboard</Link>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>💳 Plano & Cobrança</span>
      </header>

      <main style={{ maxWidth: '640px', margin: '2.5rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {upgraded && (
          <div style={{ ...card, borderColor: '#166534', background: '#052e16', color: '#4ade80' }}>
            ✅ Upgrade realizado com sucesso! Bem-vindo ao Pro.
          </div>
        )}
        {canceled && (
          <div style={{ ...card, borderColor: '#854d0e', background: '#1c1107', color: '#fbbf24' }}>
            ⚠️ Pagamento cancelado. Você continua no plano gratuito.
          </div>
        )}

        {/* Plano atual */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Plano atual</h2>
            <span style={{
              padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              background: isPro ? '#7c3aed22' : '#3f3f4622',
              color: isPro ? '#a78bfa' : '#71717a',
              border: `1px solid ${isPro ? '#7c3aed44' : '#52525b'}`,
            }}>
              {isPro ? '⚡ Pro' : 'Gratuito'}
            </span>
          </div>

          {/* Barra de uso */}
          <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--muted, #71717a)' }}>Clipes gerados este mês</span>
            <span style={{ fontWeight: 600 }}>
              {status ? `${status.clips_used} / ${isPro ? '∞' : status.clips_limit}` : '—'}
            </span>
          </div>
          {!isPro && (
            <div style={{ height: '6px', background: '#27272a', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{
                height: '100%', borderRadius: '999px', transition: 'width 0.4s',
                width: `${usedPct}%`,
                background: usedPct >= 100 ? '#ef4444' : usedPct >= 66 ? '#f59e0b' : '#7c3aed',
              }} />
            </div>
          )}
          {resetDate && !isPro && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted, #71717a)' }}>Contador reseta em {resetDate}</p>
          )}
        </div>

        {/* Cards de plano */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* Free */}
          <div style={{ ...card, opacity: isPro ? 0.5 : 1 }}>
            <p style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Gratuito</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>$0<span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)' }}>/mês</span></p>
            <ul style={{ fontSize: '0.82rem', color: 'var(--muted, #71717a)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
              <li>✓ 3 clipes por mês</li>
              <li>✓ Download MP4</li>
              <li>✓ Qualidade 1080p</li>
            </ul>
          </div>

          {/* Pro */}
          <div style={{ ...card, border: '1px solid #7c3aed66', background: isPro ? '#1a0a2e' : 'var(--card)' }}>
            <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#a78bfa' }}>⚡ Pro</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>$19<span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)' }}>/mês</span></p>
            <ul style={{ fontSize: '0.82rem', color: 'var(--muted, #71717a)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
              <li>✓ Clipes ilimitados</li>
              <li>✓ Brand Kit (logo + @username)</li>
              <li>✓ Legendas automáticas</li>
              <li>✓ Agendamento Instagram</li>
              <li>✓ Suporte prioritário</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        {!isPro ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              padding: '0.9rem', background: '#7c3aed', color: '#fff',
              border: 'none', borderRadius: '0.6rem', fontWeight: 700,
              fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Redirecionando…' : '⚡ Fazer upgrade para Pro — $19/mês'}
          </button>
        ) : (
          <button
            onClick={handlePortal}
            disabled={loading}
            style={{
              padding: '0.75rem', background: 'transparent',
              border: '1px solid var(--card-border, #27272a)',
              color: 'var(--muted, #71717a)', borderRadius: '0.6rem',
              fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            {loading ? 'Abrindo…' : 'Gerenciar assinatura / Cancelar'}
          </button>
        )}
      </main>
    </div>
  )
}
