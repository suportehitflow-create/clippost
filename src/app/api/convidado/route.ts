import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient as createSession } from '@/lib/supabase/server'

// "Entrar como convidado": cria uma conta descartável com senha aleatória (nada fixo no repositório público).
// Plano sem limite de cortes: uso de teste. Antes de divulgar o site, voltar ao plano grátis ou remover o botão.
export async function POST(req: NextRequest) {
  // só aceita pedidos vindos do próprio site (barra chamadas de scripts em outros domínios)
  const origem = req.headers.get('origin')
  if (!origem || new URL(origem).host !== req.nextUrl.host) {
    return NextResponse.json({ error: 'Pedido não permitido.' }, { status: 403 })
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `convidado-${id}@clipost.app`
  const password = crypto.randomUUID() + crypto.randomUUID()

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'Convidado' },
  })
  if (error || !data.user) return NextResponse.json({ error: 'Não foi possível criar o convidado.' }, { status: 500 })

  // só duas pessoas usam o site por enquanto: convidado sem limite de cortes (revisar antes de abrir ao público)
  await admin.from('user_plans').upsert(
    { user_id: data.user.id, plan: 'pro', clips_used_this_month: 0, clips_limit: 999999 },
    { onConflict: 'user_id' },
  )

  const supabase = await createSession()
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
  if (loginErr) return NextResponse.json({ error: 'Convidado criado, mas o login falhou.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
