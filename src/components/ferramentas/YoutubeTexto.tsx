'use client'

import { useState } from 'react'

export interface TextoYoutube {
  titulo: string
  canal: string
  texto: string
  markdown: string
  palavras: number
  tokens_aprox: number
}

/** Texto falado de um vídeo do YouTube (legenda manual ou automática), com copiar e baixar .md */
export default function YoutubeTexto({ aoTexto, compacto, mostrarTexto }: {
  aoTexto?: (r: TextoYoutube) => void
  /** versão enxuta (dentro do Roteiros IA) */
  compacto?: boolean
  /** mostra o texto inteiro abaixo (página Ferramentas) */
  mostrarTexto?: boolean
}) {
  const [url, setUrl] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<TextoYoutube | null>(null)

  async function buscar() {
    setCarregando(true)
    setErro('')
    try {
      const r = await fetch('/api/tools/youtube-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível ler o vídeo.')
      setRes(d)
      aoTexto?.(d)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  function baixarMd() {
    if (!res) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([res.markdown], { type: 'text/markdown' }))
    a.download = `${res.titulo.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60)}.md`
    a.click()
  }

  return (
    <div className={compacto ? 'rounded-2xl bg-[#121216] border border-white/[0.08] p-3 space-y-2' : 'space-y-3'}>
      {compacto && <span className="text-[11px] font-semibold text-zinc-400 block">Ou use um vídeo do YouTube como base</span>}
      <div className="flex gap-2">
        <input
          id={compacto ? 'roteiro-youtube' : 'ferramenta-youtube'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && !carregando && buscar()}
          placeholder="youtube.com/watch?v=..."
          className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <button type="button" onClick={buscar} disabled={carregando || !url.trim()}
          className="px-3 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs font-semibold text-indigo-200 disabled:opacity-50">
          {carregando ? 'Lendo…' : 'Trazer texto'}
        </button>
      </div>
      {erro && <p className="text-[11px] text-red-300">{erro}</p>}
      {res && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <span className="truncate max-w-[60%]">✓ {res.titulo}</span>
          <span className="tabular-nums">{res.palavras.toLocaleString('pt-BR')} palavras · ~{res.tokens_aprox.toLocaleString('pt-BR')} tokens</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(res.texto)} className="underline hover:text-white">Copiar texto</button>
          <button type="button" onClick={baixarMd} className="underline hover:text-white">Baixar .md</button>
        </div>
      )}
      {res && mostrarTexto && (
        <div className="max-h-80 overflow-y-auto rounded-xl bg-black/30 border border-white/[0.06] p-3 text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
          {res.texto}
        </div>
      )}
    </div>
  )
}
