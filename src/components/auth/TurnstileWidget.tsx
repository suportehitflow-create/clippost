'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

// Chave pública do Turnstile (Cloudflare). Sem ela o widget não aparece e o cadastro funciona sem desafio.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function carregarScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const s = existente ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true, defer: true })
    s.addEventListener('load', () => resolve())
    s.addEventListener('error', () => reject(new Error('turnstile')))
    if (!existente) document.head.appendChild(s)
  })
}

/** Desafio anti-robô. Chama onToken(token) quando passa e onToken(null) se expirar ou falhar. Sem sitekey, não renderiza. */
export default function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  const idWidget = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !caixa.current) return
    let cancelado = false
    carregarScript()
      .then(() => {
        if (cancelado || !caixa.current || !window.turnstile) return
        idWidget.current = window.turnstile.render(caixa.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))
    return () => {
      cancelado = true
      if (idWidget.current && window.turnstile) window.turnstile.remove(idWidget.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={caixa} className="flex justify-center min-h-[65px]" />
}
