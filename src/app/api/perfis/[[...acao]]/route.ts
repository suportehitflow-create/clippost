import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
const ACOES = new Set(['', 'conectar', 'ativar', 'renomear'])

// Perfis (marca): lista, cria, conecta redes, troca o ativo e renomeia (o backend valida o login de novo)
async function repassar(req: NextRequest, acao: string[] | undefined, metodo: 'GET' | 'POST') {
  const caminho = (acao || []).join('/')
  if (!ACOES.has(caminho)) return NextResponse.json({ detail: 'Ação desconhecida.' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ detail: 'Sessão expirada, entre de novo.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/perfis${caminho ? `/${caminho}` : ''}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: metodo === 'POST' ? JSON.stringify(await req.json().catch(() => ({}))) : undefined,
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ acao?: string[] }> }) {
  return repassar(req, (await params).acao, 'GET')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ acao?: string[] }> }) {
  return repassar(req, (await params).acao, 'POST')
}
