import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clipost — A Plataforma Definitiva para Clipadores',
  description: 'Do silêncio ao viral em 3 passos. Mineração de YouTube e Instagram, cortes com IA, reenquadramento inteligente, edição em massa com Brand Kit e agendamento automático.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* guarda o que a pessoa digita/cola antes da página terminar de carregar (senão o campo volta vazio) */}
        <script dangerouslySetInnerHTML={{ __html: "window.__clipostDigitado={};document.addEventListener('input',function(e){var t=e.target;if(t&&t.id)window.__clipostDigitado[t.id]=t.value},true)" }} />
        {children}
      </body>
    </html>
  )
}
