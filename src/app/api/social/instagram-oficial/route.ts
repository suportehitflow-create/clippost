import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

// API oficial do Instagram (Business Discovery): status / salvar / remover — repassa com o login do usuário
async function repassar(req: NextRequest, metodo: 'GET' | 'POST' | 'DELETE', caminho: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ detail: 'Sessão expirada, entre de novo.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: metodo === 'POST' ? JSON.stringify(await req.json()) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

export const GET = (req: NextRequest) => repassar(req, 'GET', '/api/instagram-oficial/status')
export const POST = (req: NextRequest) => repassar(req, 'POST', '/api/instagram-oficial')
export const DELETE = (req: NextRequest) => repassar(req, 'DELETE', '/api/instagram-oficial')
