import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-[#ededed] font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24">
        {children}
      </div>
      <Sidebar user={user} />
    </div>
  )
}