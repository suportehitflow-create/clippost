'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Ritmo de publicação e resultados — SÓ dados reais das publicações do usuário.
// Sem conta conectada não aparece nada (no Início) ou mostra o convite para conectar (/resultados).

interface PostData {
  id: string
  scheduled_at: string
  status: 'published' | 'scheduled' | 'failed'
  platform: string
}

export default function PainelResultados({ compacto = false }: { compacto?: boolean; nomeUsuario?: string }) {
  const supabase = createClient()
  const [periodo, setPeriodo] = useState<7 | 30>(7)
  const [posts, setPosts] = useState<PostData[]>([])
  const [temConta, setTemConta] = useState<boolean | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setTemConta(false)
      const [contas, ps] = await Promise.all([
        supabase.from('social_accounts').select('id').eq('user_id', user.id).limit(1),
        supabase.from('scheduled_posts').select('id, scheduled_at, status, platform').eq('user_id', user.id).order('scheduled_at', { ascending: false }).limit(1000),
      ])
      setTemConta(!!contas.data?.length)
      setPosts((ps.data as PostData[]) ?? [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dias = useMemo(() => {
    const hoje = new Date()
    return Array.from({ length: periodo }, (_, k) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (periodo - 1 - k))
      const doDia = posts.filter(p => {
        const x = new Date(p.scheduled_at)
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate()
      })
      return {
        label: periodo === 7 ? d.toLocaleDateString('pt-BR', { weekday: 'narrow' }) : String(d.getDate()),
        publicados: doDia.filter(p => p.status === 'published').length,
        agendados: doDia.filter(p => p.status === 'scheduled').length,
      }
    })
  }, [posts, periodo])

  const inicio = Date.now() - periodo * 86400000
  const noPeriodo = posts.filter(p => new Date(p.scheduled_at).getTime() >= inicio)
  const publicados = noPeriodo.filter(p => p.status === 'published').length
  const falhas = noPeriodo.filter(p => p.status === 'failed').length
  const agendados = posts.filter(p => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() >= Date.now()).length
  const taxa = publicados + falhas ? Math.round((publicados / (publicados + falhas)) * 100) : null
  const max = Math.max(1, ...dias.map(d => d.publicados + d.agendados))

  if (temConta === null) return null
  if (!temConta) {
    if (compacto) return null
    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 text-center space-y-2">
        <h2 className="text-base font-semibold text-white">Nenhuma conta conectada</h2>
        <p className="text-sm text-zinc-400">Conecte o Instagram, TikTok, Facebook ou YouTube para ver o ritmo de publicação e os resultados.</p>
        <Link href="/settings#social" className="inline-block mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white">Conectar conta</Link>
      </div>
    )
  }

  return (
    <div className={`w-full rounded-3xl border border-white/[0.08] bg-[#0d0d12] p-5 sm:p-6 space-y-5 ${compacto ? '' : 'max-w-5xl mx-auto'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Ritmo de publicação</h3>
        <div className="flex items-center gap-3">
          <div className="flex p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg">
            {([7, 30] as const).map(p => (
              <button key={p} type="button" onClick={() => setPeriodo(p)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md ${periodo === p ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                {p} dias
              </button>
            ))}
          </div>
          {compacto && (
            <Link href="/schedule" className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Calendário <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
        <div className="lg:col-span-7 flex items-end justify-between gap-1.5 h-24">
          {dias.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.publicados} publicados · ${d.agendados} agendados`}>
              <div className="w-full max-w-[14px] h-16 bg-white/[0.04] rounded-t-sm flex flex-col justify-end overflow-hidden">
                {d.agendados > 0 && <div className="w-full bg-amber-400/70" style={{ height: `${(d.agendados / max) * 100}%` }} />}
                {d.publicados > 0 && <div className="w-full bg-emerald-400" style={{ height: `${(d.publicados / max) * 100}%` }} />}
              </div>
              <span className="text-[9px] text-zinc-500 tabular-nums">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
          {[
            { r: 'Publicados', v: publicados, c: 'text-emerald-300' },
            { r: 'Agendados', v: agendados, c: 'text-amber-300' },
            { r: 'Falharam', v: falhas, c: 'text-rose-300' },
            { r: 'Taxa de sucesso', v: taxa === null ? '—' : `${taxa}%`, c: 'text-white' },
          ].map(x => (
            <div key={x.r} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{x.r}</span>
              <p className={`text-lg font-bold tabular-nums ${x.c}`}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>
      {!compacto && (
        <p className="text-[11px] text-zinc-500">
          Visualizações, alcance e seguidores de cada conta ficam no <Link href="/raio-x-pagina" className="text-indigo-400 hover:text-indigo-300">Raio-X da página</Link>.
        </p>
      )}
    </div>
  )
}
