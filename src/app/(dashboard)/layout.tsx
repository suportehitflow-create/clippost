import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './Sidebar'
import ProfileSwitcher from '@/components/ProfileSwitcher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-[#ededed] font-sans antialiased selection:bg-orange-500/30 selection:text-orange-200">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24">
        {/* Top bar com profile switcher */}
        <header className="sticky top-0 z-40 flex items-center justify-end px-6 py-2.5 border-b border-white/[0.05] bg-[#0a0a0c]/80 backdrop-blur-md">
          <ProfileSwitcher userId={user.id} />
        </header>
        {children}
      </div>
      <Sidebar user={user} />
    </div>
  )
}