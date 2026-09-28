'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Bot, Loader2, Send } from 'lucide-react'
import { Pagina, Intro, Cartao, Aviso } from '@/components/pagina/Base'

interface Acao { id: string; rotulo: string; href: string }
interface Mensagem { de: 'usuario' | 'assistente'; texto: string; acoes?: Acao[] }

const SUGESTOES = [
  'Quero cortes deste vídeo: https://youtube.com/watch?v=…',
  'Buscar os reels mais vistos do @perfil',
  'Monitorar um canal e cortar todo vídeo novo',
  'Editar vários vídeos com o meu template',
  'Fazer um carrossel e agendar para amanhã',
]

export default function AssistentePage() {
  const [texto, setTexto] = useState('')
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, pensando])

  async function enviar(pedido = texto) {
    const t = pedido.trim()
    if (!t || pensando) return
    const historico = msgs.map(m => ({ de: m.de, texto: m.texto }))
    setMsgs(m => [...m, { de: 'usuario', texto: t }])
    setTexto('')
    setErro('')
    setPensando(true)
    try {
      const r = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t, historico }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não consegui responder agora.')
      setMsgs(m => [...m, { de: 'assistente', texto: d.resposta, acoes: d.acoes || [] }])
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setPensando(false)
    }
  }

  return (
    <Pagina icone={Bot} titulo="Assistente IA">
      <Intro selo="Assistente IA" titulo="O que vamos criar?"
        descricao="Conte com suas palavras — cole um link, um @ ou descreva a ideia — e eu te levo para a ferramenta certa, já preenchida." />

      <Cartao>
        {msgs.length === 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGESTOES.map(s => (
              <button key={s} type="button" onClick={() => setTexto(s)}
                className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer">
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {msgs.map((m, i) => m.de === 'usuario' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-indigo-600/25 border border-indigo-500/30 text-sm text-white whitespace-pre-wrap break-words">{m.texto}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0"><Bot className="w-4 h-4" /></div>
                <div className="min-w-0 space-y-2.5">
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{m.texto}</p>
                  {!!m.acoes?.length && (
                    <div className="flex flex-wrap gap-2">
                      {m.acoes.map((a, j) => (
                        <Link key={a.id} href={a.href}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${j === 0
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-purple-500'
                            : 'bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08]'}`}>
                          {a.rotulo} <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pensando && (
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Pensando…</div>
            )}
            <div ref={fim} />
          </div>
        )}

        {erro && <Aviso>{erro}</Aviso>}

        <form onSubmit={e => { e.preventDefault(); enviar() }} className="relative">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={2000}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Ex.: quero 5 cortes desse podcast com o meu template…"
            className="w-full resize-none pl-4 pr-14 py-3.5 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all" />
          <button type="submit" disabled={!texto.trim() || pensando} aria-label="Enviar"
            className="absolute right-2.5 bottom-3.5 w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            {pensando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </Cartao>
    </Pagina>
  )
}
