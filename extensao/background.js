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

// Roda DENTRO da página de vídeos/reels do Facebook (com o login do navegador): rola e junta os links
async function coletarFacebook(limite) {
  const esperar = ms => new Promise(r => setTimeout(r, ms))
  const vistos = new Map()
  // o quadro do reel mostra só as views ("101 mil", "1,2 mi", "3.4K"); o texto do link não é título
  const numero = s => {
    const m = String(s || '').replace(/\s+/g, ' ').match(/([\d.,]+)\s*(mil|mi|bi|k|m|b)?\b/i)
    if (!m) return null
    const mult = { mil: 1e3, k: 1e3, mi: 1e6, m: 1e6, bi: 1e9, b: 1e9 }[(m[2] || '').toLowerCase()] || 1
    const n = mult > 1 ? parseFloat(m[1].replace(',', '.')) : parseFloat(m[1].replace(/[.,]/g, ''))
    return isNaN(n) ? null : Math.round(n * mult)
  }
  const juntar = () => {
    document.querySelectorAll('a[href*="/reel/"], a[href*="/videos/"], a[href*="/watch/?v="]').forEach(a => {
      const href = a.href.split('&')[0]
      const id = (href.match(/\/reel\/(\d+)|\/videos\/(?:[^/]+\/)?(\d+)|[?&]v=(\d+)/) || []).slice(1).find(Boolean)
      if (!id || vistos.has(id)) return
      const img = a.querySelector('img')
      const texto = (a.innerText || '').replace(/\s+/g, ' ').trim()
      const soViews = /^[\d.,]+\s*(mil|mi|bi|k|m|b)?$/i.test(texto)
      const aria = a.getAttribute('aria-label') || ''
      vistos.set(id, {
        tipo: 'reel', url: href, video: true,
        permalink: href.includes('/reel/') ? `https://www.facebook.com/reel/${id}` : href,
        title: soViews ? '' : (/^pr[eé]via|^preview/i.test(aria) ? texto : aria || texto).slice(0, 200),
        thumbnail: img ? img.src : null, view_count: soViews ? numero(texto) : null, like_count: null, comment_count: null, timestamp: null, duration: null,
      })
    })
  }
  for (let i = 0; i < 40 && !document.querySelector('a[href*="/reel/"], a[href*="/videos/"]'); i++) await esperar(250)
  let parado = 0, ultimo = 0
  juntar()
  while ((!limite || vistos.size < limite) && parado < 5) {
    window.scrollTo(0, document.documentElement.scrollHeight)
    await esperar(1500)
    juntar()
    if (vistos.size === ultimo) parado++
    else { parado = 0; ultimo = vistos.size }
  }
  const itens = [...vistos.values()]
  return {
    // título da aba: "(20+) Toguro Reels | Facebook" → "Toguro"
    perfil: { usuario: location.pathname.split('/').filter(Boolean)[0], nome: document.title.split('|')[0].replace(/^\(\d+\+?\)\s*/, '').replace(/\s+(Reels|V[ií]deos|Videos)\s*$/i, '').trim() || null, foto: null, seguidores: null, total_posts: null },
    itens: limite ? itens.slice(0, limite) : itens,
    logado: document.cookie.includes('c_user'),
  }
}

async function pelaJanelaFacebook(pagina, limite) {
  const base = /^https?:/.test(pagina) ? pagina.replace(/[?#].*$/, '').replace(/\/$/, '') : `https://www.facebook.com/${pagina}`
  const alvo = /\/(reels|videos)$/.test(base) ? base : `${base}/reels`
  const janela = await abrirJanela(alvo, true)
  const abaId = janela.tabs && janela.tabs[0] && janela.tabs[0].id
  try {
    await new Promise(res => {
      const pronto = (id, info) => { if (id === abaId && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(pronto); res() } }
      chrome.tabs.onUpdated.addListener(pronto)
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(pronto); res() }, 25000)
    })
    const [r] = await chrome.scripting.executeScript({ target: { tabId: abaId }, world: 'MAIN', func: coletarFacebook, args: [limite] })
    const dados = r && r.result
    if (!dados || !dados.itens.length) {
      throw new Error(dados && !dados.logado ? 'Entre no Facebook neste navegador e tente de novo.' : 'O Facebook não mostrou vídeos dessa página.')
    }
    return dados
  } finally {
    fecharJanela(janela)
  }
}

