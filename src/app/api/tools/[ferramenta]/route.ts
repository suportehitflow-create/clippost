import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
const PERMITIDAS = new Set(['youtube-texto', 'raio-x'])

// Ferramentas rápidas (YouTube → texto, Raio-X do perfil): repassa para o backend com o login do usuário
export async function POST(req: NextRequest, { params }: { params: Promise<{ ferramenta: string }> }) {
  const { ferramenta } = await params
  if (!PERMITIDAS.has(ferramenta)) return NextResponse.json({ detail: 'Ferramenta desconhecida' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ detail: 'Sessão expirada, entre de novo.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/tools/${ferramenta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(await req.json()),
      signal: AbortSignal.timeout(180000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}
