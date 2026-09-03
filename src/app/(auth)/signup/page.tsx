'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '1rem', padding: '2rem' }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.5rem' }}>Criar conta grátis</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>Comece a criar clipes virais agora</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>Nome</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome"
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com"
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 caracteres"
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none' }} />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ padding: '0.875rem', borderRadius: '0.5rem', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
          Já tem conta? <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Entrar →</Link>
        </p>
      </div>
    </div>
  )
}
