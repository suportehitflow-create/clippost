import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()
// A chave de servi\u00E7o vem S\u00D3 do ambiente (Vercel: SUPABASE_SERVICE_ROLE_KEY) \u2014 nunca no c\u00F3digo
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()

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

    const { bucket = 'videos', path, upsert = true } = await req.json()
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar URL assinada' }, { status: 500 })
  }
}
