'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Posts, carrosséis e stories em massa agora ficam em Calendário → Agendar em massa.
export default function PostsRedireciona() {
  const router = useRouter()
  useEffect(() => { router.replace('/schedule?aba=massa&tipo=carrossel') }, [router])
  return <div className="flex-1 min-h-screen bg-[#07070a]" />
}