async function abrirJanela(url, precisaRolar) {
  // até 12 posts: o Instagram já manda na carga da página, então a janela fica minimizada (invisível)
  if (!precisaRolar) return chrome.windows.create({ url, state: 'minimized', focused: false })
  // mais que isso: precisa rolar, e página escondida não carrega mais posts (o Windows marca como
  // escondida a janela que fica atrás de outra). Por isso a janelinha abre na frente, pequena no canto
  // de baixo; quando termina, fecha e o foco volta para a janela do site (fecharJanela)
  const base = await chrome.windows.getLastFocused().catch(() => null)
  const lado = 240
  const left = base ? base.left + base.width - lado : 0
  const top = base ? base.top + base.height - lado : 0
  let janela
  try {
    janela = await chrome.windows.create({ url, type: 'popup', focused: true, width: lado, height: lado, left, top })
  } catch (e) {
    janela = await chrome.windows.create({ url, type: 'popup', focused: true, width: lado, height: lado })
  }
  janela.volta = base && base.id
  return janela
}

function fecharJanela(janela) {
  chrome.windows.remove(janela.id).catch(() => {})
  if (janela.volta) chrome.windows.update(janela.volta, { focused: true }).catch(() => {})
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
    fecharJanela(janela)
  }
}

// ---------------- YouTube pelo IP de quem usa (plano quando o servidor é bloqueado) ----------------
// Pede os links do vídeo ao próprio YouTube como um app de celular/óculos VR (links diretos, sem
// assinatura), baixa vídeo e áudio daqui do navegador e sobe cada um no link de upload que o site deu.
// O YouTube recusa (403) pedidos com a "origem" da extensão: esta regra tira a origem só dos pedidos
// que a própria extensão faz ao YouTube (as abas do usuário não são afetadas)
chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [1],
  addRules: [{
    id: 1,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] },
    condition: { requestDomains: ['youtube.com', 'googlevideo.com'], tabIds: [chrome.tabs.TAB_ID_NONE] },
  }],
}).catch(() => {})

