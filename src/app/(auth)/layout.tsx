import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--background)' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--foreground)', fontWeight: 700, fontSize: '1.25rem', marginBottom: '2.5rem' }}>
        <Scissors size={22} color="var(--accent)" />
        Clip<span style={{ color: 'var(--accent)' }}>Post</span>
      </Link>
      {children}
    </div>
  )
}
