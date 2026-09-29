import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PREFIXO_LOTE, idsDoLote } from '@/lib/lote'

// Lotes (vários vídeos cortados juntos, um editor em massa só):
//  GET  → os projetos recentes que ainda não estão em nenhum lote
//  POST { ids, titulo } → junta esses projetos num lote e devolve o id dele
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data, error } = await supabase.from('projects').select('id, title, source_url, status, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 })
  const emLote = new Set((data ?? []).flatMap(p => idsDoLote(p.source_url) ?? []))
  return NextResponse.json({
    projetos: (data ?? []).filter(p => !idsDoLote(p.source_url) && !emLote.has(p.id) && !String(p.source_url || '').startsWith('clipost:')),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const pedidos: string[] = Array.isArray(body.ids) ? body.ids.map(String) : []
  // só projetos da própria pessoa
  const { data: meus } = await supabase.from('projects').select('id').eq('user_id', user.id).in('id', pedidos.length ? pedidos : ['-'])
  const validos = new Set((meus ?? []).map(p => p.id))
  const ids = pedidos.filter(id => validos.has(id))
  if (!ids.length) return NextResponse.json({ detail: 'Nenhum vídeo para juntar.' }, { status: 400 })
  const titulo = String(body.titulo || '').trim().slice(0, 120) || `${ids.length} vídeos`
  const { data: lote, error } = await supabase.from('projects').insert({
    user_id: user.id, title: titulo, source_url: PREFIXO_LOTE + ids.join(','), source_type: 'url', status: 'processing',
  }).select('id').single()
  if (error || !lote) return NextResponse.json({ detail: error?.message || 'Não deu para criar o lote.' }, { status: 500 })
  return NextResponse.json({ id: lote.id, videos: ids.length })
}
