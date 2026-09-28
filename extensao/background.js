// Clipost — serviço em segundo plano. O site do Clipost pede "busque o @fulano" e a extensão lista
// os posts pela API web do Instagram com a SUA sessão do navegador — sem abrir o Instagram e sem
// clique. Se o Instagram não aceitar o pedido vindo daqui, abre uma aba escondida do Instagram,
// busca por lá (mesma origem) e fecha a aba sozinha.

const APP_ID = '936619743392459' // id público do app web do Instagram

// Roda dentro da página do Instagram (aba escondida) OU aqui no serviço: precisa ser autossuficiente
async function buscarPerfil(usuario, limite) {
  const esperar = ms => new Promise(r => setTimeout(r, ms))
  const base = 'https://www.instagram.com'
  const api = async caminho => {
    const r = await fetch(base + caminho, {
      headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest' },
      credentials: 'include',
    })
    if (r.status === 429) throw new Error('O Instagram pediu para ir mais devagar (429). Espere alguns minutos.')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  }
  const melhorVideo = m => (m.video_versions || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]
  const melhorImagem = m => m.image_versions2?.candidates?.[0]?.url || null

  const info = await api(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(usuario)}`)
  const u = info?.data?.user
  if (!u?.id) throw new Error('Perfil não encontrado (ou privado sem você seguir).')
  const itens = []
  let proximo = ''
  for (let pagina = 0; pagina < 120; pagina++) {
    const feed = await api(`/api/v1/feed/user/${u.id}/?count=33${proximo ? `&max_id=${encodeURIComponent(proximo)}` : ''}`)
    for (const m of feed.items || []) {
      const carrossel = m.media_type === 8
      const video = m.media_type === 2 ? m : carrossel ? (m.carousel_media || []).find(c => c.media_type === 2) : null
      const v = video && melhorVideo(video)
      const capa = melhorImagem(m) || (carrossel ? melhorImagem((m.carousel_media || [])[0] || {}) : null)
      itens.push({
        tipo: m.media_type === 2 ? 'reel' : carrossel ? 'carrossel' : 'post',
        url: v?.url || (carrossel ? melhorImagem((m.carousel_media || [])[0] || {}) : melhorImagem(m)),
        video: !!v?.url,
        permalink: `https://www.instagram.com/${m.media_type === 2 ? 'reel' : 'p'}/${m.code}/`,
        title: (m.caption?.text || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        thumbnail: capa,
        view_count: m.play_count ?? m.ig_play_count ?? m.view_count ?? null,
        like_count: m.like_count ?? null,
        comment_count: m.comment_count ?? null,
        timestamp: m.taken_at ?? null,
        duration: video?.video_duration ?? null,
      })
    }
    if (limite && itens.length >= limite) break
    if (!feed.more_available || !feed.next_max_id) break
    proximo = feed.next_max_id
    await esperar(700 + Math.random() * 600) // devagar, como uma pessoa rolando o perfil
  }
  return {
    perfil: { usuario: u.username, nome: u.full_name || null, foto: u.profile_pic_url_hd || u.profile_pic_url || null, seguidores: u.edge_followed_by?.count ?? null, total_posts: u.edge_owner_to_timeline_media?.count ?? null },
    itens: limite ? itens.slice(0, limite) : itens,
  }
}

async function pelaAbaEscondida(usuario, limite) {
  const aba = await chrome.tabs.create({ url: `https://www.instagram.com/${encodeURIComponent(usuario)}/`, active: false })
  try {
    // espera a página carregar (a sessão/cookies passam a valer como no site)
    await new Promise(res => {
      const pronto = (id, info) => { if (id === aba.id && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(pronto); res() } }
      chrome.tabs.onUpdated.addListener(pronto)
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(pronto); res() }, 20000)
    })
    const [r] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, world: 'MAIN', func: buscarPerfil, args: [usuario, limite] })
    if (!r?.result) throw new Error('Não consegui ler o perfil. Confira se você está logado no Instagram neste navegador.')
    return r.result
  } finally {
    chrome.tabs.remove(aba.id).catch(() => {})
  }
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo !== 'BUSCAR_INSTAGRAM') return
  const usuario = String(msg.usuario || '').replace(/^@/, '').trim()
  const limite = Math.max(0, Math.min(Number(msg.limite) || 0, 3000))
  ;(async () => {
    try {
      let dados
      try {
        dados = await buscarPerfil(usuario, limite)
      } catch (e) {
        if (String(e.message).includes('429')) throw e
        dados = await pelaAbaEscondida(usuario, limite)
      }
      responder({ ok: true, dados })
    } catch (e) {
      responder({ ok: false, erro: e?.message || String(e) })
    }
  })()
  return true // resposta assíncrona
})
