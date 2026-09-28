// Login com o Facebook (API oficial da Meta): conecta a Página + Instagram profissional.
// O callback (/api/auth/meta/callback) guarda o token da Página e o ID do Instagram em social_accounts;
// com isso o servidor lê perfis pela API oficial (Business Discovery) e publica no Instagram/Facebook.

export const META_APP_ID = (process.env.NEXT_PUBLIC_META_APP_ID || '').trim()

// business_management: sem ela, Páginas que estão num portfólio empresarial não aparecem em me/accounts
const PERMISSOES = ['instagram_basic', 'instagram_content_publish', 'pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'business_management']

/** Endereço do "Conectar com Facebook". `voltar` = página para onde volta depois de aprovar. */
export function urlConectarMeta(userId: string, voltar = '/settings') {
  const callback = `${window.location.origin}/api/auth/meta/callback`
  const destino = voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/settings'
  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(callback)}&scope=${encodeURIComponent(PERMISSOES.join(','))}&state=${encodeURIComponent(`${userId}~${destino}`)}`
}
