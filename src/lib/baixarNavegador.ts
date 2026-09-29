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
  const destino = async (nome: string) => {
    const r = await fetch('/api/storage/signed-upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'videos', path: `${userId}/${projetoId}/${nome}`, upsert: true }),
    })
    const d = await r.json()
    if (!r.ok || !d.signedUrl) throw new Error(d.error || 'sem link de upload')
    return { enviar: d.signedUrl as string, publico: supabase.storage.from('videos').getPublicUrl(d.path).data.publicUrl }
  }
  const [v, a] = await Promise.all([destino('youtube_video.mp4'), destino('youtube_audio.m4a')])
  const r = await baixarYouTubePelaExtensao(vid, { video: v.enviar, audio: a.enviar })
  return { url: v.publico, audio_url: r.audioSeparado ? a.publico : undefined }
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
