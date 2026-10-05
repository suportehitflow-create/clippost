import Link from 'next/link'
import type { ReactNode } from 'react'

// Página de texto corrido (termos e privacidade): pública, legível no celular e sem dependência do app.
export default function DocumentoLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0c] text-zinc-300 px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link href="/login" className="text-xs text-indigo-400 hover:text-indigo-300">← Voltar</Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{titulo}</h1>
        <p className="mt-1 text-xs text-zinc-500">Última atualização: {atualizado}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-indigo-400">
          {children}
        </div>
        <nav className="mt-12 flex gap-4 border-t border-white/10 pt-6 text-xs text-zinc-500">
          <Link href="/termos" className="hover:text-zinc-300">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:text-zinc-300">Política de Privacidade</Link>
        </nav>
      </main>
    </div>
  )
}

// Defina NEXT_PUBLIC_CONTATO_EMAIL no build para mostrar o e-mail de contato; sem isso, o texto pede para definir.
export const CONTATO = process.env.NEXT_PUBLIC_CONTATO_EMAIL || '[definir e-mail de contato]'
