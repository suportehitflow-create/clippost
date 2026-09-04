'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface LayoutConfig {
  video:    { x: number; y: number; w: number; h: number }
  avatar:   { x: number; y: number; w: number; h: number }
  hook:     { x: number; y: number }
  username: { x: number; y: number }
}

const DEFAULT_LAYOUT: LayoutConfig = {
  video:    { x: 0,   y: 0,   w: 1080, h: 1920 },
  avatar:   { x: 40,  y: 60,  w: 120,  h: 120 },
  hook:     { x: 540, y: 1600 },
  username: { x: 180, y: 95 },
}

export default function BrandKitPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const res = await fetch(`${API}/api/brand-kit/${data.user.id}`)
      if (res.ok) {
        const { brand_kit } = await res.json()
        if (brand_kit) {
          setUsername(brand_kit.username || '')
          setAvatarUrl(brand_kit.avatar_url || '')
          setAvatarPreview(brand_kit.avatar_url || '')
          setLayout(brand_kit.layout_config || DEFAULT_LAYOUT)
        }
      }
    })
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      setAvatarPreview(data.publicUrl)
    } catch (err: any) {
      setError('Erro no upload: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  function setLayoutField(section: keyof LayoutConfig, field: string, value: number) {
    setLayout(prev => ({
      ...prev,
      [section]: { ...(prev[section] as any), [field]: value },
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`${API}/api/brand-kit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          username,
          avatar_url: avatarUrl || null,
          layout_config: layout,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'var(--card, #18181b)',
    border: '1px solid var(--card-border, #27272a)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  }
  const label: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--muted, #71717a)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '0.4rem',
  }
  const input: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.9rem',
    background: 'var(--background, #09090b)',
    border: '1px solid var(--card-border, #27272a)',
    borderRadius: '0.5rem',
    color: 'var(--foreground, #fafafa)',
    fontSize: '0.95rem',
  }
  const numInput: React.CSSProperties = { ...input, width: '90px' }

  function NumField({ label: lbl, section, field, value }: { label: string; section: keyof LayoutConfig; field: string; value: number }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted, #71717a)' }}>{lbl}</span>
        <input
          type="number"
          value={value}
          onChange={e => setLayoutField(section, field, Number(e.target.value))}
          style={numInput}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background, #09090b)', color: 'var(--foreground, #fafafa)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid var(--card-border, #27272a)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.4rem' }}>🎨</span>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Brand Kit</span>
      </header>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <p style={{ color: 'var(--muted, #71717a)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Configure a identidade visual aplicada automaticamente nos seus clipes.
        </p>

        <form onSubmit={handleSave}>
          {/* Avatar */}
          <div style={card}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Avatar & Username</h2>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: '#27272a', border: '2px dashed #52525b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                  }}
                >
                  {avatarPreview
                    ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '2rem' }}>👤</span>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                <p style={{ fontSize: '0.72rem', color: 'var(--muted, #71717a)', marginTop: '0.4rem', textAlign: 'center' }}>
                  {uploading ? 'Enviando…' : 'Clique para trocar'}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={label}>@username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="@seuusuario"
                  style={input}
                />
              </div>
            </div>
          </div>

          {/* Posições */}
          <div style={card}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Posições no vídeo 9:16</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted, #71717a)', marginBottom: '1.25rem' }}>
              Coordenadas em pixels (base 1080×1920).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={{ ...label, marginBottom: '0.75rem' }}>Avatar</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <NumField label="X" section="avatar" field="x" value={layout.avatar.x} />
                  <NumField label="Y" section="avatar" field="y" value={layout.avatar.y} />
                  <NumField label="Largura" section="avatar" field="w" value={layout.avatar.w} />
                  <NumField label="Altura" section="avatar" field="h" value={layout.avatar.h} />
                </div>
              </div>

              <div>
                <p style={{ ...label, marginBottom: '0.75rem' }}>Username (texto)</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <NumField label="X" section="username" field="x" value={layout.username.x} />
                  <NumField label="Y" section="username" field="y" value={layout.username.y} />
                </div>
              </div>

              <div>
                <p style={{ ...label, marginBottom: '0.75rem' }}>Título do Gancho (Hook)</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <NumField label="X (centro)" section="hook" field="x" value={layout.hook.x} />
                  <NumField label="Y" section="hook" field="y" value={layout.hook.y} />
                </div>
              </div>
            </div>
          </div>

          {/* Preview visual simplificado */}
          <div style={card}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Preview (simplificado)</h2>
            <div style={{ position: 'relative', width: '180px', height: '320px', background: '#000', borderRadius: '0.5rem', margin: '0 auto', overflow: 'hidden' }}>
              {/* avatar dot */}
              <div style={{
                position: 'absolute',
                left: `${(layout.avatar.x / 1080) * 180}px`,
                top: `${(layout.avatar.y / 1920) * 320}px`,
                width: `${(layout.avatar.w / 1080) * 180}px`,
                height: `${(layout.avatar.h / 1920) * 320}px`,
                borderRadius: '50%', overflow: 'hidden',
                border: '2px solid #fff',
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: '#52525b' }} />
                }
              </div>
              {/* username */}
              {username && (
                <div style={{
                  position: 'absolute',
                  left: `${(layout.username.x / 1080) * 180}px`,
                  top: `${(layout.username.y / 1920) * 320}px`,
                  fontSize: '6px', color: '#fff', whiteSpace: 'nowrap',
                  textShadow: '0 0 2px #000',
                  transform: 'translateX(-50%)',
                }}>{username}</div>
              )}
              {/* hook */}
              <div style={{
                position: 'absolute',
                left: '50%', transform: 'translateX(-50%)',
                top: `${(layout.hook.y / 1920) * 320}px`,
                fontSize: '6px', color: 'yellow', whiteSpace: 'nowrap',
                textShadow: '0 0 2px #000',
              }}>Hook title aqui</div>
              {/* subtitle hint */}
              <div style={{
                position: 'absolute', bottom: '24px', left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '5px', color: '#fff', whiteSpace: 'nowrap',
                textShadow: '0 0 2px #000',
              }}>LEGENDAS AUTOMÁTICAS</div>
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}
          {saved && <p style={{ color: '#4ade80', fontSize: '0.85rem', marginBottom: '1rem' }}>✓ Brand Kit salvo!</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            style={{
              width: '100%', padding: '0.875rem',
              background: 'var(--accent, #7c3aed)', color: '#fff',
              border: 'none', borderRadius: '0.5rem',
              fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvando…' : '💾 Salvar Brand Kit'}
          </button>
        </form>
      </main>
    </div>
  )
}
