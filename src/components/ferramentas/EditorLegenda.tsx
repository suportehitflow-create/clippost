'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { CORTE_MAIS_IG, gerarLegendasIA, juntarLegenda, LIMITE_LEGENDA, NOME_REDE } from '@/lib/publicacao'

/** Legenda com contador por rede, prévia do "...mais" do Instagram e geração com IA */
export default function EditorLegenda({ id, valor, mudar, plataformas, clipId, titulo, linhas = 5 }: {
  id: string
  valor: string
  mudar: (v: string) => void
  plataformas: string[]
  clipId?: string
  titulo?: string
  linhas?: number
}) {
  const [tom, setTom] = useState('viral')
  const [gerando, setGerando] = useState(false)
  const [opcoes, setOpcoes] = useState<{ legenda: string; hashtags: string[] }[]>([])
  const [erro, setErro] = useState('')
  const redes = [...new Set(plataformas.length ? plataformas : ['instagram'])]
  const principal = redes.includes('instagram') ? 'instagram' : redes[0]

  async function gerar() {
    setGerando(true)
    setErro('')
    try {
      setOpcoes(await gerarLegendasIA({ clipId, titulo: titulo || valor, plataforma: principal, tom }))
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-500">Legenda</span>
        <div className="flex items-center gap-1.5">
          <select id={`${id}-tom`} value={tom} onChange={e => setTom(e.target.value)} className="px-2 py-1 rounded-lg bg-black/40 border border-white/[0.1] text-[11px]" aria-label="Tom da legenda">
            <option value="viral">Viral</option>
            <option value="engracado">Engraçado</option>
            <option value="informativo">Informativo</option>
            <option value="polemico">Polêmico</option>
          </select>
          <button type="button" onClick={gerar} disabled={gerando || (!clipId && !titulo && !valor)}
            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-200 flex items-center gap-1 disabled:opacity-50">
            {gerando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Gerar com IA
          </button>
        </div>
      </div>
      <textarea id={id} value={valor} onChange={e => mudar(e.target.value)} rows={linhas} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm" />
      {erro && <p className="text-[11px] text-red-300">{erro}</p>}
      {opcoes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] text-zinc-500">Escolha uma opção (dá para editar depois):</span>
          {opcoes.map((o, i) => (
            <button key={i} type="button" onClick={() => { mudar(juntarLegenda(o, principal)); setOpcoes([]) }}
              className="w-full text-left p-2.5 rounded-xl bg-black/30 border border-white/[0.08] hover:border-indigo-400/60">
              <p className="text-xs text-zinc-200 whitespace-pre-line line-clamp-4">{o.legenda}</p>
              {principal !== 'youtube_shorts' && <p className="text-[10px] text-indigo-300/80 mt-1 line-clamp-1">{o.hashtags.join(' ')}</p>}
            </button>
          ))}
        </div>
      )}
      <ContadorLegenda texto={valor} redes={redes} />
    </div>
  )
}

/** Contador por rede + o que o Instagram mostra antes do "...mais" */
export function ContadorLegenda({ texto, redes }: { texto: string; redes: string[] }) {
  return (
    <>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {redes.map(r => {
          const lim = LIMITE_LEGENDA[r] ?? 2200
          const passou = texto.length > lim
          return (
            <span key={r} className={`text-[10px] tabular-nums ${passou ? 'text-red-300' : 'text-zinc-500'}`}>
              {NOME_REDE[r] ?? r}: {texto.length}/{lim}{r === 'youtube_shorts' && passou ? ' (vira título: corta aqui)' : ''}
            </span>
          )
        })}
      </div>
      {redes.includes('instagram') && texto.trim() && (
        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-2.5">
          <span className="text-[10px] text-zinc-500 block mb-1">Prévia no Instagram</span>
          <p className="text-xs text-zinc-200 whitespace-pre-line">
            {texto.length > CORTE_MAIS_IG ? <>{texto.slice(0, CORTE_MAIS_IG).trimEnd()}<span className="text-zinc-500">... mais</span></> : texto}
          </p>
        </div>
      )}
    </>
  )
}
