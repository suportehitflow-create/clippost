import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://clippost-three.vercel.app'

  if (error) return NextResponse.redirect(`${siteUrl}/settings?meta_error=${encodeURIComponent(error)}`)
  if (!code || !state) return NextResponse.redirect(`${siteUrl}/settings?meta_error=missing_params`)

  const META_APP_ID = process.env.META_APP_ID
  const META_APP_SECRET = process.env.META_APP_SECRET
  const CALLBACK_URL = `${siteUrl}/api/auth/meta/callback`

  if (!META_APP_ID || !META_APP_SECRET) {
    return NextResponse.redirect(`${siteUrl}/settings?meta_error=app_not_configured`)
  }

  // 1. Code -> short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&code=${code}`
  )
  const tokenData = await tokenRes.json()
  if (tokenData.error) return NextResponse.redirect(`${siteUrl}/settings?meta_error=${encodeURIComponent(tokenData.error.message)}`)
  const shortToken = tokenData.access_token

  // 2. short-lived -> long-lived (60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`
  )
  const llData = await llRes.json()
  const longToken = llData.access_token || shortToken

  // 3. Fetch Pages + linked IG accounts
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}&fields=id,name,access_token,instagram_business_account`
  )
  const pagesData = await pagesRes.json()

  const supabase = await createClient()
  // O dono das contas é quem está logado (o state só confirma que o fluxo começou nesta sessão)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl}/login`)
  if (state !== user.id) return NextResponse.redirect(`${siteUrl}/settings?meta_error=${encodeURIComponent('Sessão diferente da que iniciou a conexão. Tente de novo.')}`)
  const userId = user.id

  // Colunas que existem em social_accounts: user_id, platform, account_id, username, access_token
  // (o token da página vai em access_token — é o que o publicador usa)
  let salvas = 0
  let erroSalvar = ''
  for (const page of (pagesData.data || [])) {
    const fb = await supabase.from('social_accounts').upsert({
      user_id: userId,
      platform: 'facebook',
      account_id: page.id,
      username: page.name.toLowerCase().replace(/\s+/g, '_'),
      access_token: page.access_token,
    }, { onConflict: 'user_id,platform,account_id' })
    if (fb.error) erroSalvar = fb.error.message
    else salvas++

    // Instagram profissional ligado a esta Página
    if (page.instagram_business_account?.id) {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?fields=id,username&access_token=${page.access_token}`
        )
        const ig = await igRes.json()
        if (!ig.error) {
          const r = await supabase.from('social_accounts').upsert({
            user_id: userId,
            platform: 'instagram',
            account_id: ig.id,
            username: ig.username,
            access_token: page.access_token,
          }, { onConflict: 'user_id,platform,account_id' })
          if (r.error) erroSalvar = r.error.message
          else salvas++
        }
      } catch {}
    }
  }

  if (!salvas) {
    const motivo = erroSalvar || 'Nenhuma Página do Facebook/Instagram profissional foi autorizada.'
    return NextResponse.redirect(`${siteUrl}/settings?meta_error=${encodeURIComponent(motivo)}`)
  }

  // Sem conta ativa no perfil: a primeira passa a ser a ativa
  const { data: perfil } = await supabase.from('profiles').select('active_social_account_id').eq('id', userId).maybeSingle()
  if (!perfil?.active_social_account_id) {
    const { data: primeira } = await supabase.from('social_accounts').select('id').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (primeira) await supabase.from('profiles').update({ active_social_account_id: primeira.id }).eq('id', userId)
  }

  return NextResponse.redirect(`${siteUrl}/settings?meta_connected=1`)
}