// Referências de publicação usadas no Calendário & Publicações e na página Ferramentas.

export const NOME_REDE: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube_shorts: 'YouTube',
  youtube: 'YouTube',
  twitter: 'X',
}

// Limite de caracteres da legenda (YouTube: é o título do Short) e onde o Instagram corta com "...mais"
export const LIMITE_LEGENDA: Record<string, number> = { instagram: 2200, facebook: 2200, tiktok: 2200, youtube_shorts: 100 }
export const CORTE_MAIS_IG = 125

// Horários de pico gerais por rede (horário do público). São referências de mercado, não dados da conta.
export const MELHORES_HORARIOS: Record<string, string[]> = {
  instagram: ['11:00', '13:00', '19:00', '21:00'],
  tiktok: ['12:00', '15:00', '19:00', '22:00'],
  youtube_shorts: ['12:00', '17:00', '20:00'],
  facebook: ['09:00', '13:00', '18:00'],
}

// Dias da semana que costumam render mais por rede (0 = domingo)
export const MELHORES_DIAS: Record<string, number[]> = {
  instagram: [2, 3, 4],
  tiktok: [2, 4, 5],
  youtube_shorts: [4, 5, 6],
  facebook: [2, 3, 4],
}

export const FUSOS = [
  { id: 'America/Sao_Paulo', nome: 'Brasil (Brasília)' },
  { id: 'Europe/Lisbon', nome: 'Portugal' },
  { id: 'America/New_York', nome: 'EUA (Nova York)' },
  { id: 'local', nome: 'Meu fuso' },
]

// Limite diário de publicações pela API de cada rede (por conta)
export const LIMITE_DIARIO: Record<string, { n: number; fonte: string }> = {
  instagram: { n: 100, fonte: 'a Meta aceita até 100 posts por conta a cada 24h pela API' },
  tiktok: { n: 15, fonte: 'a API do TikTok aceita cerca de 15 vídeos por dia por conta' },
  youtube_shorts: { n: 6, fonte: 'a cota padrão da API do YouTube dá para cerca de 6 envios por dia' },
}

/** Diferença (min) entre o fuso do público e o do navegador */
export function diferencaFuso(fuso: string): number {
  if (fuso === 'local') return 0
  const agora = new Date()
  const noFuso = new Date(agora.toLocaleString('en-US', { timeZone: fuso }))
  const local = new Date(agora.toLocaleString('en-US'))
  return Math.round((noFuso.getTime() - local.getTime()) / 60000)
}

/** "18:00 no fuso do público" → hora no relógio de quem está usando */
export function horarioLocal(hhmm: string, fuso: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (((h * 60 + m - diferencaFuso(fuso)) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Instagram/TikTok/Facebook juntam linhas em branco: tira espaços do fim e usa U+2800 nas linhas vazias */
export function quebrasSeguras(texto: string) {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''))
  while (linhas.length && !linhas[linhas.length - 1]) linhas.pop()
  return linhas.map(l => (l ? l : '⠀')).join('\n')
}

/** Pede ao backend 3 legendas com hashtags (título e/ou corte da Biblioteca) */
export async function gerarLegendasIA(p: { clipId?: string; titulo?: string; plataforma: string; tom: string }) {
  const r = await fetch('/api/captions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clip_id: p.clipId, titulo: p.titulo, plataforma: p.plataforma, tom: p.tom }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.detail || 'Não foi possível gerar a legenda.')
  return (d.opcoes ?? []) as { legenda: string; hashtags: string[] }[]
}

export const juntarLegenda = (o: { legenda: string; hashtags: string[] }, plataforma: string) =>
  plataforma === 'youtube_shorts' ? o.legenda : `${o.legenda}\n\n${o.hashtags.join(' ')}`.trim()

/** Plataforma gravada em scheduled_posts (YouTube publica como Shorts) */
export const plataformaPost = (p: string) => (p === 'youtube' ? 'youtube_shorts' : p)

/** Horários da grade dia-da-semana × horário a partir da data de início (hora local), só no futuro */
export function calcularHorarios(dias: number[], horarios: string[], inicio: string, quantidade: number): Date[] {
  const [y, m, d] = inicio.split('-').map(Number)
  const hs = [...horarios].map(t => t.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const saida: Date[] = []
  for (let k = 0; saida.length < quantidade && k < 3650; k++) {
    const dia = new Date(y, m - 1, d + k)
    if (!dias.includes(dia.getDay())) continue
    for (const [h, mi] of hs) {
      const t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, mi)
      if (t.getTime() > Date.now() && saida.length < quantidade) saida.push(t)
    }
  }
  return saida
}