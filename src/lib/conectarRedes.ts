'use client'

// Conectar uma rede sem sair do Clipost: a pessoa escolhe a rede na tela do Clipost e a janelinha abre
// direto no login da própria rede (Instagram, Facebook, TikTok, Google). No fim a rede devolve para
// /conectado, que avisa o site com o resultado e se fecha. Se o navegador bloquear a janelinha, abre
// na mesma aba e /conectado traz a pessoa de volta para onde estava.

export type Rede = 'instagram' | 'facebook' | 'tiktok' | 'youtube'
export type Resultado = { status: 'success' | 'cancelled' | 'error'; erro?: string }

const ERROS: Record<string, string> = {
  ACCESS_DENIED: 'Conexão cancelada.',
  PROVIDER_ERROR: 'A rede recusou a conexão. Tente de novo.',
  INVALID_STATE: 'O link de conexão expirou. Tente de novo.',
  CONNECTION_FAILED: 'Não deu para concluir a conexão. Tente de novo.',
  ACCOUNT_ALREADY_LINKED: 'Essa conta já estava conectada em outro lugar e foi trazida para cá.',
}
export const mensagemDoErro = (codigo?: string | null) => (codigo && ERROS[codigo]) || 'Não deu para concluir a conexão. Tente de novo.'

export function conectarRede(perfilId: string, rede: Rede): Promise<Resultado> {
  // abre já no clique (senão o navegador bloqueia) e só depois põe o endereço da rede
  const w = 520
  const h = 720
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
  const janela = window.open('about:blank', 'clipost-conectar', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
  try {
    if (janela) {
      janela.document.title = 'Clipost'
      janela.document.body.style.cssText = 'margin:0;background:#07070a;color:#a1a1aa;font:13px system-ui;display:flex;align-items:center;justify-content:center;height:100vh'
      janela.document.body.textContent = 'Abrindo…'
    }
  } catch {}

  return new Promise(async resolve => {
    const r = await fetch('/api/perfis/conectar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: perfilId, rede }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!d.authorize_url) {
      janela?.close()
      return resolve({ status: 'error', erro: 'Não foi possível abrir a conexão agora. Tente de novo em instantes.' })
    }
    try { sessionStorage.setItem('clipost:voltar-conectado', window.location.pathname + window.location.search) } catch {}
    if (!janela || janela.closed) {
      window.location.href = d.authorize_url
      return
    }
    janela.location.href = d.authorize_url

    // resultado vem de /conectado (postMessage ou BroadcastChannel, caso a rede corte o vínculo
    // com a janela); fechar a janelinha sem terminar conta como cancelado
    let fim = false
    const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('clipost-conexao') : null
    const terminar = async (res: Resultado) => {
      if (fim) return
      fim = true
      clearInterval(vigia)
      window.removeEventListener('message', aoMensagem)
      canal?.close()
      if (res.status === 'success') await fetch('/api/social/sync', { method: 'POST' }).catch(() => null)
      resolve(res)
    }
    const aoAviso = (x: any) => {
      if (x?.tipo !== 'clipost:conectado') return
      terminar(x.status === 'success' ? { status: 'success' } : { status: x.status === 'cancelled' ? 'cancelled' : 'error', erro: mensagemDoErro(x.erro) })
    }
    const aoMensagem = (e: MessageEvent) => { if (e.origin === window.location.origin) aoAviso(e.data) }
    window.addEventListener('message', aoMensagem)
    if (canal) canal.onmessage = e => aoAviso(e.data)
    // alguns logins cortam o vínculo com a janela (ela parece "fechada" enquanto a pessoa ainda está
    // nela): só conta como fechada quando o site volta a ter o foco, e espera o aviso por mais 2 s
    let foco = 0
    const vigia = setInterval(() => {
      if (!janela.closed || !document.hasFocus()) { foco = 0; return }
      if (++foco >= 3) terminar({ status: 'cancelled' })
    }, 800)
    setTimeout(() => terminar({ status: 'cancelled' }), 20 * 60 * 1000)
  })
}
