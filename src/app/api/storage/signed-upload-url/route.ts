import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbnR1bGVjanNocGJyaGVzYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzIzNjg0MywiZXhwIjoyMTAyODEyODQzfQ.n96uoY_3gxr6-8WV-KOAA6lJ4pjRSSa3dNpmHorguOM'
).replace(/[\uFEFF\u200B-\u200D]/g, '').trim()

function getAdminClient() {
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
