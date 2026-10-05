import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

// Carrosséis automáticos: repassa para o backend com o login do usuário.
// POST                → inicia a geração          GET ?job=<id> → andamento
// GET                 → carrosséis já feitos      DELETE ?id=<id> → apaga
// GET ?zip=<id>       → baixa os slides em .zip
async function token() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

const limpar = (v: string | null) => (v || '').replace(/[^\w-]/g, '')

async function repassar(caminho: string, init: RequestInit) {
  const t = await token()
  if (!t) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(120000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  return repassar('/api/carrosseis/gerar', { method: 'POST', body: JSON.stringify(await req.json()) })
}

export async function GET(req: NextRequest) {
  const job = limpar(req.nextUrl.searchParams.get('job'))
  if (job) return repassar(`/api/carrosseis/job/${job}`, { method: 'GET', cache: 'no-store' })

  const zip = limpar(req.nextUrl.searchParams.get('zip'))
  if (zip) {
    const t = await token()
    if (!t) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
    const res = await fetch(`${BACKEND}/api/carrosseis/${zip}/zip`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(120000) })
    if (!res.ok || !res.body) return NextResponse.json({ detail: 'Não foi possível baixar o carrossel.' }, { status: res.status || 502 })
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': res.headers.get('content-disposition') || 'attachment; filename="carrossel.zip"',
      },
    })
  }
  return repassar('/api/carrosseis', { method: 'GET', cache: 'no-store' })
}

export async function DELETE(req: NextRequest) {
  const id = limpar(req.nextUrl.searchParams.get('id'))
  if (!id) return NextResponse.json({ detail: 'id obrigatório' }, { status: 400 })
  return repassar(`/api/carrosseis/${id}`, { method: 'DELETE' })
}
