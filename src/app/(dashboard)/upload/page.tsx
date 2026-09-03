'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react'

export default function UploadPage() {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Não autenticado'); setLoading(false); return }

    // Create project record
    const { data: project, error: dbError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: mode === 'url' ? youtubeUrl : file?.name ?? 'Upload',
        source_url: mode === 'url' ? youtubeUrl : null,
        source_type: mode,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError || !project) {
      setError('Erro ao criar projeto: ' + dbError?.message)
      setLoading(false)
      return
    }

    // If file upload, send to Supabase Storage
    if (mode === 'file' && file) {
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(`${user.id}/${project.id}/original.${file.name.split('.').pop()}`, file)
      if (uploadError) {
        setError('Erro no upload: ' + uploadError.message)
        setLoading(false)
        return
      }
    }

    // Send to Python backend for processing
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    await fetch(`${apiUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id, user_id: user.id, source_type: mode, source_url: mode === 'url' ? youtubeUrl : null }),
    }).catch(() => {})

    router.push(`/project/${project.id}`)
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Novo projeto</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>Importe um vídeo para gerar clipes virais com IA</p>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '0.375rem' }}>
        {(['url', 'file'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
            {m === 'url' ? '🔗 Link do YouTube' : '📁 Upload de arquivo'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'url' ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.75rem' }}>
              <LinkIcon size={15} /> URL do YouTube
            </label>
            <input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} required
              placeholder="https://youtube.com/watch?v=..."
              style={{ width: '100%', padding: '0.875rem 1rem', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>Suportamos YouTube, Vimeo e 1000+ plataformas via yt-dlp</p>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ background: 'var(--card)', border: `2px dashed ${file ? 'var(--accent)' : 'var(--card-border)'}`, borderRadius: '0.75rem', padding: '3rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' }}>
            <input ref={fileRef} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            <Upload size={32} style={{ margin: '0 auto 1rem', color: file ? 'var(--accent)' : 'var(--muted)' }} />
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

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

        <button type="submit" disabled={loading || (mode === 'url' ? !youtubeUrl : !file)}
          style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || (mode === 'url' ? !youtubeUrl : !file)) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</> : '🚀 Processar com IA'}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
