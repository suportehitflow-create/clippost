'use client'

import { useEffect } from 'react'

// Fim da conexão de redes: avisa o Clipost (a aba que abriu a janelinha) e fecha.
// Se a conexão foi aberta na mesma aba (janelinha bloqueada), volta para onde a pessoa estava.
export default function Conectado() {
  useEffect(() => {
    const aviso = { tipo: 'clipost:conectado' }
    try { window.opener?.postMessage(aviso, window.location.origin) } catch {}
    try { const c = new BroadcastChannel('clipost-conexao'); c.postMessage(aviso); c.close() } catch {}
    let voltar = '/settings#social'
    try { voltar = sessionStorage.getItem('clipost:voltar-conectado') || voltar } catch {}
    window.close()
    // não fechou (não era janelinha): volta para o site
    const t = setTimeout(() => { window.location.replace(voltar) }, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <main style={{ minHeight: '100vh', background: '#07070a', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '13px system-ui' }}>
      Redes conectadas. Voltando para o Clipost…
    </main>
  )
}
