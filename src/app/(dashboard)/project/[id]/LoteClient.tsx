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

interface Filho { id: string; title: string; status: string; source_url: string | null; error_message?: string | null }
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
        supabase.from('projects').select('id, title, status, source_url, error_message').in('id', ids),
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

  // os que falharam (ex.: o YouTube bloqueou o download) começam de novo com um clique
  const [refazendo, setRefazendo] = useState(false)
  async function gerarDeNovo() {
    setRefazendo(true)
    const { data: { user } } = await supabase.auth.getUser()
    for (const f of falharam) {
      await fetch(`/api/projects/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing', error_message: null }),
      }).catch(() => null)
      await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: f.source_url, project_id: f.id, user_id: user?.id }),
      }).catch(() => null)
    }
    setFilhos(fs => fs.map(f => (f.status === 'failed' ? { ...f, status: 'processing' } : f)))
    setRefazendo(false)
    setTimeout(() => window.location.reload(), 1500)
  }
  // o que deu errado, em palavras da pessoa, e o que dá para fazer
  const erros = falharam.map(f => String(f.error_message || ''))
  const bloqueio = erros.some(m => /YouTubeBlock|download|yt-dlp|cobalt|baix/i.test(m))
  const interrompido = erros.some(m => /interrompid|deploy/i.test(m))
  const explicacao = bloqueio
    ? 'O YouTube não liberou o download dos vídeos no nosso servidor. Colar os cookies de uma conta do YouTube em Ajustes costuma resolver.'
    : interrompido
      ? 'O processamento foi interrompido no meio por uma atualização do servidor. Pode gerar de novo.'
      : 'Algo deu errado no processamento. Pode gerar de novo.'
  const [avisoFechado, setAvisoFechado] = useState(false)
  const temFalha = carregou && falharam.length > 0 && !gerando.length
  const cartaoErro = temFalha ? (
    <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#111114] p-6 space-y-4 text-left">
      <div>
        <h2 className="text-base font-semibold text-white">
          {falharam.length === ids.length ? 'Nenhum vídeo deste lote virou corte' : `${falharam.length} de ${ids.length} vídeos não viraram corte`}
        </h2>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{explicacao}</p>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={gerarDeNovo} disabled={refazendo}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold text-white disabled:opacity-50">
          {refazendo ? 'Começando…' : falharam.length === ids.length ? 'Gerar de novo' : 'Gerar de novo os que falharam'}
        </button>
        {bloqueio && (
          <button type="button" onClick={() => router.push('/settings')}
            className="w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm font-semibold text-white hover:bg-white/[0.08]">
            Colar cookies do YouTube
          </button>
        )}
        {prontos.length > 0 ? (
          <button type="button" onClick={() => setAvisoFechado(true)} className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-white">
            Continuar com os {prontos.length} cortes prontos
          </button>
        ) : (
          <button type="button" onClick={() => router.push('/dashboard')} className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-white">
            Voltar para a Biblioteca
          </button>
        )}
      </div>
    </div>
  ) : null

  const resumo = `${ids.length} vídeos · ${prontos.length} cortes prontos` +
    (gerando.length ? ` · gerando ${gerando.length}` : '') + (falharam.length ? ` · ${falharam.length} não deram certo` : '')

  if (!carregou || prontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] -mb-24 bg-[#0a0a0c] px-4 text-center gap-3">
        <h1 className="text-sm font-semibold text-white">{lote.title}</h1>
        {cartaoErro ?? (
          <>
            <p className="text-xs text-zinc-400">
              {!carregou ? 'Carregando…' : `Gerando os cortes de ${ids.length} vídeos. O editor abre com todos juntos assim que o primeiro ficar pronto.`}
            </p>
            {carregou && <p className="text-[11px] text-zinc-500 tabular-nums">{resumo}</p>}
            {carregou && (
              <div className="w-full max-w-sm h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${Math.round(((ids.length - gerando.length) / Math.max(1, ids.length)) * 100)}%` }} />
              </div>
            )}
          </>
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
      {/* parte do lote falhou: a decisão aparece no meio da tela, uma vez */}
      {cartaoErro && !avisoFechado && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Vídeos que não viraram corte">
          {cartaoErro}
        </div>
      )}
    </div>
  )
}
