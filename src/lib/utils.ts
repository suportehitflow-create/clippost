import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Baixa um arquivo de vÃ­deo de forma 100% funcional no navegador,
 * contornando restriÃ§Ãµes de cross-origin (CORS) atravÃ©s de blob URL.
 */
export async function downloadVideoFile(url: string, filename: string): Promise<boolean> {
  const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = safeFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000)
    return true
  } catch (err) {
    console.warn('[download] fetch blob falhou, abrindo via link direto:', err)
    const a = document.createElement('a')
    a.href = url
    a.download = safeFilename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return false
  }
}