import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbnR1bGVjanNocGJyaGVzYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzIzNjg0MywiZXhwIjoyMTAyODEyODQzfQ.n96uoY_3gxr6-8WV-KOAA6lJ4pjRSSa3dNpmHorguOM'
).replace(/[\uFEFF\u200B-\u200D]/g, '').trim()

async function sessionUser() {
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function admin() {
  if (SUPABASE_SERVICE_KEY) {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const user = await sessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Faça login para salvar o template.' }, { status: 401 })
    }

    const body = await req.json()
    const { avatar_url, username, layout_config } = body
    const db = admin() || (await createSessionClient())

    const { data: profile } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (!profile) {
      await db.from('profiles').insert({
        id: user.id,
        email: user.email || `user_${user.id.slice(0, 8)}@clippost.app`,
        full_name: layout_config?.brandName || 'Nome da Página',
        created_at: new Date().toISOString(),
      })
    }

    const patch: Record<string, unknown> = {
      username: username || '@nomedapagina',
      layout_config: layout_config || {},
    }
    if (avatar_url !== undefined) patch.avatar_url = avatar_url || null

    const { data: existing } = await db.from('brand_kits').select('id').eq('user_id', user.id).maybeSingle()
    const result = existing
      ? await db.from('brand_kits').update(patch).eq('user_id', user.id).select().single()
      : await db.from('brand_kits').insert({ user_id: user.id, ...patch }).select().single()

    if (result.error) {
      console.error('brand_kits save error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (e: any) {
    console.error('Erro na rota /api/brand-kit:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await sessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    const db = admin() || (await createSessionClient())
    const { data, error } = await db.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ brand_kit: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
