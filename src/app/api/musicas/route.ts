import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

// Biblioteca de músicas do usuário: arquivos em videos/<user>/musicas/ (o upload usa
// /api/storage/signed-upload-url). Aqui só listar e apagar.

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co').replace(/[﻿​-‍]/g, '').trim()
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[﻿​-‍]/g, '').trim()
const BUCKET = 'videos'

function admin() {
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor')
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

async function usuario() {
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await usuario()
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })
  try {
    const sb = admin().storage.from(BUCKET)
    const pasta = `${user.id}/musicas`
    const { data, error } = await sb.list(pasta, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) throw error
    const musicas = (data || [])
      .filter(f => f.id && !f.name.startsWith('.'))
      .map(f => ({
        path: `${pasta}/${f.name}`,
        nome: f.name.replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' '),
        url: sb.getPublicUrl(`${pasta}/${f.name}`).data.publicUrl,
        tamanho: (f.metadata as any)?.size ?? null,
        criada: f.created_at,
      }))
    return NextResponse.json({ musicas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não consegui listar as músicas.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await usuario()
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })
  const path = req.nextUrl.searchParams.get('path') || ''
  if (!path.startsWith(`${user.id}/musicas/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Música não encontrada.' }, { status: 404 })
  }
  const { error } = await admin().storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
