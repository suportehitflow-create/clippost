// Clipost — serviço em segundo plano. O site do Clipost pede "busque o @fulano" e a extensão abre o
// perfil numa janelinha sem foco (com a SUA sessão do Instagram), rola a grade sozinha e junta os
// posts que o próprio Instagram carrega (instagram-captura.js anota). No fim fecha a janela.

// Roda DENTRO da página do perfil (mundo da página): rola e devolve os posts anotados
async function coletarPerfil(limite) {
  const esperar = ms => new Promise(r => setTimeout(r, ms))
  // espera o anotador (instagram-captura.js) e a primeira leva de posts
  for (let i = 0; i < 40 && !(window.__clipostColeta && window.__clipostColeta.size); i++) await esperar(250)
  const vistos = window.__clipostColeta || new Map()
  // posts que já vieram embutidos no HTML (quando o Instagram manda assim)
  document.querySelectorAll('script[type="application/json"]').forEach(s => {
    if (s.textContent.includes('xdt_api__v1__feed__user_timeline_graphql_connection') && window.__clipostVarrer) {
      try { window.__clipostVarrer(JSON.parse(s.textContent)) } catch (e) {}
    }
  })
  let parado = 0, ultimo = vistos.size
  while ((!limite || vistos.size < limite) && parado < 6) {
    window.scrollTo(0, document.documentElement.scrollHeight)
    await esperar(1400)
    window.scrollBy(0, -200)
    await esperar(300)
    if (vistos.size === ultimo) parado++
    else { parado = 0; ultimo = vistos.size }
  }
  const melhorImagem = m => (m && m.image_versions2 && m.image_versions2.candidates && m.image_versions2.candidates[0] && m.image_versions2.candidates[0].url) || null
  const itens = [...vistos.values()].map(m => {
    const carrossel = m.media_type === 8
    const video = m.media_type === 2 ? m : carrossel ? (m.carousel_media || []).find(c => c.media_type === 2) : null
    const v = video && (video.video_versions || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]
    const primeira = carrossel ? (m.carousel_media || [])[0] : null
    return {
      tipo: m.media_type === 2 ? 'reel' : carrossel ? 'carrossel' : 'post',
      url: (v && v.url) || melhorImagem(primeira || m),
      video: !!(v && v.url),
      permalink: `https://www.instagram.com/${m.media_type === 2 ? 'reel' : 'p'}/${m.code}/`,
      title: ((m.caption && m.caption.text) || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      thumbnail: melhorImagem(m) || melhorImagem(primeira),
      view_count: m.play_count ?? m.ig_play_count ?? m.view_count ?? null,
      like_count: m.like_count ?? null,
      comment_count: m.comment_count ?? null,
      timestamp: m.taken_at ?? null,
      duration: (video && video.video_duration) ?? null,
    }
  })
  // dados do perfil pela descrição da página ("104M seguidores, 93 seguindo, 4,935 posts")
  const desc = (document.querySelector('meta[name="description"]') || {}).content || ''
  const num = t => {
    if (!t) return null
    const x = t.trim().toLowerCase()
    const n = parseFloat(x.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
    if (isNaN(n)) return null
    return /mi|m$/.test(x) ? Math.round(n * 1e6) : /mil|k$/.test(x) ? Math.round(n * 1e3) : Math.round(n)
  }
  const seg = (desc.match(/([\d.,]+\s*(?:mi|mil|k|m)?)\s*(?:seguidores|followers)/i) || [])[1]
  const posts = (desc.match(/([\d.,]+\s*(?:mi|mil|k|m)?)\s*(?:posts|publicações)/i) || [])[1]
  return {
    perfil: {
      usuario: location.pathname.split('/').filter(Boolean)[0],
      nome: null,
      foto: (document.querySelector('meta[property="og:image"]') || {}).content || null,
      seguidores: num(seg),
      total_posts: num(posts),
    },
    itens: limite ? itens.slice(0, limite) : itens,
    logado: document.cookie.includes('ds_user_id'),
  }
}

async function abrirJanela(url, precisaRolar) {
  // até 12 posts: o Instagram já manda na carga da página, então a janela fica minimizada (invisível)
  if (!precisaRolar) return chrome.windows.create({ url, state: 'minimized', focused: false })
  // mais que isso: precisa rolar, e janela escondida não carrega mais posts. O Chrome exige a janela
  // pelo menos 50% dentro da tela: janelinha mínima no canto inferior direito, metade para fora
  const base = await chrome.windows.getLastFocused().catch(() => null)
  const lado = 200
  const left = base ? base.left + base.width - lado / 2 : 0
  const top = base ? base.top + base.height - lado / 2 : 0
  try {
    return await chrome.windows.create({ url, type: 'popup', focused: false, width: lado, height: lado, left, top })
  } catch (e) {
    // posição recusada (monitor diferente etc.): canto da janela atual, inteira
    return chrome.windows.create({ url, type: 'popup', focused: false, width: lado, height: lado, left: base ? base.left + base.width - lado : 0, top: base ? base.top + base.height - lado : 0 })
  }
}

async function pelaJanela(usuario, limite) {
  const janela = await abrirJanela(`https://www.instagram.com/${encodeURIComponent(usuario)}/?clipost=1`, !limite || limite > 12)
  const abaId = janela.tabs && janela.tabs[0] && janela.tabs[0].id
  try {
    await new Promise(res => {
      const pronto = (id, info) => { if (id === abaId && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(pronto); res() } }
      chrome.tabs.onUpdated.addListener(pronto)
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(pronto); res() }, 25000)
    })
    const [r] = await chrome.scripting.executeScript({ target: { tabId: abaId }, world: 'MAIN', func: coletarPerfil, args: [limite] })
    const dados = r && r.result
    if (!dados) throw new Error('Não consegui ler o perfil.')
    if (!dados.itens.length) {
      throw new Error(dados.logado
        ? 'O Instagram não mostrou posts desse perfil (privado, inexistente ou sem posts).'
        : 'Entre no Instagram neste navegador e tente de novo.')
    }
    return dados
  } finally {
    chrome.windows.remove(janela.id).catch(() => {})
  }
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  // extensão carregada da pasta: o Clipost pede para ela se recarregar quando houver versão nova
  if (msg?.tipo === 'RECARREGAR') {
    responder({ ok: true })
    setTimeout(() => chrome.runtime.reload(), 200)
    return
  }
  if (msg?.tipo !== 'BUSCAR_INSTAGRAM') return
  const usuario = String(msg.usuario || '').replace(/^@/, '').trim()
  const limite = Math.max(0, Math.min(Number(msg.limite) || 0, 3000))
  ;(async () => {
    try {
      responder({ ok: true, dados: await pelaJanela(usuario, limite) })
    } catch (e) {
      responder({ ok: false, erro: e?.message || String(e) })
    }
  })()
  return true // resposta assíncrona
})
