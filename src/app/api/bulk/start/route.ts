import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })

  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND}/api/bulk/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, user_id: user.id }),
      signal: AbortSignal.timeout(25_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || `O servidor recusou o lote (${res.status}).` }, { status: 502 })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'O servidor de processamento não respondeu. Tente novamente.' }, { status: 502 })
  }
}
