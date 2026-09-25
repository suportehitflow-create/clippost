// Clipost — roda nas páginas do Instagram (com a SUA sessão). Numa página de perfil, mostra o
// botão "Enviar para o Clipost": lista os Reels pela API web do Instagram (a mesma que o site usa),
// guarda a lista e abre o Clipost, que baixa os vídeos pelo link direto da CDN.

(() => {
  const APP_ID = '936619743392459' // id público do app web do Instagram (vai em todo request do site)
  const CLIPOST = 'https://clippost-three.vercel.app'
  const RESERVADAS = new Set(['', 'p', 'reel', 'reels', 'explore', 'stories', 'direct', 'accounts', 'about', 'developer', 'legal', 'tv'])
  const esperar = ms => new Promise(r => setTimeout(r, ms))

  function perfilDaUrl() {
    const [nome, extra] = location.pathname.split('/').filter(Boolean)
    if (!nome || RESERVADAS.has(nome.toLowerCase())) return null
    if (extra && !['reels', 'tagged'].includes(extra)) return null
    return nome
  }

  async function api(caminho) {
    const r = await fetch(caminho, { headers: { 'x-ig-app-id': APP_ID, 'x-requested-with': 'XMLHttpRequest' }, credentials: 'include' })
    if (r.status === 429) throw new Error('O Instagram pediu para ir mais devagar (429). Espere alguns minutos e tente de novo.')
    if (!r.ok) throw new Error(`Instagram respondeu ${r.status}. Confira se você está logado.`)
    return r.json()
  }

  function paraItem(m) {
    const v = (m.video_versions || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]
    if (!v?.url) return null
    return {
      url: v.url,
      permalink: `https://www.instagram.com/reel/${m.code}/`,
      title: (m.caption?.text || '').replace(/\s+/g, ' ').trim().slice(0, 200) || `Reel ${m.code}`,
      thumbnail: m.image_versions2?.candidates?.[0]?.url || null,
      view_count: m.play_count ?? m.ig_play_count ?? m.view_count ?? null,
      like_count: m.like_count ?? null,
      comment_count: m.comment_count ?? null,
      timestamp: m.taken_at ?? null,
      duration: m.video_duration ?? null,
    }
  }

  /** Lista os vídeos do perfil (do mais novo para o mais antigo), até `limite` (0 = todos) */
  async function listar(usuario, limite, aoProgresso) {
    const info = await api(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(usuario)}`)
    const id = info?.data?.user?.id
    if (!id) throw new Error('Perfil não encontrado (ou privado sem você seguir).')
    const itens = []
    let proximo = ''
    for (let pagina = 0; pagina < 80; pagina++) {
      const feed = await api(`/api/v1/feed/user/${id}/?count=33${proximo ? `&max_id=${encodeURIComponent(proximo)}` : ''}`)
      for (const m of feed.items || []) {
        // vídeo solto ou o primeiro vídeo de um carrossel
        const midia = m.media_type === 2 ? m : (m.carousel_media || []).find(c => c.media_type === 2)
        const item = midia && paraItem({ ...midia, code: m.code, caption: m.caption, like_count: m.like_count, comment_count: m.comment_count, taken_at: m.taken_at, play_count: m.play_count ?? midia.play_count })
        if (item) itens.push(item)
      }
      aoProgresso(itens.length)
      if (limite && itens.length >= limite) break
      if (!feed.more_available || !feed.next_max_id) break
      proximo = feed.next_max_id
      await esperar(900 + Math.random() * 600) // devagar, como uma pessoa rolando o perfil
    }
    return limite ? itens.slice(0, limite) : itens
  }

  // ---------------- interface ----------------
  let painel = null

  function montarPainel() {
    const usuario = perfilDaUrl()
    if (!usuario) {
      painel?.remove()
      painel = null
      return
    }
    if (painel && painel.dataset.usuario === usuario) return
    painel?.remove()
    painel = document.createElement('div')
    painel.className = 'clipost-painel'
    painel.dataset.usuario = usuario
    painel.innerHTML = `
      <div class="clipost-topo"><span class="clipost-logo">C</span><b>Clipost</b><span class="clipost-perfil">@${usuario}</span></div>
      <label class="clipost-rotulo">Quantos vídeos</label>
      <div class="clipost-opcoes" data-grupo="qtd">
        <button data-v="10">10</button><button data-v="30" class="on">30</button><button data-v="100">100</button><button data-v="0">Todos</button>
      </div>
      <label class="clipost-rotulo">Ordenar por</label>
      <div class="clipost-opcoes" data-grupo="ordem">
        <button data-v="views" class="on">Views</button><button data-v="likes">Curtidas</button><button data-v="date">Recentes</button>
      </div>
      <button class="clipost-enviar">Enviar para o Clipost</button>
      <p class="clipost-status"></p>`
    painel.querySelectorAll('.clipost-opcoes').forEach(g =>
      g.addEventListener('click', e => {
        const b = e.target.closest('button')
        if (!b) return
        g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b))
      }),
    )
    painel.querySelector('.clipost-enviar').addEventListener('click', () => enviar(usuario))
    document.body.appendChild(painel)
  }

  async function enviar(usuario) {
    const botao = painel.querySelector('.clipost-enviar')
    const status = painel.querySelector('.clipost-status')
    const qtd = Number(painel.querySelector('[data-grupo="qtd"] .on')?.dataset.v ?? 30)
    const ordem = painel.querySelector('[data-grupo="ordem"] .on')?.dataset.v ?? 'views'
    botao.disabled = true
    status.textContent = 'Lendo os Reels…'
    try {
      // para ordenar por views/curtidas lê mais que o pedido e escolhe os melhores
      const alvo = qtd && ordem !== 'date' ? Math.min(qtd * 3, 300) : qtd
      let itens = await listar(usuario, alvo, n => (status.textContent = `${n} vídeos encontrados…`))
      if (!itens.length) throw new Error('Nenhum vídeo encontrado nesse perfil.')
      const chave = ordem === 'likes' ? 'like_count' : ordem === 'date' ? 'timestamp' : 'view_count'
      itens.sort((a, b) => (b[chave] || 0) - (a[chave] || 0))
      if (qtd) itens = itens.slice(0, qtd)
      await chrome.storage.local.set({ clipostImport: { perfil: `https://www.instagram.com/${usuario}/`, usuario, itens, criadoEm: Date.now() } })
      status.textContent = `${itens.length} vídeos prontos. Abrindo o Clipost…`
      window.open(`${CLIPOST}/bulk?aba=perfil&importar=extensao`, '_blank')
    } catch (e) {
      status.textContent = e.message || String(e)
    } finally {
      botao.disabled = false
    }
  }

  // o Instagram troca de página sem recarregar: confere a URL de tempos em tempos
  let ultimo = ''
  setInterval(() => {
    if (location.pathname !== ultimo) {
      ultimo = location.pathname
      montarPainel()
    }
  }, 800)
})()
