import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()
// A chave de servi\u00E7o vem S\u00D3 do ambiente (Vercel: SUPABASE_SERVICE_ROLE_KEY) \u2014 nunca no c\u00F3digo
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
const SUPABASE_SERVICE_KEY =(process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()

function getAdminClient() {
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY n\u00E3o configurada no servidor')
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { bucket = 'videos', path, paths, upsert = true } = await req.json()

    // vídeos: quem decide onde guardar é o servidor (Cloudflare R2, com 10 GB grátis; ou o Supabase)
    const lista: string[] = Array.isArray(paths) ? paths : path ? [path] : []
    if (bucket === 'videos' && lista.length && lista.every(p => String(p).replace(/^\/+/, '').startsWith(`${user.id}/`))) {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`${BACKEND}/api/armazenamento/links-de-envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ paths: lista }),
        signal: AbortSignal.timeout(30000),
      }).catch(() => null)
      const d = r ? await r.json().catch(() => ({})) : {}
      if (r?.ok && Array.isArray(d.urls)) {
        return NextResponse.json(Array.isArray(paths) ? { urls: d.urls } : d.urls[0])
      }
      // servidor fora: cai para o Supabase abaixo
    }
    // vários de uma vez (vídeo grande subido em partes de até 45 MB: o limite é 50 MB por arquivo)
    if (Array.isArray(paths)) {
      const lista = paths.map((p: string) => String(p || '').replace(/^\/+/, '')).slice(0, 60)
      if (!lista.length || lista.some(p => !p.startsWith(`${user.id}/`))) {
        return NextResponse.json({ error: 'Acesso não autorizado a este caminho' }, { status: 403 })
      }
      const admin = getAdminClient()
      const urls = await Promise.all(lista.map(async p => {
        const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(p, { upsert })
        if (error) throw new Error(error.message)
        return { signedUrl: data.signedUrl, path: data.path, publicUrl: admin.storage.from(bucket).getPublicUrl(data.path).data.publicUrl }
      }))
      return NextResponse.json({ urls })
    }
    if (!path) {
      return NextResponse.json({ error: 'Caminho (path) é obrigatório' }, { status: 400 })
    }

    // Permite pastas do usuário ou uploads do avatar/marca
    const normalized = path.replace(/^\/+/, '')
    if (!normalized.startsWith(`${user.id}/`) && !normalized.startsWith(`avatars/`)) {
      return NextResponse.json({ error: 'Acesso não autorizado a este caminho' }, { status: 403 })
    }

    const admin = getAdminClient()
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(normalized, { upsert })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
      publicUrl: admin.storage.from(bucket).getPublicUrl(data.path).data.publicUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar URL assinada' }, { status: 500 })
  }
}
