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
  const userId = state // state = user_id passed in the OAuth init

  for (const page of (pagesData.data || [])) {
    // Save Facebook Page
    await supabase.from('social_accounts').upsert({
      user_id: userId,
      platform: 'facebook',
      account_id: page.id,
      username: page.name.toLowerCase().replace(/\s+/g, '_'),
      display_name: page.name,
      page_token: page.access_token,
      access_token: page.access_token,
    }, { onConflict: 'user_id,platform,account_id' })

    // Save Instagram Business Account linked to this Page
    if (page.instagram_business_account?.id) {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?fields=id,name,username,profile_picture_url&access_token=${page.access_token}`
        )
        const ig = await igRes.json()
        if (!ig.error) {
          await supabase.from('social_accounts').upsert({
            user_id: userId,
            platform: 'instagram',
            account_id: ig.id,
            username: ig.username,
            display_name: ig.name,
            avatar_url: ig.profile_picture_url || null,
            page_token: page.access_token,
            access_token: page.access_token,
          }, { onConflict: 'user_id,platform,account_id' })
        }
      } catch {}
    }
  }

  // Set first account active if none is
  const { data: existing } = await supabase
    .from('social_accounts')
    .select('id, is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const hasActive = (existing || []).some((a: any) => a.is_active)
  if (!hasActive && existing && existing.length > 0) {
    await supabase.from('social_accounts').update({ is_active: true }).eq('id', existing[0].id)
    await supabase.from('profiles').update({ active_social_account_id: existing[0].id }).eq('id', userId)
  }

  return NextResponse.redirect(`${siteUrl}/settings?meta_connected=1`)
}