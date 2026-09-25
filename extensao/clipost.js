// Clipost — roda no site do Clipost. Avisa a página que a extensão está instalada e entrega a
// lista de vídeos que foi montada no Instagram (a página confirma o recebimento e a lista é apagada).

(() => {
  const ORIGEM = location.origin

  window.addEventListener('message', async e => {
    if (e.source !== window || e.origin !== ORIGEM) return
    const tipo = e.data?.tipo
    if (tipo === 'CLIPOST_EXTENSAO_PING') {
      window.postMessage({ tipo: 'CLIPOST_EXTENSAO_PONG', versao: chrome.runtime.getManifest().version }, ORIGEM)
    } else if (tipo === 'CLIPOST_EXTENSAO_PEGAR') {
      const { clipostImport } = await chrome.storage.local.get('clipostImport')
      // lista com mais de 3h: os links da CDN do Instagram já podem ter expirado
      const valida = clipostImport && Date.now() - (clipostImport.criadoEm || 0) < 3 * 3600 * 1000
      window.postMessage({ tipo: 'CLIPOST_EXTENSAO_LISTA', dados: valida ? clipostImport : null }, ORIGEM)
    } else if (tipo === 'CLIPOST_EXTENSAO_RECEBIDO') {
      await chrome.storage.local.remove('clipostImport')
    }
  })
})()
