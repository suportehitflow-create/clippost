'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularHorarios, plataformaPost, NOME_REDE } from '@/lib/publicacao'
import { Cartao, Rotulo, BotaoPrincipal, Aviso } from '@/components/pagina/Base'
import { Calendar, X } from 'lucide-react'

// Agendar vários itens de uma vez (Vídeos com frases, Posts em massa…): contas, dias da semana,
// horários e data de início; a legenda aceita {texto} (ou {frase}) com o texto de cada item.

interface Conta { id: string; platform: string; username: string }
export interface ItemAgendar { clip_id: string | null; texto: string }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendarEmMassa({ itens, legendaInicial = '{texto}', redes, semLegenda = false, titulo }: {
  itens: ItemAgendar[]
  legendaInicial?: string
  /** só estas redes (ex.: stories não vão para o YouTube) */
  redes?: string[]
  semLegenda?: boolean
  titulo?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [contas, setContas] = useState<Conta[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [horarios, setHorarios] = useState<string[]>(['12:00', '19:00'])
  const [novoHorario, setNovoHorario] = useState('09:00')
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [legenda, setLegenda] = useState(legendaInicial)
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const validos = itens.filter(i => i.clip_id)
  const redesChave = redes?.join(',') ?? ''

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('social_accounts').select('id, platform, username').eq('user_id', user.id)
      const permitidas = redesChave ? redesChave.split(',') : null
      const lista = ((data || []) as Conta[]).filter(c => !permitidas || permitidas.includes(c.platform))
      setContas(lista)
      let ativa: string | null = null
      try { ativa = JSON.parse(localStorage.getItem('clippost_active_account') || 'null')?.id ?? null } catch {}
      setSel(lista.some(c => c.id === ativa) ? [ativa!] : lista.slice(0, 1).map(c => c.id))
    })()
  }, [supabase, redesChave])

  const horas = calcularHorarios(dias, horarios, inicio, validos.length)
  const legendaDe = (i: ItemAgendar) => (semLegenda ? '' : legenda.replaceAll('{texto}', i.texto).replaceAll('{frase}', i.texto))

  async function agendar() {
    setErro('')
    if (!dias.length || !horarios.length) return setErro('Escolha pelo menos um dia e um horário.')
    if (!sel.length) return setErro('Escolha em qual conta publicar (ou conecte uma em Ajustes).')
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Faça login de novo.')
      const registros = sel.flatMap(id => {
        const c = contas.find(x => x.id === id)!
        return validos.map((i, k) => ({
          user_id: user.id, clip_id: i.clip_id, platform: plataformaPost(c.platform), social_account_id: c.id,
          caption: legendaDe(i), scheduled_at: horas[k].toISOString(), status: 'scheduled',
        }))
      })
      for (let i = 0; i < registros.length; i += 200) {
        const { error } = await supabase.from('scheduled_posts').insert(registros.slice(i, i + 200))
        if (error) throw new Error(error.message)
      }
      const fmt = (d: Date) => d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      setFeito(`${registros.length} post(s) agendado(s), de ${fmt(horas[0])} a ${fmt(horas[horas.length - 1])}.`)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (feito) return <Cartao><Aviso tipo="ok">{feito} <Link href="/schedule" className="underline font-semibold">Ver no calendário</Link></Aviso></Cartao>

  const chip = (ativo: boolean) => `border ${ativo ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'border-white/[0.08] text-zinc-400'}`

  return (
    <Cartao>
      <Rotulo><Calendar className="w-3.5 h-3.5 text-indigo-400" /> {titulo || `Agendar os ${validos.length} itens`}</Rotulo>
      {erro && <Aviso>{erro}</Aviso>}
      {contas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {contas.map(c => (
            <button key={c.id} type="button" onClick={() => setSel(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${chip(sel.includes(c.id))}`}>
              @{(c.username || '').replace(/^@/, '')} · {NOME_REDE[c.platform] || c.platform}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">Nenhuma conta {redes ? `de ${redes.map(r => NOME_REDE[r] || r).join(', ')} ` : ''}conectada. <Link href="/settings" className="underline">Conectar em Ajustes</Link></p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {DIAS.map((d, i) => (
          <button key={d} type="button" onClick={() => setDias(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]))}
            className={`w-11 py-2 rounded-xl text-xs font-bold ${chip(dias.includes(i))}`}>{d}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {horarios.map(h => (
          <span key={h} className="px-2.5 py-1.5 rounded-xl text-xs font-mono bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5">
            {h}<button type="button" aria-label={`Tirar ${h}`} onClick={() => setHorarios(s => s.filter(x => x !== h))}><X className="w-3 h-3 text-zinc-500" /></button>
          </span>
        ))}
        <input id="agendar-novo-horario" type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="px-2 py-1.5 rounded-xl bg-[#0c0c10] border border-white/[0.1] text-xs" />
        <button type="button" onClick={() => novoHorario && !horarios.includes(novoHorario) && setHorarios(s => [...s, novoHorario])} className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/[0.06]">+ horário</button>
        <span className="ml-auto text-[11px] text-zinc-400 flex items-center gap-1.5">a partir de
          <input id="agendar-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="px-2 py-1.5 rounded-xl bg-[#0c0c10] border border-white/[0.1] text-xs" />
        </span>
      </div>
      {!semLegenda && (
        <div className="space-y-1.5">
          <textarea id="agendar-legenda" value={legenda} onChange={e => setLegenda(e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-sm focus:outline-none focus:border-indigo-500" />
          <p className="text-[10px] text-zinc-500 font-mono">{'{texto}'} vira o texto de cada item</p>
        </div>
      )}
      <BotaoPrincipal icone={Calendar} onClick={agendar} carregando={salvando} textoCarregando="Agendando…" disabled={!validos.length || horas.length < validos.length}>
        Agendar {validos.length * Math.max(1, sel.length)} post(s)
      </BotaoPrincipal>
    </Cartao>
  )
}
