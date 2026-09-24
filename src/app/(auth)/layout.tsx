import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 bg-[#060608] text-[#f0f0ff] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.18),rgba(0,0,0,0))] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">ost</span>
          </span>
        </Link>
      </div>

      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>
    </div>
  )
}

