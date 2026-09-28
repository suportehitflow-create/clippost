// Clipost — roda no mundo da página do Instagram, desde o começo do carregamento, mas SÓ nas
// páginas que a própria extensão abre (endereço com ?clipost=1). Anota os posts que o Instagram
// carrega para a grade do perfil (a mesma resposta que a página usa para desenhar) — nada é enviado
// a lugar nenhum daqui; a extensão lê a lista no fim e fecha a janela.

(() => {
  if (!/[?&]clipost=1\b/.test(location.search)) return
  const vistos = new Map()
  window.__clipostColeta = vistos
  const addNo = n => { if (n && n.code && !vistos.has(n.code)) vistos.set(n.code, n) }
  const varrer = (obj, prof = 0) => {
    if (!obj || typeof obj !== 'object' || prof > 60) return
    const con = obj.xdt_api__v1__feed__user_timeline_graphql_connection
    if (con && Array.isArray(con.edges)) con.edges.forEach(e => addNo(e && e.node))
    for (const k in obj) varrer(obj[k], prof + 1)
  }
  window.__clipostVarrer = varrer

  const fetchOriginal = window.fetch
  window.fetch = async function (...args) {
    const r = await fetchOriginal.apply(this, args)
    try {
      const u = String((args[0] && args[0].url) || args[0])
      if (u.includes('/graphql')) r.clone().json().then(j => varrer(j)).catch(() => {})
    } catch (e) {}
    return r
  }
  const abrirOriginal = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (m, u) {
    if (String(u).includes('/graphql')) {
      this.addEventListener('load', () => { try { varrer(JSON.parse(this.responseText)) } catch (e) {} })
    }
    return abrirOriginal.apply(this, arguments)
  }
})()
