import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  const client = createBrowserClient(url, key)

  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (jwt?: string) => {
    const res = await originalGetUser(jwt)
    if (res.data?.user) return res

    // Se estiver em modo de teste rápido pelo cookie ou localStorage
    if (typeof window !== 'undefined') {
      const isDemo = document.cookie.includes('clippost_demo_auth=true') ||
                     localStorage.getItem('clippost_demo_auth') === 'true'
      if (isDemo) {
        const demoId = localStorage.getItem('clippost_demo_user_id') || 'a0000000-0000-0000-0000-000000000001'
        const demoEmail = localStorage.getItem('clippost_demo_user_email') || 'teste@clippost.com'
        return {
          data: {
            user: {
              id: demoId,
              email: demoEmail,
              app_metadata: { provider: 'email' },
              user_metadata: { name: 'Usuário de Teste' },
              aud: 'authenticated',
              role: 'authenticated',
              created_at: new Date().toISOString()
            } as any
          },
          error: null
        }
      }
    }

    return res
  }

  return client
}
