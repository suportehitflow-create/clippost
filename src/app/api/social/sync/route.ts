import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
  let accounts: any[] = []
  try {
    const res = await fetch(`${flyUrl}/api/social/accounts/${user.id}`)
    if (res.ok) {
      const body = await res.json()
      accounts = body.accounts || []
    }
  } catch {}

  let synced = 0
  const erros: string[] = []
  for (const acc of accounts) {
    const platform = acc.platform === 'youtube' ? 'youtube_shorts' : acc.platform
    // contas de outros perfis (grupos) ficam marcadas "<perfil>::<conta>"
    const base = acc.account_id || acc.handle || platform
    const account_id = acc.perfil && acc.perfil !== 'principal' ? `${acc.perfil}::${base}` : base
    // sem depender de índice único: procura a conta e atualiza, ou cria (o upsert falhava calado)
    const { data: existe, error: e1 } = await supabase.from('social_accounts').select('id')
      .eq('user_id', user.id).eq('platform', platform).eq('account_id', account_id).limit(1)
    const { error } = e1 ? { error: e1 } : existe?.length
      ? await supabase.from('social_accounts').update({ username: acc.handle }).eq('id', existe[0].id)
      // access_token vazio: o token dessas contas fica no serviço de publicação (a coluna não aceita nulo;
      // vazio também faz o agendador publicar pelo serviço, e não pela Meta)
      : await supabase.from('social_accounts').insert({ user_id: user.id, platform, account_id, username: acc.handle, access_token: '' })
    if (error) erros.push(`${platform}: ${error.message}`)
    else synced++
  }

  // template ainda com o texto de exemplo: nome, @ e foto vêm da conta conectada
  let template: unknown = null
  if (accounts.length) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      template = await fetch(`${flyUrl}/api/perfis/preencher-template`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(30000),
      }).then(r => r.json()).catch(() => null)
    }
  }

  return NextResponse.json({ synced, encontradas: accounts.map(a => a.platform), erros, template })
}
