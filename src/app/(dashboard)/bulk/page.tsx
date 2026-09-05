'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface InstagramVideo {
  id: string
  title: string
  url: string
  view_count: number
  duration: number
  platform: string
}

export default function BulkPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)

  // Instagram scraper
  const [igHandle, setIgHandle] = useState('')
  const [igSort, setIgSort] = useState<'recent' | 'views'>('recent')
  const [igVideos, setIgVideos] = useState<InstagramVideo[]>([])
  const [igLoading, setIgLoading] = useState(false)
  const [igError, setIgError] = useState('')

  // Bulk URL input
  const [bulkUrls, setBulkUrls] = useState('')
  const [clipDuration, setClipDuration] = useState<'auto' | '30' | '60'>('auto')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState('')
  const [selectedIg, setSelectedIg] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const plan = await fetch(`${API}/api/billing/status/${data.user.id}`).then(r => r.json())
      setIsPro(plan?.plan === 'pro')
    })
  }, [])

  async function searchInstagram() {
    if (!igHandle.trim()) return
    setIgLoading(true); setIgError(''); setIgVideos([])
    try {
      const res = await fetch(`${API}/api/instagram/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_url: igHandle.trim(), limit: 12, sort_by: igSort }),
      })
      const data = await res.json()
      if (data.error) setIgError(data.error)
      setIgVideos(data.videos || [])
    } catch (e: any) { setIgError(e.message) }
    finally { setIgLoading(false) }
  }

  function toggleIg(url: string) {
    setSelectedIg(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  function addSelectedToQueue() {
    const existing = bulkUrls.trim() ? bulkUrls.trim().split('\n') : []
    const newUrls = [...selectedIg].filter(u => !existing.includes(u))
    setBulkUrls([...existing, ...newUrls].join('\n'))
    setSelectedIg(new Set())
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length) return
    setSubmitting(true); setResult('')
    try {
      const res = await fetch(`${API}/api/process-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, user_id: userId, clip_duration: clipDuration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao enfileirar')
      setResult(`✅ ${data.count} vídeos enfileirados para processamento!`)
      setBulkUrls('')
    } catch (e: any) { setResult(`❌ ${e.message}`) }
    finally { setSubmitting(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 1rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.9rem',
    backdropFilter: 'blur(12px)',
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.25rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', backdropFilter: 'blur(20px)', background: 'rgba(6,6,8,0.8)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Dashboard</Link>
        <span style={{ fontWeight: 700 }}>⚡ Processamento em Massa</span>
        {!isPro && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', padding: '0.25rem 0.75rem', borderRadius: '999px', color: '#a78bfa' }}>Apenas Pro</span>}
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {!isPro && (
          <div style={{ ...card, borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>⚡ Recurso exclusivo Pro</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Processe até 20 vídeos de uma vez, sem limites mensais.</p>
            <Link href="/billing" style={{ padding: '0.75rem 1.5rem', background: '#7c3aed', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 700 }}>Fazer upgrade →</Link>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', opacity: isPro ? 1 : 0.4, pointerEvents: isPro ? 'auto' : 'none' }}>

          {/* Coluna esquerda — Instagram scraper */}
          <div>
            <div style={card}>
              <h2 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>🔍 Buscar no Instagram</h2>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input value={igHandle} onChange={e => setIgHandle(e.target.value)} placeholder="@username ou URL" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && searchInstagram()} />
                <button onClick={searchInstagram} disabled={igLoading} style={{ padding: '0.7rem 1rem', background: '#7c3aed', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {igLoading ? '...' : 'Buscar'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {(['recent', 'views'] as const).map(s => (
                  <button key={s} onClick={() => setIgSort(s)} style={{ padding: '0.35rem 0.75rem', background: igSort === s ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)', border: `1px solid ${igSort === s ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '999px', color: 'var(--foreground)', fontSize: '0.78rem', cursor: 'pointer' }}>
                    {s === 'recent' ? '🕐 Recentes' : '👁 + Vistas'}
                  </button>
                ))}
              </div>
              {igError && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{igError}</p>}
            </div>

            {igVideos.length > 0 && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{igVideos.length} vídeos encontrados</span>
                  {selectedIg.size > 0 && (
                    <button onClick={addSelectedToQueue} style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', background: '#7c3aed', border: 'none', borderRadius: '0.4rem', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                      + Adicionar {selectedIg.size} à fila
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {igVideos.map(v => (
                    <button key={v.id} onClick={() => toggleIg(v.url)} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', background: selectedIg.has(v.url) ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedIg.has(v.url) ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--foreground)' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.15rem' }}>{v.title}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>👁 {v.view_count.toLocaleString('pt-BR')} · {Math.round(v.duration)}s</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita — Fila de URLs */}
          <div>
            <div style={card}>
              <h2 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>📋 Fila de Processamento</h2>
              <form onSubmit={handleBulkSubmit}>
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem' }}>URLs (YouTube ou Instagram, uma por linha)</label>
                <textarea
                  value={bulkUrls}
                  onChange={e => setBulkUrls(e.target.value)}
                  rows={10}
                  placeholder={`https://youtube.com/watch?v=...\nhttps://www.instagram.com/reel/...\nhttps://youtube.com/watch?v=...`}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: '1rem' }}
                />

                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                  {(['auto', '30', '60'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setClipDuration(d)} style={{ flex: 1, padding: '0.55rem', background: clipDuration === d ? '#7c3aed' : 'rgba(255,255,255,0.04)', border: `1px solid ${clipDuration === d ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`, borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--foreground)', fontSize: '0.82rem', fontWeight: 600 }}>
                      {d === 'auto' ? '🤖 Auto' : `${d}s`}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                  {bulkUrls.split('\n').filter(u => u.trim()).length} URLs na fila · máx 20
                </div>

                {result && <p style={{ fontSize: '0.85rem', color: result.startsWith('✅') ? '#4ade80' : '#f87171', marginBottom: '0.75rem' }}>{result}</p>}

                <button
                  type="submit"
                  disabled={submitting || !bulkUrls.trim()}
                  style={{ width: '100%', padding: '0.85rem', background: '#7c3aed', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting || !bulkUrls.trim() ? 0.6 : 1 }}
                >
                  {submitting ? 'Enfileirando…' : '⚡ Processar Tudo'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
