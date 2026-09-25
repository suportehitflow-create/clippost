'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'

// Raio-X do perfil: nota de A a E a partir dos vídeos recentes (backend: services/ferramentas.py)

interface RaioX {
  perfil: string
  plataforma: string
  analisados: number
  nota: string
  pontos: number
  views_media: number
  views_mediana: number
  engajamento: number
  posts_por_semana: number
  ultimo_post: string | null
  melhor_video: { titulo: string; url: string; views: number | null }
  estouraram: { titulo: string; url: string; views: number | null }[]
  dicas: string[]
}

const num = (n: number | null | undefined) => (n == null ? '—' : Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n))
const COR_NOTA: Record<string, string> = { A: '#10b981', B: '#84cc16', C: '#f59e0b', D: '#f97316', E: '#ef4444' }

/** Busca e mostra o Raio-X de um perfil (recarrega quando o perfil muda) */
export function ResultadoRaioX({ perfil }: { perfil: string }) {
  const [r, setR] = useState<RaioX | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    setR(null)
    setErro('')
    let vivo = true
    fetch('/api/tools/raio-x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil }) })
      .then(async res => {
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.detail || 'Não foi possível analisar.')
        if (vivo) setR(d)
      })
      .catch(e => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [perfil])

  if (erro) return <p className="text-xs text-red-300">{erro}</p>
  if (!r) return <div className="flex items-center gap-2 text-xs text-zinc-500 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo os vídeos recentes…</div>
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black" style={{ color: COR_NOTA[r.nota], background: `${COR_NOTA[r.nota]}1f` }}>{r.nota}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{r.pontos}/100</p>
          <p className="text-[11px] text-zinc-500 truncate">{r.perfil}</p>
          <p className="text-[11px] text-zinc-500">Com base nos {r.analisados} vídeos mais recentes · engajamento, frequência e constância das views</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { r: 'Views (mediana)', v: num(r.views_mediana) },
          { r: 'Engajamento', v: `${r.engajamento.toLocaleString('pt-BR')}%` },
          { r: 'Posts/semana', v: r.posts_por_semana.toLocaleString('pt-BR') },
          { r: 'Views (média)', v: num(r.views_media) },
        ].map(x => (
          <div key={x.r} className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2">
            <span className="text-[10px] text-zinc-500">{x.r}</span>
            <p className="text-sm font-semibold tabular-nums">{x.v}</p>
          </div>
        ))}
      </div>
      {r.estouraram.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-zinc-400">Vídeos que estouraram (2× a mediana ou mais)</span>
          {r.estouraram.map(v => (
            <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl bg-black/30 border border-white/[0.06] hover:border-white/[0.15]">
              <span className="truncate">{v.titulo || 'Vídeo'}</span>
              <span className="tabular-nums text-zinc-400 shrink-0">{num(v.views)} views</span>
            </a>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {r.dicas.map(d => <li key={d} className="text-xs text-zinc-300 flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300 shrink-0 mt-0.5" />{d}</li>)}
      </ul>
    </div>
  )
}

export function ModalRaioX({ perfil, fechar }: { perfil: string; fechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Raio-X do perfil">
      <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-5 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold">Raio-X do perfil</h3>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <ResultadoRaioX perfil={perfil} />
      </div>
    </div>
  )
}
