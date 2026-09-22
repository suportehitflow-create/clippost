import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function makeAdmin() {
  if (SUPABASE_SERVICE_KEY) {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  }
  return null
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

    const admin = makeAdmin()
    // Se não tiver service key, usa o cliente autenticado pelo cookie do usuário
    const db = admin ?? await createClient()

    const { data: project, error: pErr } = await (db as any)
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle()

    if (pErr || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: clips } = await (db as any)
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
    const body = await req.json()
    const admin = makeAdmin()
    const db = admin ?? await createClient()
    const { error } = await (db as any).from('projects').update(body).eq('id', projectId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

    const admin = makeAdmin()
    const db = admin ?? await createClient()

    const { data: clips } = await (db as any)
      .from('clips')
      .select('id, storage_path')
      .eq('project_id', projectId)

    if (clips && clips.length > 0) {
      const clipIds = clips.map((c: any) => c.id)
      try { await (db as any).from('scheduled_posts').delete().in('clip_id', clipIds) } catch {}
      try { await (db as any).from('clips').delete().eq('project_id', projectId) } catch {}
    }

    const { error: delErr } = await (db as any)
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: projectId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha interna ao excluir projeto.' }, { status: 500 })
  }
}
