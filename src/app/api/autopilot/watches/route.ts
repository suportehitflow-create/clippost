import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })

    const body = await req.json()
    const res = await fetch(`${BACKEND}/api/autopilot/watches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, user_id: user.id }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 })
  }
}
