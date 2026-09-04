'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface Clip {
  id: string
  title: string
  hook: string
  storage_url: string
  score: number
  created_at: string
}

interface SocialAccount {
  id: string
  platform: string
  username: string
  account_id: string
}

interface ScheduledPost {
  id: string
  caption: string
  scheduled_time: string
  status: 'pending' | 'published' | 'failed'
  error_log: string | null
  clips: { title: string; storage_url: string } | null
  social_accounts: { platform: string; username: string } | null
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  pending:   { color: '#facc15', label: '⏳ Agendado' },
  published: { color: '#4ade80', label: '✓ Publicado' },
  failed:    { color: '#f87171', label: '✗ Falhou' },
}

export default function SchedulePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<ScheduledPost[]>([])

  // form
  const [selectedClip, setSelectedClip] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [caption, setCaption] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
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
    // Load clips from all projects
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
    const res = await fetch(`${API}/api/social-accounts/${uid}`)
    if (res.ok) { const { accounts: a } = await res.json(); setAccounts(a || []) }
  }

  async function loadPosts(uid: string) {
    const res = await fetch(`${API}/api/scheduled-posts/${uid}`)
    if (res.ok) { const { posts: p } = await res.json(); setPosts(p || []) }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !selectedClip || !selectedAccount || !caption || !scheduledTime) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${API}/api/scheduled-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          clip_id: selectedClip,
          social_account_id: selectedAccount,
          caption,
          scheduled_time: new Date(scheduledTime).toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Erro ao agendar')
      setSuccess('Post agendado com sucesso!')
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

  // shared styles
  const card: React.CSSProperties = {
    background: 'var(--card, #18181b)', border: '1px solid var(--card-border, #27272a)',
    borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.9rem',
    background: 'var(--background, #09090b)', border: '1px solid var(--card-border, #27272a)',
    borderRadius: '0.5rem', color: 'var(--foreground, #fafafa)', fontSize: '0.9rem',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--muted, #71717a)', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: '0.35rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background, #09090b)', color: 'var(--foreground, #fafafa)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid var(--card-border, #27272a)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.4rem' }}>📅</span>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Agendamentos</span>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {accounts.length === 0 && (
          <div style={{ ...card, borderColor: '#854d0e', background: '#1c1107', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
              ⚠️ Nenhuma conta social conectada. Configure o Instagram via a rota <code>/api/social-accounts</code> com seu <strong>Page Access Token</strong> e <strong>Account ID</strong>.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,380px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* COLUNA ESQUERDA — Clipes disponíveis */}
          <aside>
            <h2 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Clipes disponíveis
            </h2>
            {clips.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted, #71717a)' }}>Nenhum clipe gerado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '520px', overflowY: 'auto' }}>
                {clips.map(clip => (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedClip(clip.id)}
                    style={{
                      textAlign: 'left', padding: '0.75rem',
                      background: selectedClip === clip.id ? 'var(--card, #18181b)' : 'transparent',
                      border: selectedClip === clip.id ? '1px solid #7c3aed' : '1px solid var(--card-border, #27272a)',
                      borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--foreground, #fafafa)',
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
                      <p style={{ fontSize: '0.72rem', color: '#fbbf24' }}>⚡ {Math.round((clip.score || 0) * 100)}%</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* COLUNA DIREITA — Formulário + Lista */}
          <div>
            {/* Formulário */}
            <div style={card}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Agendar Post</h2>
              <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div>
                  <label style={labelStyle}>Conta do Instagram</label>
                  <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} required style={inputStyle}>
                    <option value="">Selecione uma conta…</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.username || a.account_id} ({a.platform})</option>
                    ))}
                  </select>
                  {accounts.length === 0 && (
                    <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.25rem' }}>Nenhuma conta conectada ainda.</p>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Clipe selecionado</label>
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--background, #09090b)', border: '1px solid var(--card-border, #27272a)', borderRadius: '0.5rem', fontSize: '0.85rem', color: selectedClip ? 'var(--foreground)' : 'var(--muted, #71717a)' }}>
                    {selectedClip
                      ? clips.find(c => c.id === selectedClip)?.title || clips.find(c => c.id === selectedClip)?.hook || 'Clipe selecionado'
                      : '← Selecione um clipe à esquerda'
                    }
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Legenda (caption)</label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    required
                    rows={4}
                    placeholder="Escreva a legenda do post..."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted, #71717a)', marginTop: '0.2rem' }}>{caption.length}/2200 chars</p>
                </div>

                <div>
                  <label style={labelStyle}>Data e hora do post</label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    required
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    style={inputStyle}
                  />
                </div>

                {error && <p style={{ fontSize: '0.82rem', color: '#f87171' }}>{error}</p>}
                {success && <p style={{ fontSize: '0.82rem', color: '#4ade80' }}>✓ {success}</p>}

                <button
                  type="submit"
                  disabled={saving || !selectedClip || !selectedAccount}
                  style={{
                    padding: '0.8rem', background: '#7c3aed', color: '#fff',
                    border: 'none', borderRadius: '0.5rem', fontWeight: 700,
                    fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving || !selectedClip || !selectedAccount ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Agendando…' : '📅 Agendar Post'}
                </button>
              </form>
            </div>

            {/* Lista de posts agendados */}
            <h2 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Posts agendados ({posts.length})
            </h2>

            {posts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted, #71717a)' }}>Nenhum post agendado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {posts.map(post => {
                  const st = STATUS_STYLE[post.status] || STATUS_STYLE.pending
                  const dt = new Date(post.scheduled_time)
                  return (
                    <div key={post.id} style={{ ...card, marginBottom: 0, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color }}>{st.label}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted, #71717a)' }}>
                            {dt.toLocaleDateString('pt-BR')} {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {post.social_accounts && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted, #71717a)' }}>
                              · {post.social_accounts.platform} @{post.social_accounts.username}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>
                          {post.clips?.title || 'Clipe'}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted, #71717a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.caption}
                        </p>
                        {post.status === 'failed' && post.error_log && (
                          <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.25rem' }}>{post.error_log.substring(0, 120)}</p>
                        )}
                      </div>
                      {post.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          style={{ background: 'none', border: '1px solid #27272a', color: '#71717a', padding: '0.3rem 0.6rem', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
