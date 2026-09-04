'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface Clip {
  id: string
  title: string
  hook: string
  score: number
  storage_url: string
  start_time: number
  end_time: number
  status: string
}

interface Project {
  id: string
  title: string
  source_url: string
  status: string
  created_at: string
}

export default function Dashboard() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [polling, setPolling] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchProjects(data.user.id)
      }
    })
  }, [])

  async function fetchProjects(uid: string) {
    const res = await fetch(`${API}/api/projects/${uid}`)
    if (res.ok) {
      const data = await res.json()
      setProjects(data.projects || [])
    }
  }

  async function fetchClips(projectId: string) {
    const res = await fetch(`${API}/api/clips/${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setClips(data.clips || [])
      return data.project?.status
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !url.trim()) return
    setLoading(true)
    setError('')
    setClips([])
    setActiveProject(null)

    try {
      const res = await fetch(`${API}/api/process-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, user_id: userId }),
      })
      if (!res.ok) throw new Error('Erro ao iniciar processamento')
      setUrl('')
      setPolling(true)
      await fetchProjects(userId)

      // poll até achar o projeto novo e ele ficar "done"
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        const projs = await fetch(`${API}/api/projects/${userId}`).then(r => r.json())
        const latest = projs.projects?.[0]
        if (latest) {
          setProjects(projs.projects)
          setActiveProject(latest.id)
          const status = await fetchClips(latest.id)
          if (status === 'done' || attempts > 60) {
            clearInterval(interval)
            setPolling(false)
            setLoading(false)
          }
        }
      }, 5000)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function selectProject(projectId: string) {
    setActiveProject(projectId)
    await fetchClips(projectId)
  }

  function formatDuration(start: number, end: number) {
    return `${Math.round(end - start)}s`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--card-border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>✂️</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>ClipPost</span>
        </div>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
          style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--muted)', padding: '0.4rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Sair
        </button>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Input de URL */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '-0.03em' }}>
            Encontrar Clipes Virais
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Cole o link de qualquer vídeo do YouTube e a IA vai identificar os melhores momentos.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              placeholder="https://youtube.com/watch?v=..."
              style={{
                flex: 1, minWidth: '280px', padding: '0.8rem 1rem',
                background: 'var(--card)', border: '1px solid var(--card-border)',
                borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !userId}
              style={{
                padding: '0.8rem 1.5rem', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? (polling ? '⏳ Processando…' : 'Enviando…') : '🔍 Encontrar Clipes Virais'}
            </button>
          </form>
          {error && <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.85rem' }}>{error}</p>}
          {polling && (
            <p style={{ color: 'var(--muted)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              ⚙️ Baixando vídeo, transcrevendo e gerando clipes... isso pode levar alguns minutos.
            </p>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Sidebar de projetos */}
          <aside>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Vídeos importados
            </h2>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Nenhum vídeo ainda.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {projects.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => selectProject(p.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem',
                        background: activeProject === p.id ? 'var(--card)' : 'transparent',
                        border: activeProject === p.id ? '1px solid var(--card-border)' : '1px solid transparent',
                        borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--foreground)',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title || 'Processando…'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: p.status === 'done' ? '#4ade80' : 'var(--muted)', marginTop: '0.15rem' }}>
                        {p.status === 'done' ? '✓ Pronto' : p.status === 'processing' ? '⏳ Processando' : p.status}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Grid de clipes */}
          <section>
            {activeProject && clips.length === 0 && (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem 0' }}>
                {polling ? '⏳ Gerando clipes…' : 'Nenhum clipe gerado ainda.'}
              </div>
            )}
            {!activeProject && (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem 0' }}>
                Selecione um projeto ou importe um vídeo novo.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {clips.map(clip => (
                <div key={clip.id} style={{
                  background: 'var(--card)', border: '1px solid var(--card-border)',
                  borderRadius: '0.75rem', overflow: 'hidden',
                }}>
                  {/* Vídeo vertical */}
                  <div style={{ position: 'relative', paddingTop: '177.78%', background: '#000' }}>
                    <video
                      src={clip.storage_url}
                      loop muted autoPlay playsInline
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Score badge */}
                    <div style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                      padding: '0.2rem 0.5rem', borderRadius: '999px',
                      fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24',
                    }}>
                      ⚡ {Math.round(clip.score * 100)}%
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '0.875rem' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                      {clip.title || clip.hook}
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                      {formatDuration(clip.start_time, clip.end_time)} · {Math.round(clip.start_time)}s – {Math.round(clip.end_time)}s
                    </p>
                    <a
                      href={clip.storage_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block', textAlign: 'center', padding: '0.55rem',
                        background: 'var(--accent)', color: '#fff', borderRadius: '0.4rem',
                        fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
                      }}
                    >
                      ⬇ Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
