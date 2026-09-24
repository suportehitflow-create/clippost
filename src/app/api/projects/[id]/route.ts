import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Campos que a tela do projeto altera; o resto (user_id, source_url...) não pode vir do cliente
const PATCHABLE_FIELDS = ['status', 'error_message', 'title'] as const

function makeAdmin() {
  if (SUPABASE_SERVICE_KEY) {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  }
  return null
}

// A service key ignora o RLS, então toda operação é filtrada pelo dono vindo da sessão
async function ownerContext() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return null
  return { user, db: (makeAdmin() ?? session) as any }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto não fornecido.' }, { status: 400 })
    }
    const ctx = await ownerContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: project, error: pErr } = await ctx.db
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', ctx.user.id)
      .maybeSingle()

    if (pErr || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: clips } = await ctx.db
      .from('clips')
      .select('*')
      .eq('project_id', projectId)
      .order('score', { ascending: false })

    return NextResponse.json(
      { project, clips: clips || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const ctx = await ownerContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const patch: Record<string, unknown> = {}
    for (const field of PATCHABLE_FIELDS) {
      if (field in body) patch[field] = body[field]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }

    const { data, error } = await ctx.db
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .eq('user_id', ctx.user.id)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto não fornecido.' }, { status: 400 })
    }
    const ctx = await ownerContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const db = ctx.db

    const { data: owned } = await db
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', ctx.user.id)
      .maybeSingle()
    if (!owned) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: clips } = await db
      .from('clips')
      .select('id, storage_path')
      .eq('project_id', projectId)

    if (clips && clips.length > 0) {
      const clipIds = clips.map((c: any) => c.id)
      try { await db.from('scheduled_posts').delete().in('clip_id', clipIds) } catch {}
      try { await db.from('clips').delete().eq('project_id', projectId) } catch {}
    }

    const { error: delErr } = await db
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', ctx.user.id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: projectId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha interna ao excluir projeto.' }, { status: 500 })
  }
}
