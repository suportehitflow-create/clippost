import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id, platform, username, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const mapped = (accounts || []).map((acc: any) => ({
    id: acc.id,
    platform: acc.platform,
    username: acc.username,
    display_name: acc.username ? `@${acc.username}` : 'Conta',
    avatar_url: null,
    is_active: false,
    created_at: acc.created_at,
  }))

  return NextResponse.json({ accounts: mapped })
}
