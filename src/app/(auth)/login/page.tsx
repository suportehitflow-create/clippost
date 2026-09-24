'use client'
import { useState, useEffect } from 'react'
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

  // Verifica se já está logado sem disparar loop cíclico
  useEffect(() => {
    document.cookie = "clippost_demo_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    if (typeof window !== 'undefined') {
      localStorage.removeItem("clippost_demo_auth")
    }

    let active = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && user) {
        window.location.href = '/inicio'
      }
    })
    return () => { active = false }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/inicio'
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

  // 🧪 LOGIN REAL DA CONTA DE TESTE VIA SDK OFICIAL SUPABASE
  const handleQuickTestLogin = async () => {
    setTestLoading(true)
    setError('')
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'teste@clippost.com',
        password: 'TestePassword123!',
      })
      
      if (error) {
        if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')) {
          const signUpRes = await supabase.auth.signUp({
            email: 'teste@clippost.com',
            password: 'TestePassword123!',
            options: {
              data: { full_name: 'Usuário de Teste' }
            }
          })
          if (signUpRes.error) {
            throw new Error(
              'Conta de teste não configurada no Supabase. Execute o script 0009_test_user_seed.sql no painel do Supabase.'
            )
          }
        } else {
          throw error
        }
      }

      window.location.href = '/inicio'
    } catch (err: any) {
      console.error('Erro no login de teste:', err)
      setError(err.message || 'Falha ao autenticar conta de teste.')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '1.25rem', padding: '2.25rem', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Zap size={13} /> Clipost Pro
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.65rem', letterSpacing: '-0.025em', color: '#fff', marginBottom: '0.35rem' }}>
            Entrar na Plataforma
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Automação completa para clipadores profissionais
          </p>
        </div>

        {/* 🌐 BOTÃO OFICIAL: LOGAR COM GOOGLE */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            background: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#18181b',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s ease',
            marginBottom: '0.85rem',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
        </button>

        {/* 🚀 BOTÃO DE ACESSO RÁPIDO DE 1 CLIQUE (CONTA DE TESTE) */}
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
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #9333ea 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: testLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.35)',
            transition: 'all 0.2s ease',
            marginBottom: '1rem',
          }}
        >
          {testLoading ? (
            'Autenticando via Supabase...'
          ) : (
            <>
              <span>🧪 Entrar com Conta de Teste</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ou e-mail e senha</span>
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
          Não tem conta? <Link href="/signup" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>Criar conta grátis →</Link>
        </p>
      </div>
    </div>
  )
}
