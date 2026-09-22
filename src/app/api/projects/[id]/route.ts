import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto não fornecido.' }, { status: 400 })
    }

    const admin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    })

    const { data: project, error: pErr } = await admin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle()

    if (pErr || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: clips } = await admin
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
    const admin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    })
    const { error } = await admin.from('projects').update(body).eq('id', projectId)
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

    const admin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    })

    // 1. Busca clipes associados para apagar posts agendados
    const { data: clips } = await admin
      .from('clips')
      .select('id, storage_path')
      .eq('project_id', projectId)

    if (clips && clips.length > 0) {
      const clipIds = clips.map(c => c.id)
      try { await admin.from('scheduled_posts').delete().in('clip_id', clipIds) } catch {}
      try { await admin.from('clips').delete().eq('project_id', projectId) } catch {}
    }

    // 2. Remove o projeto definitivamente da tabela projects
    const { error: delErr } = await admin
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (delErr) {
      console.error('Erro ao excluir projeto com chave administrativa:', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: projectId })
  } catch (e: any) {
    console.error('Erro fatal na rota DELETE /api/projects/[id]:', e)
    return NextResponse.json({ error: e.message || 'Falha interna ao excluir projeto.' }, { status: 500 })
  }
}
