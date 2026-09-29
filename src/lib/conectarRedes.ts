'use client'

// Conectar redes sem sair do Clipost: a tela de autorização abre numa janelinha por cima do site.
// Quando a pessoa termina, a janelinha vai para /conectado, que avisa o site e se fecha sozinha;
// o site sincroniza as contas e mostra a rede nova na hora. Se o navegador bloquear a janelinha,
// abre na mesma aba (e /conectado traz a pessoa de volta).

export async function conectarRedes(perfilId: string, aoTerminar?: () => void): Promise<string | null> {
  // abre já no clique (senão o navegador bloqueia) e só depois põe o endereço
  const w = 520
  const h = 760
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
  const janela = window.open('about:blank', 'clipost-conectar', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
  if (janela) {
    try {
      janela.document.title = 'Conectar redes · Clipost'
      janela.document.body.style.cssText = 'margin:0;background:#07070a;color:#a1a1aa;font:13px system-ui;display:flex;align-items:center;justify-content:center;height:100vh'
      janela.document.body.textContent = 'Abrindo…'
    } catch {}
  }

  const r = await fetch('/api/perfis/conectar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: perfilId }),
  }).catch(() => null)
  const d = r ? await r.json().catch(() => ({})) : {}
  if (!d.access_url) {
    janela?.close()
    return d.detail || d.error || 'Não foi possível abrir a conexão agora. Tente de novo em instantes.'
  }

  try { sessionStorage.setItem('clipost:voltar-conectado', window.location.pathname + window.location.search) } catch {}
  if (!janela || janela.closed) {
    window.location.href = d.access_url
    return null
  }
  janela.location.href = d.access_url

  // atualiza quando /conectado avisa (postMessage ou, se a página da conexão cortou o vínculo com o
  // site, BroadcastChannel) ou quando a janelinha some; escuta por até 20 min
  const atualizar = async () => {
    await fetch('/api/social/sync', { method: 'POST' }).catch(() => null)
    aoTerminar?.()
  }
  const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('clipost-conexao') : null
  const aoAviso = (dados: any) => { if (dados?.tipo === 'clipost:conectado') atualizar() }
  const aoMensagem = (e: MessageEvent) => { if (e.origin === window.location.origin) aoAviso(e.data) }
  window.addEventListener('message', aoMensagem)
  if (canal) canal.onmessage = e => aoAviso(e.data)
  let fechou = false
  const vigia = setInterval(() => { if (!fechou && janela.closed) { fechou = true; atualizar() } }, 800)
  setTimeout(() => { clearInterval(vigia); window.removeEventListener('message', aoMensagem); canal?.close() }, 20 * 60 * 1000)
  return null
}
