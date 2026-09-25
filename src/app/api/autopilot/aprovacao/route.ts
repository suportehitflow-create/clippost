import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

// Autopilot com aprovação: GET lista os cortes aguardando e o histórico;
// POST { clip_ids, acao: 'aprovar' | 'recusar', legenda? } decide.
async function usuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await usuario()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/autopilot/aprovacao/${user.id}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const user = await usuario()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND}/api/autopilot/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clip_ids: body.clip_ids, acao: body.acao, legenda: body.legenda ?? null, user_id: user.id }),
      signal: AbortSignal.timeout(30000),
    })
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}
