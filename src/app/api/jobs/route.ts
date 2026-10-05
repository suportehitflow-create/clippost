import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // O backend só aceita o pedido com o token de login do usuário (e usa o dono do token, não o corpo)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })
    }

    const body = await req.json()
    body.user_id = user.id
    const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

    // Precisa de await: em ambiente serverless a função é congelada assim que responde,
    // e um fetch "fire-and-forget" pode nunca chegar ao backend. O backend só enfileira
    // o pipeline e responde em segundos.
    const res = await fetch(`${flyUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn('[jobs] backend recusou:', res.status, detail.slice(0, 300))
      // Limite de uso ou login inválido: mostra ao usuário a mensagem real, não um erro genérico
      if (res.status === 429 || res.status === 401) {
        let msg = ''
        try { msg = JSON.parse(detail).detail } catch { /* corpo não era JSON */ }
        return NextResponse.json({ error: msg || 'Não foi possível iniciar agora. Tente novamente.' }, { status: res.status })
      }
      return NextResponse.json(
        { error: `O servidor de processamento recusou o pedido (${res.status}). Tente novamente.` },
        { status: 502 },
      )
    }

    return NextResponse.json({ status: 'processing', project_id: body.project_id })
  } catch (e: any) {
    console.warn('[jobs] backend Fly.io indisponível:', e)
    return NextResponse.json(
      { error: 'O servidor de processamento não respondeu. Tente novamente em instantes.' },
      { status: 502 },
    )
  }
}
