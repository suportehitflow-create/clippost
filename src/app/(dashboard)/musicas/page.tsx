'use client'

import { useEffect, useRef, useState } from 'react'
import ProfileSwitcher from '@/components/ProfileSwitcher'
import { apagarMusicaNuvem, enviarMusicaNuvem, listarMusicas, TIPOS_AUDIO, type MusicaNuvem } from '@/lib/musicas'
import { Music2, Upload, Loader2, Play, Pause, Trash2, AlertCircle } from 'lucide-react'

// Biblioteca de músicas da conta: as faixas ficam salvas e aparecem no Editor em Massa
// ("Minhas músicas") e nos Vídeos com frases.

const tamanho = (b: number | null) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

export default function MusicasPage() {
  const [lista, setLista] = useState<MusicaNuvem[] | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(0)
  const [tocando, setTocando] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarMusicas().then(setLista).catch(e => { setErro(e.message); setLista([]) })
    return () => audio.current?.pause()
  }, [])

  function ouvir(m: MusicaNuvem) {
    if (tocando === m.path) { audio.current?.pause(); setTocando(null); return }
    audio.current?.pause()
    audio.current = new Audio(m.url)
    audio.current.onended = () => setTocando(null)
    audio.current.play().catch(() => setTocando(null))
    setTocando(m.path)
  }

  async function enviar(arquivos: File[]) {
    const audios = arquivos.filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(f.name))
    if (!audios.length) return setErro('Envie arquivos de áudio (MP3, M4A, WAV, AAC ou OGG).')
    setErro('')
    setEnviando(audios.length)
    for (const f of audios) {
      try {
        const m = await enviarMusicaNuvem(f)
        setLista(l => [m, ...(l || [])])
      } catch (e: any) {
        setErro(`${f.name}: ${e.message}`)
      }
      setEnviando(n => n - 1)
    }
  }

  async function apagar(m: MusicaNuvem) {
    if (!confirm(`Apagar "${m.nome}" da sua biblioteca?`)) return
    try {
      await apagarMusicaNuvem(m.path)
      if (tocando === m.path) { audio.current?.pause(); setTocando(null) }
      setLista(l => (l || []).filter(x => x.path !== m.path))
    } catch (e: any) {
      setErro(e.message)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0c] text-white">
      <header className="h-16 border-b border-white/[0.08] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 bg-[#0c0c0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2"><Music2 className="w-4 h-4 text-pink-300" /><h1 className="text-sm font-semibold tracking-wide">Músicas</h1></div>
        <div className="flex justify-center"><ProfileSwitcher align="center" /></div>
        <span />
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Suas músicas, sempre à mão</h2>
          <p className="text-sm text-zinc-400">Envie uma vez e use em qualquer vídeo: aparecem no Editor em Massa (“Minhas músicas”) e nos Vídeos com frases, em qualquer computador.</p>
        </div>

        <button type="button" onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); enviar(Array.from(e.dataTransfer.files)) }}
          className={`w-full rounded-3xl border-2 border-dashed p-8 flex flex-col items-center gap-2 transition-colors ${arrastando ? 'border-pink-400 bg-pink-500/10' : 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
          {enviando ? <Loader2 className="w-6 h-6 animate-spin text-pink-300" /> : <Upload className="w-6 h-6 text-pink-300" />}
          <span className="text-sm font-semibold">{enviando ? `Enviando ${enviando} música(s)…` : 'Arraste as músicas aqui ou clique para escolher'}</span>
          <span className="text-[11px] text-zinc-500">MP3, M4A, WAV, AAC ou OGG</span>
        </button>
        <input ref={input} type="file" accept={TIPOS_AUDIO} multiple hidden onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) enviar(f) }} />

        {erro && <p className="rounded-2xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-xs text-red-200 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {erro}</p>}

        <section className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">{lista ? `${lista.length} música(s)` : 'Carregando…'}</p>
          {lista === null && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          {lista?.map(m => (
            <div key={m.path} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <button type="button" onClick={() => ouvir(m)} aria-label={tocando === m.path ? 'Pausar' : 'Ouvir'} className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center shrink-0">
                {tocando === m.path ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{m.nome}</p>
                <p className="text-[11px] text-zinc-500">{[tamanho(m.tamanho), m.criada ? new Date(m.criada).toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => apagar(m)} aria-label="Apagar" className="p-2 rounded-lg text-zinc-500 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
