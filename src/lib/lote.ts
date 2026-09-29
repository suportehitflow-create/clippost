// Lote: vários vídeos (canal ou perfil) cortados juntos. Na Biblioteca vira UM item e abre no editor em
// massa com os cortes de todos os vídeos. Fica guardado como um projeto especial cujo source_url é
// "clipost:lote:<id1>,<id2>,..." (os ids dos projetos de cada vídeo), no mesmo padrão de "clipost:perfil".

export const PREFIXO_LOTE = 'clipost:lote:'

export function idsDoLote(sourceUrl?: string | null): string[] | null {
  const s = String(sourceUrl || '')
  if (!s.startsWith(PREFIXO_LOTE)) return null
  return s.slice(PREFIXO_LOTE.length).split(',').map(x => x.trim()).filter(Boolean)
}

/** id do vídeo do YouTube (para saber se ele já foi cortado antes) */
export function idYouTube(url?: string | null): string | null {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

/** chave estável de um vídeo: id do YouTube ou o link sem parâmetros */
export const chaveVideo = (url?: string | null) => idYouTube(url) || String(url || '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