// ordem = o que o YouTube aceitou em teste. O Vision Pro (visionos) baixa o vídeo INTEIRO sem login e sem
// token de prova, desde que leve o "visitante" da página do vídeo; iPhone/Android abrem mas o download
// é recusado logo no começo (pedem o token de prova), ficam só como última tentativa
const CLIENTES_YT = [
  { nome: 'VISIONOS', num: 101, versao: '1.02', extra: { deviceMake: 'Apple', deviceModel: 'RealityDevice17,1', osName: 'visionOS', osVersion: '26.5.23O471' } },
  { nome: 'IOS', num: 5, versao: '20.10.4', extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' } },
  { nome: 'ANDROID_VR', num: 28, versao: '1.60.19', extra: { androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L' } },
  { nome: 'ANDROID', num: 3, versao: '20.10.38', extra: { androidSdkVersion: 34, osName: 'Android', osVersion: '14' } },
]

// "visitante" da página do vídeo: sem ele o YouTube pede login ("confirme que não é um robô")
async function visitanteYouTube(videoId) {
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`)).text()
    return (html.match(/"VISITOR_DATA":"([^"]+)"/) || [])[1] || ''
  } catch (e) {
    return ''
  }
}

async function playerYouTube(videoId, pular = []) {
  let motivo = 'o YouTube não liberou este vídeo'
  const visitorData = await visitanteYouTube(videoId)
  for (const c of CLIENTES_YT.filter(x => !pular.includes(x.nome))) {
    try {
      const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'X-YouTube-Client-Name': String(c.num), 'X-YouTube-Client-Version': c.versao,
          ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
        },
        body: JSON.stringify({
          videoId, contentCheckOk: true, racyCheckOk: true,
          context: { client: { clientName: c.nome, clientVersion: c.versao, hl: 'pt', gl: 'BR', ...(visitorData ? { visitorData } : {}), ...c.extra } },
        }),
      })
      const j = await r.json()
      const ok = j?.playabilityStatus?.status === 'OK'
      const temLinks = (j?.streamingData?.adaptiveFormats || []).some(f => f.url) || (j?.streamingData?.formats || []).some(f => f.url)
      if (ok && temLinks) return { ...j, _cliente: c.nome }
      motivo = j?.playabilityStatus?.reason || motivo
    } catch (e) {}
  }
  throw new Error(motivo)
}

// baixa em pedaços de 8 MB (o YouTube corta downloads grandes de uma vez só)
async function baixarStream(url, tamanho) {
  const partes = []
  const PASSO = 8 * 1024 * 1024
  if (!tamanho) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`download ${r.status}`)
    return await r.blob()
  }
  for (let ini = 0; ini < tamanho; ini += PASSO) {
    const fim = Math.min(tamanho, ini + PASSO) - 1
    let r
    for (let t = 0; t < 3; t++) {
      r = await fetch(`${url}&range=${ini}-${fim}`).catch(() => null)
      if (r && r.ok) break
      await new Promise(res => setTimeout(res, 1500 * (t + 1)))
    }
    if (!r || !r.ok) throw new Error(`download ${r ? r.status : 'rede'}`)
    partes.push(await r.blob())
  }
  return new Blob(partes)
}

async function subir(destino, blob, tipo) {
  const r = await fetch(destino, { method: 'PUT', headers: { 'Content-Type': tipo, 'x-upsert': 'true' }, body: blob })
  if (!r.ok) throw new Error(`upload ${r.status}`)
}

// tenta cliente por cliente: se um libera o vídeo mas recusa o download no meio, vai para o próximo
async function baixarYouTube(videoId, destinos) {
  const pular = []
  let ultimoErro = null
  for (let t = 0; t < CLIENTES_YT.length; t++) {
    let j
    try {
      j = await playerYouTube(videoId, pular)
    } catch (e) {
      throw ultimoErro || e
    }
    try {
      return await baixarComPlayer(j, destinos)
    } catch (e) {
      ultimoErro = e
      pular.push(j._cliente)
    }
  }
  throw ultimoErro || new Error('o YouTube não liberou este vídeo')
}

async function baixarComPlayer(j, destinos) {
  const sd = j.streamingData || {}
  const adapt = (sd.adaptiveFormats || []).filter(f => f.url)
  // vídeo MP4 (H.264) até 720p (arquivo menor para subir; o corte sai em 1080x1920 do mesmo jeito) e o melhor áudio M4A
  const videos = adapt.filter(f => /^video\/mp4/.test(f.mimeType || '') && (f.height || 0) <= 720)
    .sort((a, b) => (/avc1/.test(b.mimeType) - /avc1/.test(a.mimeType)) || (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0))
  const audios = adapt.filter(f => /^audio\/mp4/.test(f.mimeType || '')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
  const info = { titulo: j.videoDetails?.title || '', duracao: Number(j.videoDetails?.lengthSeconds) || null }
  if (videos[0] && audios[0]) {
    const [v, a] = await Promise.all([
      baixarStream(videos[0].url, Number(videos[0].contentLength) || 0),
      baixarStream(audios[0].url, Number(audios[0].contentLength) || 0),
    ])
    await subir(destinos.video, v, 'video/mp4')
    await subir(destinos.audio, a, 'audio/mp4')
    return { ...info, audioSeparado: true, altura: videos[0].height }
  }
  // sem formatos separados: o arquivo único (vídeo + áudio juntos, qualidade menor)
  const unico = (sd.formats || []).filter(f => f.url && /^video\/mp4/.test(f.mimeType || '')).sort((a, b) => (b.height || 0) - (a.height || 0))[0]
  if (!unico) throw new Error('nenhum formato de vídeo disponível')
  await subir(destinos.video, await baixarStream(unico.url, Number(unico.contentLength) || 0), 'video/mp4')
  return { ...info, audioSeparado: false, altura: unico.height }
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  // extensão carregada da pasta: o Clipost pede para ela se recarregar quando houver versão nova
  if (msg?.tipo === 'RECARREGAR') {
    responder({ ok: true })
    setTimeout(() => chrome.runtime.reload(), 200)
    return
  }
  if (msg?.tipo === 'BAIXAR_YOUTUBE') {
    ;(async () => {
      try {
        responder({ ok: true, ...(await baixarYouTube(String(msg.videoId || ''), msg.destinos || {})) })
      } catch (e) {
        responder({ ok: false, erro: e?.message || String(e) })
      }
    })()
    return true
  }
  if (msg?.tipo !== 'BUSCAR_INSTAGRAM' && msg?.tipo !== 'BUSCAR_FACEBOOK') return
  const usuario = String(msg.usuario || '').replace(/^@/, '').trim()
  const limite = Math.max(0, Math.min(Number(msg.limite) || 0, 3000))
  ;(async () => {
    try {
      responder({ ok: true, dados: msg.tipo === 'BUSCAR_FACEBOOK' ? await pelaJanelaFacebook(usuario, limite) : await pelaJanela(usuario, limite) })
    } catch (e) {
      responder({ ok: false, erro: e?.message || String(e) })
    }
  })()
  return true // resposta assíncrona
})
