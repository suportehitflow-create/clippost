'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface VideoFormat {
  id: string
  label: string
  height: number
}

interface VideoInfo {
  title: string
  thumbnail: string
  duration: number | null
  uploader: string
  platform: string
  formats: VideoFormat[]
}

function fmtDuration(s: number | null) {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

export default function UploadPage() {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleFetchInfo() {
    if (!youtubeUrl.trim()) return
    setFetching(true)
    setError('')
    setInfo(null)

    // 1. Extração imediata via oEmbed (sem backend, zero CORS, instantâneo)
    try {
      const oeRes = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(youtubeUrl.trim()) + '&format=json')
      if (oeRes.ok) {
        const oe = await oeRes.json()
        setInfo({
          title: oe.title,
          thumbnail: oe.thumbnail_url || '',
          duration: 0,
          uploader: oe.author_name || '',
          platform: 'youtube',
          formats: [{ id: 'auto', label: '1080p / Melhor disponível', height: 1080 }],
        })
        setSelectedFormat('auto')
      }
    } catch (oeErr) {
      // continua para o backend
    }

    // 2. Se backend estiver ativo, complementa formatos
    try {
      const res = await fetch(`${API}/api/sources/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      }).catch(() => null)
      if (res && res.ok) {
        const data = await res.json()
        setInfo(data)
        const pref = data.formats.find((f: VideoFormat) => f.height === 720) || data.formats[0]
        setSelectedFormat(pref?.id || null)
      }
    } catch (e: any) {
      console.warn('Backend info fallback:', e)
    } finally {
      setFetching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Não autenticado'); setLoading(false); return }

    const { data: project, error: dbError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: mode === 'url' ? (info?.title || youtubeUrl) : (file?.name ?? 'Upload'),
        source_url: mode === 'url' ? youtubeUrl : null,
        source_type: mode,
        status: 'processing',
      })
      .select()
      .single()

    if (dbError || !project) {
      setError('Erro ao criar projeto: ' + dbError?.message)
      setLoading(false)
      return
    }

    let sourceUrl = youtubeUrl
    if (mode === 'file' && file) {
      const storagePath = `${user.id}/${project.id}/original.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file)
      if (uploadError) {
        setError('Erro no upload: ' + uploadError.message)
        setLoading(false)
        return
      }
      sourceUrl = supabase.storage.from('videos').getPublicUrl(storagePath).data.publicUrl
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)
      await fetch(`/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl, user_id: user.id, clip_duration: 'auto', project_id: project.id }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (err) {
      console.warn('Disparo do job demorou ou servidor ocupado, avançando para o projeto:', err)
    }

    // Redireciona imediatamente sem travar em "Enviando..."
    router.push(`/project/${project.id}`)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '0.875rem 1rem', background: 'var(--background)',
    border: '1px solid var(--card-border)', borderRadius: '0.5rem',
    color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
  }
  const card: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--card-border)',
    borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1rem',
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Novo projeto</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>Importe um vídeo para gerar clipes virais com IA</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '0.375rem' }}>
        {(['url', 'file'] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setInfo(null); setError('') }}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
            {m === 'url' ? '🔗 Link do vídeo' : '📁 Upload de arquivo'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'url' ? (
          <div style={card}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              URL do vídeo
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="url" value={youtubeUrl}
                onChange={e => { setYoutubeUrl(e.target.value); setInfo(null) }}
                required placeholder="https://youtube.com/watch?v=..."
                style={{ ...input, marginBottom: 0, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleFetchInfo}
                disabled={fetching || !youtubeUrl.trim()}
                style={{ padding: '0 1.25rem', background: 'var(--card-border)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', cursor: fetching ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', whiteSpace: 'nowrap', opacity: !youtubeUrl.trim() ? 0.5 : 1 }}
              >
                {fetching ? '…' : 'Verificar'}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>YouTube, TikTok, Instagram, Twitter/X e 1000+ plataformas via yt-dlp</p>

            {/* Preview do vídeo */}
            {info && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                {info.thumbnail && (
                  <img src={info.thumbnail} alt="" style={{ width: '120px', borderRadius: '0.4rem', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.title}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                    {info.uploader && <span>{info.uploader} · </span>}
                    {info.duration && <span>{fmtDuration(info.duration)} · </span>}
                    <span style={{ textTransform: 'capitalize' }}>{info.platform}</span>
                  </p>
                  {info.formats.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>QUALIDADE</label>
                      <select
                        value={selectedFormat || ''}
                        onChange={e => setSelectedFormat(e.target.value)}
                        style={{ ...input, padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                      >
                        {info.formats.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.label}{f.height === 720 ? ' (recomendado)' : f.height >= 1080 ? ' (maior arquivo)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ ...card, border: `2px dashed ${file ? 'var(--accent)' : 'var(--card-border)'}`, textAlign: 'center', cursor: 'pointer', padding: '3rem' }}>
            <input ref={fileRef} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{file ? '✅' : '📁'}</div>
            {file ? (
              <p style={{ fontWeight: 600 }}>{file.name}</p>
            ) : (
              <>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Clique para selecionar o vídeo</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>MP4, MOV, AVI, MKV — até 4GB</p>
              </>
            )}
          </div>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading || (mode === 'url' ? !youtubeUrl : !file)}
          style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || (mode === 'url' ? !youtubeUrl : !file)) ? 0.6 : 1 }}
        >
          {loading ? 'Enviando…' : '🚀 Processar com IA'}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
