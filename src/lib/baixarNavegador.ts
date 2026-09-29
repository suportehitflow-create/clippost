'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { baixarYouTubePelaExtensao } from '@/components/bulk/ExtensaoInstagram'
import { idYouTube } from '@/lib/lote'

// Plano "IP de quem usa": o YouTube bloqueia o servidor (IP de datacenter), mas libera o navegador da
// pessoa. A extensão baixa o vídeo e o áudio daqui, sobe no armazenamento e devolve os links para o
// servidor cortar a partir deles.

/** Baixa pelo navegador e devolve os links para o /api/jobs (url = vídeo, audio_url = áudio separado) */
export async function baixarPeloNavegador(supabase: SupabaseClient, userId: string, projetoId: string, sourceUrl: string) {
  const vid = idYouTube(sourceUrl)
  if (!vid) throw new Error('não é um vídeo do YouTube')
  // o armazenamento aceita até 50 MB por arquivo: o vídeo sobe em partes de 45 MB (até 20 = 900 MB; se
  // não couber, a extensão escolhe uma qualidade menor) e o servidor junta na ordem ("parte1|parte2|...")
  const nomes = [
    ...Array.from({ length: 20 }, (_, i) => `navegador/video_${String(i).padStart(2, '0')}.part`),
    ...Array.from({ length: 4 }, (_, i) => `navegador/audio_${i}.part`),
  ]
  const r0 = await fetch('/api/storage/signed-upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'videos', paths: nomes.map(n => `${userId}/${projetoId}/${n}`), upsert: true }),
  })
  const d = await r0.json()
  if (!r0.ok || !Array.isArray(d.urls)) throw new Error(d.error || 'sem link de upload')
  const lista = (d.urls as { signedUrl: string; path: string }[]).map(u => ({
    enviar: u.signedUrl, publico: supabase.storage.from('videos').getPublicUrl(u.path).data.publicUrl,
  }))
  const video = lista.slice(0, 20)
  const audio = lista.slice(20)
  const r = await baixarYouTubePelaExtensao(vid, { video: video.map(x => x.enviar), audio: audio.map(x => x.enviar) })
  const juntar = (xs: typeof lista, n: number) => xs.slice(0, Math.max(1, n)).map(x => x.publico).join('|')
  return {
    url: juntar(video, r.partesVideo ?? 1),
    audio_url: r.audioSeparado ? juntar(audio, r.partesAudio ?? 1) : undefined,
  }
}

/** Manda o servidor cortar (com o link original ou com o arquivo que o navegador baixou) */
export async function mandarCortar(projetoId: string, userId: string, fonte: { url: string; audio_url?: string }) {
  await fetch(`/api/projects/${projetoId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'processing', error_message: null }),
  }).catch(() => null)
  const r = await fetch('/api/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fonte.url, audio_url: fonte.audio_url, project_id: projetoId, user_id: userId }),
  }).catch(() => null)
  if (!r || !r.ok) throw new Error('o servidor de cortes não respondeu')
}
