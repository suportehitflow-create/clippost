'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { idsDoLote } from '@/lib/lote'

// Lote (canal ou perfil cortado de uma vez): um editor em massa com os cortes de TODOS os vídeos.
// Os vídeos são processados em paralelo; os cortes entram na grade conforme ficam prontos.

const EstudioEditor = dynamic(() => import('@/components/editor-massa/EditorMassa'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Abrindo o editor…</div>,
})

interface Filho { id: string; title: string; status: string; source_url: string | null }
interface Corte { id: string; project_id: string; storage_url: string | null; hook: string | null; title: string | null; score: number | null; status: string | null }

export default function LoteClient({ lote }: { lote: { id: string; title: string; source_url: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const ids = useMemo(() => idsDoLote(lote.source_url) ?? [], [lote.source_url])
  const [filhos, setFilhos] = useState<Filho[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    let ativo = true
    let timer: ReturnType<typeof setTimeout>
    const buscar = async () => {
      const [p, c] = await Promise.all([
        supabase.from('projects').select('id, title, status, source_url').in('id', ids),
        supabase.from('clips').select('id, project_id, storage_url, hook, title, score, status').in('project_id', ids),
      ])
      if (!ativo) return
      const fs = (p.data as Filho[]) ?? []
      setFilhos(fs)
      setCortes((c.data as Corte[]) ?? [])
      setCarregou(true)
      const gerando = fs.some(f => f.status === 'processing' || f.status === 'pending')
      if (gerando) timer = setTimeout(buscar, 5000)
    }
    buscar()
    return () => { ativo = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  const gerando = filhos.filter(f => f.status === 'processing' || f.status === 'pending')
  const falharam = filhos.filter(f => f.status === 'failed')
  const prontos = cortes.filter(c => !!c.storage_url)

  // ordem: vídeo a vídeo (na ordem escolhida), e dentro de cada vídeo pela nota da IA
  const projetoEstudio = useMemo(() => {
    const ordem = new Map(ids.map((id, i) => [id, i]))
    const statusDe = new Map(filhos.map(f => [f.id, f.status]))
    const lista = cortes
      .filter(c => !!c.storage_url || statusDe.get(c.project_id) === 'processing')
      .sort((a, b) => (ordem.get(a.project_id)! - ordem.get(b.project_id)!) || ((b.score ?? 0) - (a.score ?? 0)))
    return {
      id: lote.id,
      titulo: lote.title,
      isYouTube: true,
      clips: lista.map(c => ({
        id: c.id,
        url: c.storage_url || '',
        titulo: c.hook || c.title || '',
        pronto: !!c.storage_url,
        status: c.status || (c.storage_url ? 'completed' : 'processing'),
        nota: typeof c.score === 'number' ? Math.round(c.score * 100) / 10 : undefined,
      })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote.id, lote.title, ids.join(','), filhos.map(f => f.id + f.status).join('|'), cortes.map(c => c.id + (c.storage_url ?? '') + (c.status ?? '')).join('|')])

  const resumo = `${ids.length} vídeos · ${prontos.length} cortes prontos` +
    (gerando.length ? ` · gerando ${gerando.length}` : '') + (falharam.length ? ` · ${falharam.length} não deram certo` : '')

  if (!carregou || prontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] -mb-24 bg-[#0a0a0c] px-4 text-center gap-3">
        <h1 className="text-sm font-semibold text-white">{lote.title}</h1>
        <p className="text-xs text-zinc-400">
          {!carregou ? 'Carregando…' : gerando.length
            ? `Gerando os cortes de ${ids.length} vídeos. O editor abre com todos juntos assim que o primeiro ficar pronto.`
            : 'Nenhum corte ficou pronto neste lote.'}
        </p>
        {carregou && <p className="text-[11px] text-zinc-500 tabular-nums">{resumo}</p>}
        {carregou && (
          <div className="w-full max-w-sm h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
              style={{ width: `${Math.round(((ids.length - gerando.length) / Math.max(1, ids.length)) * 100)}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] -mb-24 min-h-[620px] bg-[#0a0a0c]">
      <EstudioEditor
        projeto={projetoEstudio}
        titulo={`${lote.title} · ${resumo}`}
        onAgendar={() => router.push(`/schedule?aba=massa&tipo=reels&projeto=${lote.id}`)}
        acoesExtras={null}
      />
    </div>
  )
}
