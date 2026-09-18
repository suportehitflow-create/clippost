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
  for (const acc of accounts) {
    const platform = acc.platform === 'youtube' ? 'youtube_shorts' : acc.platform
    try {
      await supabase.from('social_accounts').upsert({
        user_id: user.id,
        platform,
        account_id: acc.account_id || acc.handle || platform,
        username: acc.handle,
        display_name: acc.handle,
      }, { onConflict: 'user_id,platform,account_id' })
      synced++
    } catch {}
  }

  // Set first account as active if none is
  const { data: existing } = await supabase
    .from('social_accounts')
    .select('id, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const hasActive = (existing || []).some(a => a.is_active)
  if (!hasActive && existing && existing.length > 0) {
    await supabase.from('social_accounts').update({ is_active: true }).eq('id', existing[0].id)
    await supabase.from('profiles').update({ active_social_account_id: existing[0].id }).eq('id', user.id)
  }

  return NextResponse.json({ synced })
}