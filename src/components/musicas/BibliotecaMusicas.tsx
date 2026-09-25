'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Music2, Play, Pause, Upload, X, Check } from 'lucide-react'
import { baixarMusicaNuvem, enviarMusicaNuvem, listarMusicas, TIPOS_AUDIO, type MusicaNuvem } from '@/lib/musicas'

// Seletor da biblioteca de músicas (nuvem): ouvir, enviar novas e escolher uma ou várias.
// aoEscolher recebe os arquivos já baixados (o editor trabalha com File).

export default function BibliotecaMusicas({ fechar, aoEscolher, multiplas = true }: {
  fechar: () => void
  aoEscolher: (arquivos: File[], musicas: MusicaNuvem[]) => void
  multiplas?: boolean
}) {
  const [lista, setLista] = useState<MusicaNuvem[] | null>(null)
  const [erro, setErro] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [tocando, setTocando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
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
    setOcupado('enviar')
    setErro('')
    try {
      const novas: MusicaNuvem[] = []
      for (const f of arquivos) novas.push(await enviarMusicaNuvem(f))
      setLista(l => [...novas, ...(l || [])])
      setSel(s => (multiplas ? [...novas.map(n => n.path), ...s] : novas.slice(0, 1).map(n => n.path)))
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  async function confirmar() {
    const escolhidas = (lista || []).filter(m => sel.includes(m.path))
    if (!escolhidas.length) return
    setOcupado('usar')
    setErro('')
    try {
      const arquivos = await Promise.all(escolhidas.map(baixarMusicaNuvem))
      aoEscolher(arquivos, escolhidas)
      fechar()
    } catch (e: any) {
      setErro(e.message)
      setOcupado(null)
    }
  }

  const alternar = (p: string) => setSel(s => (s.includes(p) ? s.filter(x => x !== p) : multiplas ? [...s, p] : [p]))

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={fechar}>
      <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl bg-[#111114] border border-white/[0.1] text-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Music2 className="w-4 h-4 text-pink-300" /> Minhas músicas</h3>
          <button type="button" onClick={fechar} aria-label="Fechar" className="p-1 rounded-lg hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {lista === null && <p className="text-xs text-zinc-500 flex items-center gap-2 p-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…</p>}
          {lista?.length === 0 && !erro && <p className="text-xs text-zinc-500 p-2">Nenhuma música ainda. Envie as suas faixas — elas ficam salvas na sua conta para usar em qualquer vídeo.</p>}
          {lista?.map(m => (
            <div key={m.path} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer ${sel.includes(m.path) ? 'bg-indigo-500/15 border-indigo-400/40' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`} onClick={() => alternar(m.path)}>
              <button type="button" onClick={e => { e.stopPropagation(); ouvir(m) }} aria-label={tocando === m.path ? 'Pausar' : 'Ouvir'} className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                {tocando === m.path ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <span className="flex-1 min-w-0 text-xs truncate">{m.nome}</span>
              {sel.includes(m.path) && <Check className="w-4 h-4 text-indigo-300 shrink-0" />}
            </div>
          ))}
          {erro && <p className="text-xs text-red-300 p-2">{erro}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-white/[0.08]">
          <button type="button" onClick={() => input.current?.click()} disabled={!!ocupado} className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] border border-white/[0.08] flex items-center gap-1.5 disabled:opacity-50">
            {ocupado === 'enviar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Enviar músicas
          </button>
          <button type="button" onClick={confirmar} disabled={!sel.length || !!ocupado} className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-1.5 disabled:opacity-40">
            {ocupado === 'usar' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Usar {sel.length > 1 ? `${sel.length} músicas` : 'música'}
          </button>
          <input ref={input} type="file" accept={TIPOS_AUDIO} multiple hidden onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) enviar(f) }} />
        </div>
      </div>
    </div>
  )
}
