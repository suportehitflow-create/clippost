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
      : await supabase.from('social_accounts').insert({ user_id: user.id, platform, account_id, username: acc.handle })
    if (error) erros.push(`${platform}: ${error.message}`)
    else synced++
  }

  return NextResponse.json({ synced, encontradas: accounts.map(a => a.platform), erros })
}
