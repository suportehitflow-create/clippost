'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { idsDoLote, idYouTube, AGUARDANDO_NAVEGADOR } from '@/lib/lote'
import { baixarPeloNavegador, mandarCortar } from '@/lib/baixarNavegador'
import { useExtensaoClipost, ModalExtensao } from '@/components/bulk/ExtensaoInstagram'

// Lote (canal ou perfil cortado de uma vez): um editor em massa com os cortes de TODOS os vídeos.
// Uma fila cuida dos vídeos um por um e não desiste na primeira: o YouTube bloqueia o servidor (IP de
// datacenter), então o vídeo é baixado pelo navegador de quem usa (extensão) e o servidor corta a partir
// dele. Deu errado? Tenta o outro caminho, até 3 vezes por vídeo, e segue para o próximo.

const EstudioEditor = dynamic(() => import('@/components/editor-massa/EditorMassa'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Abrindo o editor…</div>,
})

interface Filho { id: string; title: string; status: string; source_url: string | null; error_message?: string | null }
interface Corte { id: string; project_id: string; storage_url: string | null; hook: string | null; title: string | null; score: number | null; status: string | null }

const MAX_TENTATIVAS = 3
/** quantos vídeos o servidor corta ao mesmo tempo (a fila espera antes de mandar mais) */
const CORTANDO_JUNTOS = 2

