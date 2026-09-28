'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// O Explorador agora mora na Edição em Massa (aba "Buscar de um perfil").
// Este endereço continua valendo (Assistente, extensão, links antigos) e leva para lá com os mesmos parâmetros.
export default function ExplorarRedireciona() {
  const router = useRouter()
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    q.set('aba', 'perfil')
    router.replace(`/bulk?${q.toString()}`)
  }, [router])
  return <div className="flex-1 min-h-screen bg-[#07070a]" />
}