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
    <div className="w-full max-w-[420px]">
      <div className="bg-[#0e0e13]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
        {/* Top ambient highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Zap className="w-3.5 h-3.5" /> Clipost Pro
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            Entrar na Plataforma
          </h1>
          <p className="text-xs text-zinc-400">
            Automação completa para criadores e editores profissionais
          </p>
        </div>

        {/* 🌐 BOTÃO OFICIAL: LOGAR COM GOOGLE */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm transition-all duration-200 shadow-md shadow-white/5 disabled:opacity-60 cursor-pointer mb-3"
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
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:brightness-110 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 disabled:opacity-60 cursor-pointer mb-5"
        >
          {testLoading ? (
            'Autenticando via Supabase...'
          ) : (
            <>
              <span>🧪 Entrar com Conta de Teste</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Divisor */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">ou e-mail e senha</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Formulário Tradicional */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white font-semibold text-sm transition-all duration-200 disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar com Senha'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-zinc-400">
          Não tem conta? <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Criar conta grátis →</Link>
        </p>
      </div>
    </div>
  )
}
