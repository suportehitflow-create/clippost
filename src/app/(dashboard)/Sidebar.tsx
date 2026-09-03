'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Scissors, LayoutDashboard, Upload, Calendar, CreditCard, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload', icon: Upload, label: 'Novo clipe' },
  { href: '/schedule', icon: Calendar, label: 'Agendamentos' },
  { href: '/billing', icon: CreditCard, label: 'Plano' },
]

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{ width: '220px', flexShrink: 0, background: 'var(--card)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', padding: '1.5rem 0' }}>
      <div style={{ padding: '0 1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.15rem', borderBottom: '1px solid var(--card-border)', marginBottom: '1rem' }}>
        <Scissors size={18} color="var(--accent)" />
        Clip<span style={{ color: 'var(--accent)' }}>Post</span>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.75rem' }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.9rem', fontWeight: active ? 600 : 400, color: active ? 'var(--foreground)' : 'var(--muted)', background: active ? 'rgba(124,58,237,0.15)' : 'transparent', transition: 'all 0.15s' }}>
              <Icon size={17} color={active ? 'var(--accent)' : undefined} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--card-border)', marginTop: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0' }}>
          <LogOut size={14} /> Sair
        </button>
      </div>
    </aside>
  )
}
