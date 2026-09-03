'use client'
import { useEffect, useState } from 'react'
import { Download, Calendar, Play, Clock, Zap } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

type Project = { id: string; title: string; status: string; created_at: string; source_url: string | null }
type Clip = { id: string; title: string; start_time: number; end_time: number; score: number; storage_url: string | null; hook: string | null; status: string }

export default function ProjectClient({ project, clips: initialClips }: { project: Project; clips: Clip[] }) {
  const [clips, setClips] = useState(initialClips)
  const [status, setStatus] = useState(project.status)

  // Poll job status while processing
  useEffect(() => {
    if (status === 'done' || status === 'failed') return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const interval = setInterval(async () => {
      const res = await fetch(`${apiUrl}/api/jobs/${project.id}`).catch(() => null)
      if (!res?.ok) return
      const data = await res.json()
      setStatus(data.status)
      if (data.clips) setClips(data.clips)
      if (data.status === 'done' || data.status === 'failed') clearInterval(interval)
    }, 3000)
    return () => clearInterval(interval)
  }, [project.id, status])

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '999px', background: status === 'done' ? 'rgba(16,185,129,0.15)' : status === 'processing' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)', color: status === 'done' ? 'var(--success)' : status === 'processing' ? 'var(--warning)' : 'var(--muted)', fontWeight: 600 }}>
            {status === 'done' ? '✓ Pronto' : status === 'processing' ? '⟳ Processando...' : status === 'pending' ? '⏳ Na fila' : status}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(project.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Processing state */}
      {(status === 'processing' || status === 'pending') && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '3rem', textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid var(--card-border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>IA analisando seu vídeo...</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Detectando ganchos virais, recortando e adicionando legendas. Isso pode levar alguns minutos.</p>
        </div>
      )}

      {/* Clips grid */}
      {clips.length > 0 && (
        <div>
          <h2 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>
            {clips.length} clipe{clips.length !== 1 ? 's' : ''} gerado{clips.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {clips.map((clip) => (
              <div key={clip.id} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                {/* Thumbnail / video */}
                <div style={{ aspectRatio: '9/16', background: '#000', position: 'relative', maxHeight: '200px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {clip.storage_url ? (
                    <video src={clip.storage_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                  ) : (
                    <Play size={32} style={{ color: 'var(--muted)' }} />
                  )}
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.7)', borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={11} /> {formatDuration(clip.end_time - clip.start_time)}
                  </div>
                  {clip.score >= 0.8 && (
                    <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'var(--accent)', borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Zap size={10} /> VIRAL
                    </div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{clip.title ?? `Clipe ${formatDuration(clip.start_time)}`}</p>
                  {clip.hook && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>"{clip.hook}"</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {clip.storage_url && (
                      <a href={clip.storage_url} download style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Download size={13} /> Baixar
                      </a>
                    )}
                    <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      <Calendar size={13} /> Agendar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '1.5rem', textAlign: 'center', color: 'var(--danger)' }}>
          ❌ Falha no processamento. Verifique se o link é válido e tente novamente.
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
