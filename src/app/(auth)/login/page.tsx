'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  // 🧪 ACESSO IMEDIATO DE 1 CLIQUE (SEM SENHA E SEM CONFIRMAÇÃO DE E-MAIL)
  const handleQuickTestLogin = async () => {
    setTestLoading(true)
    setError('')
    
    try {
      // 1. Grava cookies e localStorage de sessão de teste imediata
      document.cookie = "clippost_demo_auth=true; path=/; max-age=604800; SameSite=Lax"
      if (typeof window !== 'undefined') {
        localStorage.setItem("clippost_demo_auth", "true")
        localStorage.setItem("clippost_demo_user_id", "a0000000-0000-0000-0000-000000000001")
        localStorage.setItem("clippost_demo_user_email", "teste@clippost.com")
      }

      // 2. Tenta autenticar no Supabase Auth em segundo plano (se as credenciais existirem)
      try {
        await supabase.auth.signInWithPassword({
          email: "teste@clippost.com",
          password: "TestePassword123!",
        })
      } catch (e) {
        console.warn("Autenticação em background ignorada, entrando via demo session:", e)
      }

      // 3. Entra direto no Dashboard sem pedir nada
      window.location.href = "/dashboard"
    } catch (err: any) {
      console.warn("Erro ao entrar:", err)
      // Fallback final infalível
      window.location.href = "/dashboard"
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '1.25rem', padding: '2.25rem', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Zap size={13} /> ClipPost Pro
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.65rem', letterSpacing: '-0.025em', color: '#fff', marginBottom: '0.35rem' }}>
            Entrar na Plataforma
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Automação completa para clipadores profissionais
          </p>
        </div>

        {/* 🚀 BOTÃO DE ACESSO RÁPIDO DE 1 CLIQUE (DESTAQUE NO TOPO) */}
        <button
          type="button"
          onClick={handleQuickTestLogin}
          disabled={testLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.9rem 1rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: testLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 25px -5px rgba(234, 88, 12, 0.4)',
            transition: 'all 0.2s ease',
            marginBottom: '1.25rem',
          }}
        >
          {testLoading ? (
            'Entrando no painel...'
          ) : (
            <>
              <span>🧪 Entrar com Conta de Teste</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
            ⚡ 1 clique direto • Sem senha • Sem confirmar e-mail
          </span>
        </div>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ou login tradicional</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
        </div>

        {/* Formulário Tradicional */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '0.35rem' }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={{ width: '100%', padding: '0.7rem 0.9rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '0.35rem' }}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.7rem 0.9rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}
          >
            {loading ? 'Entrando...' : 'Entrar com Senha'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Não tem conta? <Link href="/signup" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>Criar conta grátis →</Link>
        </p>
      </div>
    </div>
  )
}
