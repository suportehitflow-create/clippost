import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

async function sessionUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await sessionUserId()
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/autopilot/settings/${userId}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'O servidor não respondeu.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId()
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })
  try {
    const { interval_minutes } = await req.json()
    const res = await fetch(`${BACKEND}/api/autopilot/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, interval_minutes }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Não foi possível salvar.' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'O servidor não respondeu.' }, { status: 502 })
  }
}
