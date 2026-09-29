'use client'

import { useEffect, useState } from 'react'

// Fim da conexão de uma rede: a rede devolve para cá com ?connect_status=success|cancelled|error.
// Avisa o Clipost (a aba que abriu a janelinha) e fecha. Se a conexão foi aberta na mesma aba
// (janelinha bloqueada), volta para onde a pessoa estava.
export default function Conectado() {
  const [texto, setTexto] = useState('Voltando para o Clipost…')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const status = q.get('connect_status') || 'success'
    const aviso = { tipo: 'clipost:conectado', status, rede: q.get('platform'), erro: q.get('error_code') }
    setTexto(status === 'success' ? 'Conta conectada. Voltando para o Clipost…' : 'Conexão não concluída. Voltando para o Clipost…')
    try { window.opener?.postMessage(aviso, window.location.origin) } catch {}
    try { const c = new BroadcastChannel('clipost-conexao'); c.postMessage(aviso); c.close() } catch {}
    let voltar = '/settings#social'
    try { voltar = sessionStorage.getItem('clipost:voltar-conectado') || voltar } catch {}
    const fechar = setTimeout(() => window.close(), 300)
    // não fechou (não era janelinha): volta para o site com o resultado
    const t = setTimeout(() => {
      const u = new URL(voltar, window.location.origin)
      u.searchParams.set('conexao', status)
      if (aviso.erro) u.searchParams.set('erro_conexao', aviso.erro)
      window.location.replace(u.pathname + u.search + u.hash)
    }, 1200)
    return () => { clearTimeout(fechar); clearTimeout(t) }
  }, [])

  return (
    <main style={{ minHeight: '100vh', background: '#07070a', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '13px system-ui' }}>
      {texto}
    </main>
  )
}
