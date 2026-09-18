import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id, platform, username, display_name, avatar_url, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ accounts: accounts || [] })
}