import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'

// Biblioteca de músicas na nuvem (Supabase Storage): usada pela página Músicas, pelo Editor em Massa
// e pelos Vídeos com frases.

export interface MusicaNuvem {
  path: string
  nome: string
  url: string
  tamanho: number | null
  criada: string | null
}

export const TIPOS_AUDIO = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg'

export async function listarMusicas(): Promise<MusicaNuvem[]> {
  const r = await fetch('/api/musicas', { cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Não consegui carregar as músicas.')
  return d.musicas || []
}

function nomeSeguro(nome: string) {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return base.replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_').slice(-80) || 'musica.mp3'
}

export async function enviarMusicaNuvem(arquivo: File): Promise<MusicaNuvem> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Faça login para salvar músicas.')
  const path = `${user.id}/musicas/${Date.now()}-${nomeSeguro(arquivo.name)}`
  const r = await uploadFileViaSignedUrl(supabase, 'videos', path, arquivo, { contentType: arquivo.type || 'audio/mpeg', upsert: true })
  return { path: r.path, nome: arquivo.name.replace(/\.[^.]+$/, ''), url: r.publicUrl, tamanho: arquivo.size, criada: new Date().toISOString() }
}

export async function apagarMusicaNuvem(path: string) {
  const r = await fetch(`/api/musicas?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Não consegui apagar.')
}

/** Baixa a música da nuvem como File (para o editor, que trabalha com arquivos locais). */
export async function baixarMusicaNuvem(m: MusicaNuvem): Promise<File> {
  const r = await fetch(m.url)
  if (!r.ok) throw new Error(`Não consegui baixar "${m.nome}".`)
  const blob = await r.blob()
  const ext = m.path.split('.').pop() || 'mp3'
  return new File([blob], `${m.nome}.${ext}`, { type: blob.type || 'audio/mpeg' })
}
