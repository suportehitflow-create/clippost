import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

// Vídeos com frases: repassa para o backend com o login do usuário.
// POST /api/frases → inicia a geração; GET /api/frases?job=<id> → andamento
async function token() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function repassar(caminho: string, init: RequestInit) {
  const t = await token()
  if (!t) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}${caminho}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(60000) })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  return repassar('/api/frases/gerar', { method: 'POST', body: JSON.stringify(await req.json()) })
}

export async function GET(req: NextRequest) {
  const job = (req.nextUrl.searchParams.get('job') || '').replace(/[^\w-]/g, '')
  if (!job) return NextResponse.json({ detail: 'job obrigatório' }, { status: 400 })
  return repassar(`/api/frases/${job}`, { method: 'GET', cache: 'no-store' })
}
