'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'
import AgendarEmMassa, { type ItemAgendar } from '@/components/agendar/AgendarEmMassa'
import { Cartao, Rotulo, BotaoPrincipal, Aviso } from '@/components/pagina/Base'
import { Images, ImagePlus, Loader2, AlertCircle, X, Plus, Type, Film } from 'lucide-react'

// Posts em massa (dentro de Calendário → Agendar em massa): fotos soltas, carrosséis ou stories. Sobe as mídias, agrupa, escreve as legendas
// (uma por post) e agenda nas contas — o agendador publica pelo Upload-Post.

export type TipoPost = 'post' | 'carrossel' | 'story'
type Tipo = TipoPost
interface Midia { id: string; previa: string; url: string | null; video: boolean; erro?: boolean }

const REDES: Record<Tipo, string[]> = {
  post: ['instagram', 'facebook', 'tiktok'],
  carrossel: ['instagram', 'facebook', 'tiktok'],
  story: ['instagram', 'facebook'],
}

export default function PostsEmMassa({ tipo }: { tipo: Tipo }) {
  const supabase = useMemo(() => createClient(), [])
  const [midias, setMidias] = useState<Midia[]>([])
  const [porCarrossel, setPorCarrossel] = useState(5)
  const [textos, setTextos] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(0)
  const [criando, setCriando] = useState(false)
  const [criados, setCriados] = useState<(ItemAgendar & { capa: string; midias: number })[] | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (tipo !== 'story') setMidias(ms => ms.filter(m => !m.video)) }, [tipo])
  const prontas = midias.filter(m => m.url)
  const grupos = useMemo(() => {
    const lista = tipo === 'story' ? midias : midias.filter(m => !m.video)
    if (tipo !== 'carrossel') return lista.map(m => [m])
    const g: Midia[][] = []
    for (let i = 0; i < lista.length; i += porCarrossel) g.push(lista.slice(i, i + porCarrossel))
    // último carrossel com 1 foto só vira post simples — junta no anterior se couber
    if (g.length > 1 && g[g.length - 1].length === 1 && g[g.length - 2].length < 10) g[g.length - 2].push(...g.pop()!)
    return g
  }, [midias, tipo, porCarrossel])
  const linhas = textos.split(/\n-{3,}\n|\n\s*\n/).map(t => t.trim()).filter(Boolean)

  async function adicionar(arquivos: File[]) {
    const aceitas = arquivos.filter(f => f.type.startsWith('image/') || (tipo === 'story' && f.type.startsWith('video/'))).slice(0, 200 - midias.length)
    if (!aceitas.length) return setErro(tipo === 'story' ? 'Envie fotos ou vídeos.' : 'Envie fotos (JPG ou PNG).')
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setErro('Faça login para enviar.')
    const novas = aceitas.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, previa: URL.createObjectURL(f), url: null as string | null, video: f.type.startsWith('video/'), arquivo: f }))
    setMidias(ms => [...ms, ...novas.map(({ arquivo, ...r }) => { void arquivo; return r })])
    setEnviando(n => n + novas.length)
    for (const n of novas) {
      try {
        const ext = n.arquivo.name.split('.').pop()?.toLowerCase() || (n.video ? 'mp4' : 'jpg')
        const r = await uploadFileViaSignedUrl(supabase, 'videos', `${user.id}/posts/midias/${n.id}.${ext}`, n.arquivo, { contentType: n.arquivo.type, upsert: true })
        setMidias(ms => ms.map(m => (m.id === n.id ? { ...m, url: r.publicUrl } : m)))
      } catch {
        setMidias(ms => ms.map(m => (m.id === n.id ? { ...m, erro: true } : m)))
      }
      setEnviando(k => k - 1)
    }
  }

  async function criar() {
    if (enviando) return setErro('Espere as mídias terminarem de subir.')
    const gs = grupos.map(g => g.filter(m => m.url)).filter(g => g.length)
    if (!gs.length) return setErro('Envie as fotos primeiro.')
    setErro('')
    setCriando(true)
    try {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, grupos: gs.map(g => g.map(m => ({ url: m.url, tipo: m.video ? 'video' : 'imagem' }))), textos: tipo === 'story' ? [] : linhas }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível criar os posts.')
      setCriados(d.itens)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setCriando(false)
    }
  }

  const nome = { post: 'post', carrossel: 'carrossel', story: 'story' }[tipo]
  const plural = { post: 'posts', carrossel: 'carrosséis', story: 'stories' }[tipo]

  return (
    <div className="space-y-6">
      {!criados ? (
        <Cartao>
          {erro && <Aviso>{erro}</Aviso>}

          <div className="space-y-2.5">
            <Rotulo direita={midias.length ? <span className="text-[10px] text-indigo-400 font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">{prontas.length}/{midias.length} enviadas</span> : null}>
              <ImagePlus className="w-3.5 h-3.5 text-indigo-400" /> {tipo === 'story' ? 'Fotos ou vídeos' : 'Fotos'}
            </Rotulo>
            <div onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); adicionar(Array.from(e.dataTransfer.files)) }}
              className="border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]">
              {midias.length ? (
                <div className="space-y-2">
                  {grupos.map((g, gi) => (
                    <div key={gi} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 w-8 shrink-0">#{gi + 1}</span>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {g.map(m => (
                          <div key={m.id} className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/[0.05]">
                            {m.video ? <video src={m.previa} muted className="w-full h-full object-cover" /> : <img src={m.previa} alt="" className={`w-full h-full object-cover ${m.url ? '' : 'opacity-50'}`} />}
                            {m.video && <Film className="absolute bottom-0.5 left-0.5 w-3 h-3" />}
                            {!m.url && !m.erro && <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin" />}
                            {m.erro && <AlertCircle className="absolute inset-0 m-auto w-4 h-4 text-red-400" />}
                            <button type="button" aria-label="Tirar" onClick={e => { e.stopPropagation(); setMidias(ms => ms.filter(x => x.id !== m.id)) }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1"><Plus className="w-3 h-3" /> clique ou arraste para adicionar mais</p>
                </div>
              ) : (
                <p className="text-xs text-center text-zinc-400 py-3"><b className="text-white">Clique ou arraste {tipo === 'story' ? 'fotos e vídeos' : 'as fotos'}</b> — na ordem em que devem aparecer</p>
              )}
            </div>
            <input ref={input} type="file" accept={tipo === 'story' ? 'image/*,video/*' : 'image/*'} multiple hidden onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; adicionar(f) }} />
            {tipo === 'carrossel' && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                Fotos por carrossel
                <select id="posts-por-carrossel" value={porCarrossel} onChange={e => setPorCarrossel(Number(e.target.value))} className="px-2 py-1 rounded-lg bg-[#0c0c10] border border-white/[0.1] text-xs">
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>

          {tipo !== 'story' && (
            <div className="space-y-2.5 pt-4 border-t border-white/[0.06]">
              <Rotulo direita={<span className="text-[10px] text-zinc-500 font-mono">{linhas.length} legenda(s)</span>}><Type className="w-3.5 h-3.5 text-indigo-400" /> Legendas</Rotulo>
              <textarea id="posts-textos" value={textos} onChange={e => setTextos(e.target.value)} rows={5}
                placeholder={'Legenda do 1º post...\n\nLegenda do 2º post...\n\n(separe com uma linha em branco; se tiver menos legendas que posts, elas se repetem)'}
                className="w-full px-4 py-3 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-y" />
            </div>
          )}

          <BotaoPrincipal icone={Images} onClick={criar} disabled={!grupos.length || !!enviando} carregando={criando || !!enviando}
            textoCarregando={enviando ? `Enviando ${enviando} mídia(s)…` : 'Criando os posts…'}>
            Criar {grupos.length || ''} {grupos.length === 1 ? nome : plural}
          </BotaoPrincipal>
        </Cartao>
      ) : (
        <>
          <Cartao>
            <Aviso tipo="ok">{criados.length} {criados.length === 1 ? nome : plural} pronto(s). Agora escolha quando publicar.</Aviso>
            <div className="flex gap-2 overflow-x-auto">
              {criados.map(c => (
                <div key={c.clip_id} className="relative w-20 aspect-square rounded-xl overflow-hidden shrink-0 bg-white/[0.05]">
                  <img src={c.capa} alt="" className="w-full h-full object-cover" />
                  {c.midias > 1 && <span className="absolute top-1 right-1 px-1 rounded bg-black/70 text-[9px] font-bold">{c.midias}</span>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setCriados(null); setMidias([]) }} className="text-[11px] text-zinc-500 underline">Criar outros</button>
          </Cartao>
          <AgendarEmMassa itens={criados} redes={REDES[tipo]} semLegenda={tipo === 'story'} titulo={`Agendar os ${criados.length} ${plural}`} />
        </>
      )}
    </div>
  )
}