export default function LoteClient({ lote }: { lote: { id: string; title: string; source_url: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const ids = useMemo(() => idsDoLote(lote.source_url) ?? [], [lote.source_url])
  const [filhos, setFilhos] = useState<Filho[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [carregou, setCarregou] = useState(false)
  const { instalada } = useExtensaoClipost()
  const [modalExtensao, setModalExtensao] = useState(false)

  // ---------- leitura (a cada 5 s enquanto a página está aberta) ----------
  const [tique, setTique] = useState(0)
  useEffect(() => {
    let ativo = true
    const buscar = async () => {
      const [p, c] = await Promise.all([
        supabase.from('projects').select('id, title, status, source_url, error_message').in('id', ids),
        supabase.from('clips').select('id, project_id, storage_url, hook, title, score, status').in('project_id', ids),
      ])
      if (!ativo) return
      setFilhos((p.data as Filho[]) ?? [])
      setCortes((c.data as Corte[]) ?? [])
      setCarregou(true)
    }
    buscar()
    const t = setInterval(buscar, 5000)
    return () => { ativo = false; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), tique])

  // ---------- fila: um vídeo por vez, com outro caminho quando um falha ----------
  const chaveTentativas = `clipost:lote-tentativas:${lote.id}`
  const tentativas = useRef<Record<string, number>>({})
  useEffect(() => {
    try { tentativas.current = JSON.parse(sessionStorage.getItem(chaveTentativas) || '{}') } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const guardarTentativas = () => { try { sessionStorage.setItem(chaveTentativas, JSON.stringify(tentativas.current)) } catch {} }
  const trabalhando = useRef(false)
  const [baixando, setBaixando] = useState<string | null>(null)

  const ordem = useMemo(() => new Map(ids.map((id, i) => [id, i])), [ids])
  // vídeo "processando" que não anda (servidor reiniciou no meio, por exemplo): a mesma etapa e o mesmo
  // número de cortes prontos por 15 min → conta como falha e a fila manda de novo
  const andamento = useRef<Record<string, { marca: string; desde: number }>>({})
  const parado = (f: Filho) => {
    if (f.status !== 'processing') return false
    const marca = `${f.error_message || ''}|${cortes.filter(c => c.project_id === f.id && c.storage_url).length}|${cortes.filter(c => c.project_id === f.id).length}`
    const a = andamento.current[f.id]
    if (!a || a.marca !== marca) { andamento.current[f.id] = { marca, desde: Date.now() }; return false }
    return Date.now() - a.desde > 15 * 60 * 1000
  }
  const precisa = (f: Filho) =>
    (f.status === 'pending' && f.error_message === AGUARDANDO_NAVEGADOR) ||
    ((f.status === 'failed' || parado(f)) && (tentativas.current[f.id] ?? 0) < MAX_TENTATIVAS)

  // parado e sem tentativas sobrando: marca como falha, senão fica "processando" para sempre e o lote nunca termina
  const desistidos = useRef(new Set<string>())
  useEffect(() => {
    for (const f of filhos) {
      if (!parado(f) || (tentativas.current[f.id] ?? 0) < MAX_TENTATIVAS || desistidos.current.has(f.id)) continue
      desistidos.current.add(f.id)
      fetch(`/api/projects/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error_message: 'parou no meio do processamento' }),
      }).catch(() => null).finally(() => setTique(t => t + 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filhos, cortes])

  useEffect(() => {
    if (!carregou || trabalhando.current || instalada === null) return
    const cortando = filhos.filter(f => f.status === 'processing' && !parado(f)).length
    if (cortando >= CORTANDO_JUNTOS) return
    const proximo = [...filhos].sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!).find(precisa)
    if (!proximo) return
    trabalhando.current = true
    ;(async () => {
      const n = (tentativas.current[proximo.id] ?? 0) + 1
      tentativas.current[proximo.id] = n
      guardarTentativas()
      setBaixando(proximo.id)
      setFilhos(fs => fs.map(f => (f.id === proximo.id ? { ...f, status: 'processing', error_message: 'step:download' } : f)))
      const { data: { user } } = await supabase.auth.getUser()
      const original = String(proximo.source_url || '')
      try {
        if (!user) throw new Error('sem login')
        // YouTube: as duas primeiras tentativas pelo navegador (o servidor é bloqueado); a última vai pelo
        // servidor, que tem os planos dele (outros clientes e serviços)
        const peloNavegador = !!idYouTube(original) && instalada && n < MAX_TENTATIVAS
        if (peloNavegador) {
          try {
            await mandarCortar(proximo.id, user.id, await baixarPeloNavegador(supabase, user.id, proximo.id, original))
          } catch (e) {
            console.warn('[lote] navegador não baixou, vai pelo servidor:', (e as Error)?.message)
            await mandarCortar(proximo.id, user.id, { url: original })
          }
        } else {
          await mandarCortar(proximo.id, user.id, { url: original })
        }
      } catch (e) {
        await fetch(`/api/projects/${proximo.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed', error_message: (e as Error)?.message || 'falhou' }),
        }).catch(() => null)
      } finally {
        setBaixando(null)
        trabalhando.current = false
        setTique(t => t + 1)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregou, filhos, instalada])

  const aguardando = filhos.filter(precisa)
  const gerando = filhos.filter(f => (f.status === 'processing' || f.status === 'pending') && !precisa(f))
  const falharam = filhos.filter(f => f.status === 'failed' && !precisa(f))
  const prontos = cortes.filter(c => !!c.storage_url)
  const trabalhoAberto = gerando.length + aguardando.length > 0

  // ordem: vídeo a vídeo (na ordem escolhida), e dentro de cada vídeo pela nota da IA
  const projetoEstudio = useMemo(() => {
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

  // "Gerar de novo": zera as tentativas e a fila recomeça pelos que falharam
  function gerarDeNovo() {
    for (const f of falharam) { delete tentativas.current[f.id]; desistidos.current.delete(f.id) }
    guardarTentativas()
    setTique(t => t + 1)
  }

  // o que deu errado, em palavras da pessoa, e o que dá para fazer
  const bloqueio = falharam.some(f => /YouTubeBlock|download|yt-dlp|cobalt|baix|YouTube/i.test(String(f.error_message || '')))
  const explicacao = bloqueio
    ? instalada
      ? 'O YouTube não liberou esses vídeos nem pelo servidor nem pelo seu navegador, mesmo tentando de outros jeitos. Pode tentar de novo daqui a pouco.'
      : 'O YouTube bloqueia downloads vindos de servidores. Com a extensão do Clipost, o download é feito pelo seu navegador e passa.'
    : 'Algo deu errado no processamento, mesmo tentando de novo. Pode gerar de novo.'
  const [avisoFechado, setAvisoFechado] = useState(false)
  const temFalha = carregou && falharam.length > 0 && !trabalhoAberto
  const cartaoErro = temFalha ? (
    <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#111114] p-6 space-y-4 text-left">
      <div>
        <h2 className="text-base font-semibold text-white">
          {falharam.length === ids.length ? 'Nenhum vídeo deste lote virou corte' : `${falharam.length} de ${ids.length} vídeos não viraram corte`}
        </h2>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{explicacao}</p>
      </div>
      <div className="flex flex-col gap-2">
        {bloqueio && instalada === false ? (
          <button type="button" onClick={() => setModalExtensao(true)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold text-white">
            Instalar a extensão
          </button>
        ) : null}
        <button type="button" onClick={gerarDeNovo}
          className={bloqueio && instalada === false
            ? 'w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm font-semibold text-white hover:bg-white/[0.08]'
            : 'w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-semibold text-white'}>
          {falharam.length === ids.length ? 'Gerar de novo' : 'Gerar de novo os que falharam'}
        </button>
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

  const feitos = filhos.filter(f => f.status !== 'processing' && f.status !== 'pending' && !precisa(f)).length
  const posicao = baixando ? (ordem.get(baixando) ?? 0) + 1 : 0
  const resumo = `${ids.length} vídeos · ${prontos.length} cortes prontos` +
    (baixando ? ` · baixando o vídeo ${posicao}` : '') +
    (trabalhoAberto ? ` · faltam ${gerando.length + aguardando.length}` : '') +
    (falharam.length ? ` · ${falharam.length} não deram certo` : '')

  const extensao = modalExtensao && (
    <ModalExtensao fechar={() => setModalExtensao(false)} instalada={instalada}
      motivo="O YouTube bloqueia servidores. Com a extensão, o vídeo é baixado pelo seu navegador." />
  )

  if (!carregou || prontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] -mb-24 bg-[#0a0a0c] px-4 text-center gap-3">
        <h1 className="text-sm font-semibold text-white">{lote.title}</h1>
        {cartaoErro ?? (
          <>
            <p className="text-xs text-zinc-400 max-w-md">
              {!carregou ? 'Carregando…' : `Gerando os cortes de ${ids.length} vídeos, um por um. O editor abre com todos juntos assim que o primeiro ficar pronto. Deixe esta página aberta.`}
            </p>
            {carregou && <p className="text-[11px] text-zinc-500 tabular-nums">{resumo}</p>}
            {carregou && (
              <div className="w-full max-w-sm h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${Math.round((feitos / Math.max(1, ids.length)) * 100)}%` }} />
              </div>
            )}
          </>
        )}
        {extensao}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] -mb-24 min-h-[620px] bg-[#0a0a0c]">
      <EstudioEditor
        projeto={projetoEstudio}
        titulo={`${lote.title} · ${resumo.replace(/^\d+ vídeos · /, '')}`}
        onAgendar={() => router.push(`/schedule?aba=massa&tipo=reels&projeto=${lote.id}`)}
        acoesExtras={null}
      />
      {/* parte do lote falhou: a decisão aparece no meio da tela, uma vez */}
      {cartaoErro && !avisoFechado && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Vídeos que não viraram corte">
          {cartaoErro}
        </div>
      )}
      {extensao}
    </div>
  )
}
