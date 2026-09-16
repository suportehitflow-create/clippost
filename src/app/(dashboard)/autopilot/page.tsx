'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface Watch {
  id: string
  channel_id: string
  channel_handle: string | null
  channel_name: string | null
  baseline_video_id: string | null
  clip_duration: '30' | '60' | 'auto'
  is_active: boolean
  last_checked_at: string | null
  last_error: string | null
}

export default function AutoPilotPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [watches, setWatches] = useState<Watch[]>([])
  const [canal, setCanal] = useState('')
  const [duracao, setDuracao] = useState<'30' | '60' | 'auto'>('auto')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      carregar(data.user.id)
    })
  }, [])

  async function carregar(uid: string) {
    const res = await fetch(`${API}/api/autopilot/watches/${uid}`)
    if (res.ok) {
      const { watches: w } = await res.json()
      setWatches(w || [])
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !canal.trim()) return
    setSalvando(true); setErro(''); setAviso('')
    try {
      const res = await fetch(`${API}/api/autopilot/watches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, canal: canal.trim(), clip_duration: duracao }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Não foi possível adicionar o canal.')
      setCanal('')
      setAviso(`${data.watch.channel_name || 'Canal'} adicionado. Os próximos vídeos viram clipes automaticamente.`)
      setTimeout(() => setAviso(''), 5000)
      await carregar(userId)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Parar de monitorar esse canal?')) return
    await fetch(`${API}/api/autopilot/watches/${id}`, { method: 'DELETE' })
    if (userId) await carregar(userId)
  }

  const card: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--card-border)',
    borderRadius: '0.75rem', padding: '1.25rem',
  }
  const input: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.9rem', background: 'var(--background)',
    border: '1px solid var(--card-border)', borderRadius: '0.5rem',
    color: 'var(--foreground)', fontSize: '0.9rem', boxSizing: 'border-box',
  }
  const rotulo: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid var(--card-border)', padding: '0.875rem 1.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Canais no automático</span>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>Adicionar canal</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            A cada 15 minutos o clipost verifica os canais. Quando um vídeo novo sai, ele baixa,
            corta e deixa os clipes prontos. Vídeos publicados antes do cadastro não são processados.
          </p>
          <form onSubmit={adicionar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="canal" style={rotulo}>Canal do YouTube</label>
              <input
                id="canal"
                value={canal}
                onChange={e => setCanal(e.target.value)}
                required
                placeholder="@nomedocanal ou youtube.com/@nomedocanal"
                style={input}
              />
            </div>
            <div>
              <label htmlFor="duracao" style={rotulo}>Duração dos clipes</label>
              <select id="duracao" value={duracao} onChange={e => setDuracao(e.target.value as '30' | '60' | 'auto')} style={input}>
                <option value="auto">Automática</option>
                <option value="30">30 segundos</option>
                <option value="60">60 segundos</option>
              </select>
            </div>
            {erro && <p style={{ fontSize: '0.82rem', color: '#f87171' }}>{erro}</p>}
            {aviso && <p style={{ fontSize: '0.82rem', color: '#4ade80' }}>{aviso}</p>}
            <button
              type="submit"
              disabled={salvando || !canal.trim()}
              style={{
                padding: '0.8rem', background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.95rem',
                cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando || !canal.trim() ? 0.6 : 1,
              }}
            >
              {salvando ? 'Adicionando…' : 'Monitorar canal'}
            </button>
          </form>
        </div>

        <section>
          <h2 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Canais monitorados ({watches.length})
          </h2>

          {watches.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nenhum canal ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {watches.map(w => (
                <div key={w.id} style={{ ...card, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                      {w.channel_name || w.channel_handle || w.channel_id}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Clipes de {w.clip_duration === 'auto' ? 'duração automática' : `${w.clip_duration}s`}
                      {w.last_checked_at
                        ? ` · verificado às ${new Date(w.last_checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : ' · ainda não verificado'}
                    </p>
                    {!w.baseline_video_id && (
                      <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                        Aguardando a primeira leitura do canal.
                      </p>
                    )}
                    {w.last_error && (
                      <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>
                        Última falha: {w.last_error.slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => remover(w.id)}
                    style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--muted)', padding: '0.3rem 0.6rem', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
