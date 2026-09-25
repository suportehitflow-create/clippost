import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()
// A chave de servi\u00E7o vem S\u00D3 do ambiente (Vercel: SUPABASE_SERVICE_ROLE_KEY) \u2014 nunca no c\u00F3digo.
// Sem ela, cai para a sess\u00E3o do usu\u00E1rio (RLS).
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\uFEFF\u200B-\u200D]/g, '').trim()

async function sessionUser() {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

function admin() {
  if (SUPABASE_SERVICE_KEY) {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sUser = await sessionUser()
    const userId = body.user_id || sUser?.id

    if (!userId) {
      return NextResponse.json({ error: 'Faça login para salvar o template.' }, { status: 401 })
    }

    const { avatar_url, username, layout_config } = body
    const db = admin() || (await createSessionClient())

    // Garante que o profile existe
    const { data: profile } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (!profile) {
      await db.from('profiles').insert({
        id: userId,
        email: sUser?.email || `user_${userId.slice(0, 8)}@clippost.app`,
        full_name: layout_config?.brandName || 'Nome da Página',
        created_at: new Date().toISOString(),
      })
    } else if (layout_config?.brandName) {
      await db.from('profiles').update({ full_name: layout_config.brandName }).eq('id', userId)
    }

    const patch: Record<string, unknown> = {
      username: username || layout_config?.brandHandle || '@nomedapagina',
      layout_config: layout_config || {},
    }
    if (avatar_url !== undefined) patch.avatar_url = avatar_url || null

    const { data: existing } = await db.from('brand_kits').select('id').eq('user_id', userId).maybeSingle()
    const result = existing
      ? await db.from('brand_kits').update(patch).eq('user_id', userId).select().single()
      : await db.from('brand_kits').insert({ user_id: userId, ...patch }).select().single()

    if (result.error) {
      console.error('brand_kits save error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, brand_kit: result.data })
  } catch (e: any) {
    console.error('Erro na rota /api/brand-kit:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const sUser = await sessionUser()
    const userId = req.nextUrl.searchParams.get('user_id') || sUser?.id

    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const db = admin() || (await createSessionClient())
    const { data, error } = await db.from('brand_kits').select('*').eq('user_id', userId).maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, brand_kit: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
