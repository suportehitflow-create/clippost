import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

// Assistente "O que vamos criar?": repassa o pedido ao backend (Gemini/Groq) com o login do usuário
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ detail: 'Sessão expirada, entre de novo.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/assistente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(await req.json()),
      signal: AbortSignal.timeout(60000),
    })
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}
