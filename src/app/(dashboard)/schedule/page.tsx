'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

type Platform = 'tiktok' | 'instagram' | 'youtube_shorts'

interface Clip {
  id: string
  title: string
  hook: string
  storage_url: string
  score: number
  created_at: string
}

interface SocialAccount {
  platform: Platform
  handle: string
  reauth_required: boolean
}

interface ScheduledPost {
  id: string
  caption: string
  platform: Platform
  scheduled_at: string
  status: 'scheduled' | 'published' | 'failed'
  clips: { title: string; storage_url: string } | null
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube_shorts: 'YouTube Shorts',
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  scheduled: { color: '#facc15', label: 'Agendado' },
  published: { color: '#4ade80', label: 'Publicado' },
  failed:    { color: '#f87171', label: 'Falhou' },
}

export default function SchedulePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [configured, setConfigured] = useState(true)
  const [posts, setPosts] = useState<ScheduledPost[]>([])

  // form
  const [selectedClip, setSelectedClip] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | ''>('')
  const [caption, setCaption] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connected')) {
      setSuccess('Redes conectadas. Já dá para agendar.')
      window.history.replaceState(null, '', '/schedule')
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)
      await Promise.all([loadClips(uid), loadAccounts(uid), loadPosts(uid)])
    })
  }, [])

  async function loadClips(uid: string) {
    const res = await fetch(`${API}/api/projects/${uid}`)
    if (!res.ok) return
    const { projects } = await res.json()
    const allClips: Clip[] = []
    for (const p of (projects || []).slice(0, 5)) {
      const cr = await fetch(`${API}/api/clips/${p.id}`)
      if (cr.ok) {
        const { clips: c } = await cr.json()
        allClips.push(...(c || []))
      }
    }
    setClips(allClips.slice(0, 30))
  }

  async function loadAccounts(uid: string) {
    const res = await fetch(`${API}/api/social/accounts/${uid}`)
    if (!res.ok) return
    const data = await res.json()
    setConfigured(data.configured !== false)
    setAccounts((data.accounts || []).filter((a: SocialAccount) => !a.reauth_required))
  }

  async function loadPosts(uid: string) {
    const res = await fetch(`${API}/api/scheduled-posts/${uid}`)
    if (res.ok) { const { posts: p } = await res.json(); setPosts(p || []) }
  }

  async function handleConnect() {
    if (!userId) return
    setConnecting(true); setError('')
    try {
      const res = await fetch(`${API}/api/social/connect-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok || !data.access_url) throw new Error(data.detail || 'Não foi possível abrir a conexão.')
      window.location.href = data.access_url
    } catch (err: any) {
      setError(err.message)
      setConnecting(false)
    }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !selectedClip || !selectedPlatform || !scheduledTime) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${API}/api/scheduled-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          clip_id: selectedClip,
          platform: selectedPlatform,
          caption,
          scheduled_at: new Date(scheduledTime).toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Não foi possível agendar o post.')
      setSuccess('Post agendado.')
      setCaption(''); setScheduledTime(''); setSelectedClip('')
      setTimeout(() => setSuccess(''), 3000)
      await loadPosts(userId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Cancelar esse agendamento?')) return
    await fetch(`${API}/api/scheduled-posts/${postId}`, { method: 'DELETE' })
    if (userId) await loadPosts(userId)
  }

  const card: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--card-border)',
    borderRadius: '0.75rem', padding: '1.25rem',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.9rem',
    background: 'var(--background)', border: '1px solid var(--card-border)',
    borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.9rem',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: '0.35rem',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '0.75rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid var(--card-border)', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Agendamentos</span>
        {configured && (
          <button
            onClick={handleConnect}
            disabled={connecting || !userId}
            style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--foreground)', padding: '0.45rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {connecting ? 'Abrindo…' : accounts.length ? 'Gerenciar redes conectadas' : 'Conectar redes'}
          </button>
        )}
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {!configured && (
          <div style={{ ...card, borderColor: '#854d0e', background: '#1c1107' }}>
            <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
              A publicação nas redes ainda não foi ativada no servidor. Falta configurar a chave da Upload-Post.
            </p>
          </div>
        )}

        {configured && accounts.length === 0 && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Conecte suas redes para publicar</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>TikTok, Instagram e YouTube Shorts. A autorização é feita direto em cada rede.</p>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting || !userId}
              style={{ padding: '0.7rem 1.2rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {connecting ? 'Abrindo…' : 'Conectar redes'}
            </button>
          </div>
        )}

        <div className="grid items-start gap-6 md:grid-cols-[minmax(280px,380px)_1fr]">

          <aside>
            <h2 style={sectionTitle}>Clipes disponíveis</h2>
            {clips.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nenhum clipe gerado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '520px', overflowY: 'auto' }}>
                {clips.map(clip => (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedClip(clip.id)}
                    style={{
                      textAlign: 'left', padding: '0.75rem',
                      background: selectedClip === clip.id ? 'var(--card)' : 'transparent',
                      border: selectedClip === clip.id ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                      borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--foreground)',
                      display: 'flex', gap: '0.75rem', alignItems: 'center',
                    }}
                  >
                    <video
                      src={clip.storage_url}
                      muted
                      style={{ width: 42, height: 74, objectFit: 'cover', borderRadius: '0.25rem', flexShrink: 0, background: '#000' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>
                        {clip.title || clip.hook || 'Clipe sem título'}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Viralidade {Math.round((clip.score || 0) * 100)}%</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={card}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Agendar post</h2>
              <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div>
                  <label htmlFor="platform" style={labelStyle}>Rede social</label>
                  <select id="platform" value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value as Platform)} required style={inputStyle}>
                    <option value="">Selecione uma rede…</option>
                    {accounts.map(a => (
                      <option key={a.platform} value={a.platform}>{PLATFORM_LABEL[a.platform]} · {a.handle}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span style={labelStyle}>Clipe selecionado</span>
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', fontSize: '0.85rem', color: selectedClip ? 'var(--foreground)' : 'var(--muted)' }}>
                    {selectedClip
                      ? clips.find(c => c.id === selectedClip)?.title || clips.find(c => c.id === selectedClip)?.hook || 'Clipe selecionado'
                      : 'Selecione um clipe na lista'
                    }
                  </div>
                </div>

                <div>
                  <label htmlFor="caption" style={labelStyle}>Legenda</label>
                  <textarea
                    id="caption"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={4}
                    maxLength={2200}
                    placeholder="Escreva a legenda do post..."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{caption.length}/2200</p>
                </div>

                <div>
                  <label htmlFor="scheduled" style={labelStyle}>Data e hora</label>
                  <input
                    id="scheduled"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                {error && <p style={{ fontSize: '0.82rem', color: '#f87171' }}>{error}</p>}
                {success && <p style={{ fontSize: '0.82rem', color: '#4ade80' }}>{success}</p>}

                <button
                  type="submit"
                  disabled={saving || !selectedClip || !selectedPlatform}
                  style={{
                    padding: '0.8rem', background: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: '0.5rem', fontWeight: 700,
                    fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving || !selectedClip || !selectedPlatform ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Agendando…' : 'Agendar post'}
                </button>
              </form>
            </div>

            <section>
              <h2 style={sectionTitle}>Posts agendados ({posts.length})</h2>
              {posts.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nenhum post agendado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {posts.map(post => {
                    const st = STATUS_STYLE[post.status] || STATUS_STYLE.scheduled
                    const dt = new Date(post.scheduled_at)
                    return (
                      <div key={post.id} style={{ ...card, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color }}>{st.label}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                              {dt.toLocaleDateString('pt-BR')} {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>· {PLATFORM_LABEL[post.platform] || post.platform}</span>
                          </div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>
                            {post.clips?.title || 'Clipe'}
                          </p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {post.caption}
                          </p>
                        </div>
                        {post.status === 'scheduled' && (
                          <button
                            onClick={() => handleDelete(post.id)}
                            style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--muted)', padding: '0.3rem 0.6rem', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
