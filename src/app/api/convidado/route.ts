import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient as createSession } from '@/lib/supabase/server'

// Conta de convidado para testes: só funciona com a chave secreta DEMO_KEY (segredo do Worker, nunca no código).
// Cada clique cria uma conta nova e descartável com senha aleatória, então nada fixo fica no repositório público.
export async function POST(req: NextRequest) {
  const esperada = process.env.DEMO_KEY || ''
  const { key } = await req.json().catch(() => ({ key: '' }))
  if (!esperada || typeof key !== 'string' || key !== esperada) {
    return NextResponse.json({ error: 'Convite inválido.' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const admin = createAdmin(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `convidado-${id}@clipost.app`
  const password = crypto.randomUUID() + crypto.randomUUID()

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'Convidado' },
  })
  if (error || !data.user) return NextResponse.json({ error: 'Não foi possível criar o convidado.' }, { status: 500 })

  // plano sem limite de cortes, só para o teste (o limite de vídeos por hora do servidor continua valendo)
  await admin.from('user_plans').upsert(
    { user_id: data.user.id, plan: 'pro', clips_used_this_month: 0, clips_limit: 999999 },
    { onConflict: 'user_id' },
  )

  const supabase = await createSession()
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
  if (loginErr) return NextResponse.json({ error: 'Convidado criado, mas o login falhou.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
