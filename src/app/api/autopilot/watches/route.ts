import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

async function usuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

const naoLogado = () => NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })

// Lista os canais/perfis monitorados (com a opção "Postar automaticamente" de cada um)
export async function GET() {
  const { user } = await usuario()
  if (!user) return naoLogado()
  try {
    const res = await fetch(`${BACKEND}/api/autopilot/watches/${user.id}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

// Cadastra um canal do YouTube ou perfil do Instagram/TikTok/Facebook
export async function POST(req: NextRequest) {
  const { user } = await usuario()
  if (!user) return naoLogado()
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND}/api/autopilot/watches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, user_id: user.id }),
      signal: AbortSignal.timeout(90000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 })
  }
}

// { id, auto_post?, is_active? }
export async function PATCH(req: NextRequest) {
  const { user } = await usuario()
  if (!user) return naoLogado()
  try {
    const { id, ...campos } = await req.json()
    const res = await fetch(`${BACKEND}/api/autopilot/watches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...campos, user_id: user.id }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 })
  }
}

// ?id=... — remove com a sessão do usuário (RLS garante que é dele)
export async function DELETE(req: NextRequest) {
  const { supabase, user } = await usuario()
  if (!user) return naoLogado()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ detail: 'id obrigatório' }, { status: 400 })
  const { error } = await supabase.from('channel_watches').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
