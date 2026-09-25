'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'
import { calcularHorarios, plataformaPost, NOME_REDE } from '@/lib/publicacao'
import BibliotecaMusicas from '@/components/musicas/BibliotecaMusicas'
import type { MusicaNuvem } from '@/lib/musicas'
import { Pagina, Intro, Cartao, Rotulo, Opcoes, BotaoPrincipal, Aviso } from '@/components/pagina/Base'
import { Quote, ImagePlus, Loader2, Music2, X, Type, Palette, Clock, Calendar, CheckCircle2, AlertCircle, FolderOpen, Plus, Layers } from 'lucide-react'

// Vídeos com frases: fotos × frases × música → vídeos 9:16 prontos na Biblioteca, e já agenda.
// A prévia aqui desenha igual ao servidor (backend/services/frases.py).

type Fonte = 'Montserrat' | 'Anton' | 'Roboto' | 'DejaVu'
type Posicao = 'topo' | 'centro' | 'base'
interface Foto { id: string; previa: string; url: string | null; erro?: boolean }
interface ItemJob { frase: string; status: 'pending' | 'processing' | 'done' | 'failed'; url: string | null; clip_id: string | null; erro: string | null }
interface Job { status: 'processing' | 'done' | 'failed'; itens: ItemJob[]; project_id?: string; erro?: string }
interface Conta { id: string; platform: string; username: string }

const FONTES: { id: Fonte; label: string; css: string }[] = [
  { id: 'Montserrat', label: 'Montserrat', css: '800 {px}px Montserrat, sans-serif' },
  { id: 'Anton', label: 'Anton', css: '400 {px}px Anton, Impact, sans-serif' },
  { id: 'Roboto', label: 'Roboto', css: '900 {px}px Roboto, Arial, sans-serif' },
  { id: 'DejaVu', label: 'Clássica', css: '700 {px}px Verdana, DejaVu Sans, sans-serif' },
]
const CORES = ['#ffffff', '#fde047', '#f472b6', '#60a5fa', '#34d399', '#111111']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ---------- prévia (mesmo cálculo do servidor, em escala) ----------
function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const linhas: string[] = []
  for (const par of texto.split('\n')) {
    let atual = ''
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const teste = `${atual} ${p}`.trim()
      if (ctx.measureText(teste).width <= largura || !atual) atual = teste
      else { linhas.push(atual); atual = p }
    }
    linhas.push(atual)
  }
  return linhas
}

function desenhar(canvas: HTMLCanvasElement, img: HTMLImageElement | null, frase: string, arroba: string, e: Estilo) {
  const W = 1080, H = 1920, k = canvas.width / W
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.fillStyle = '#121216'
  ctx.fillRect(0, 0, W, H)
  if (img) {
    const s = Math.max(W / img.width, H / img.height)
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s)
  }
  ctx.fillStyle = `rgba(0,0,0,${e.escurecer / 100})`
  ctx.fillRect(0, 0, W, H)
  const texto = e.maiusculas ? frase.toUpperCase() : frase
  const fonte = FONTES.find(f => f.id === e.fonte)!.css
  let tam = e.tamanho
  ctx.font = fonte.replace('{px}', String(tam))
  let linhas = quebrar(ctx, texto, W - 220)
  while (tam > 36 && linhas.length * tam * 1.25 > H * 0.6) {
    tam -= 6
    ctx.font = fonte.replace('{px}', String(tam))
    linhas = quebrar(ctx, texto, W - 220)
  }
  const alt = tam * 1.25, bloco = alt * linhas.length
  const y0 = e.posicao === 'topo' ? H * 0.16 : e.posicao === 'base' ? H * 0.78 - bloco : (H - bloco) / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  linhas.forEach((l, i) => {
    const y = y0 + i * alt
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6
    if (e.contorno) { ctx.lineWidth = e.contorno * 2; ctx.strokeStyle = e.corContorno; ctx.strokeText(l, W / 2, y) }
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = e.cor
    ctx.fillText(l, W / 2, y)
  })
  if (arroba) {
    ctx.font = fonte.replace('{px}', '40')
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'
    ctx.strokeText('@' + arroba.replace(/^@/, ''), W / 2, H - 170)
    ctx.fillStyle = '#fff'
    ctx.fillText('@' + arroba.replace(/^@/, ''), W / 2, H - 170)
  }
}

interface Estilo { fonte: Fonte; tamanho: number; cor: string; contorno: number; corContorno: string; posicao: Posicao; escurecer: number; maiusculas: boolean }

export default function FrasesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [fotos, setFotos] = useState<Foto[]>([])
  const [texto, setTexto] = useState('A disciplina te leva onde a motivação não alcança.\nFeito é melhor que perfeito.')
  const [estilo, setEstilo] = useState<Estilo>({ fonte: 'Montserrat', tamanho: 76, cor: '#ffffff', contorno: 4, corContorno: '#000000', posicao: 'centro', escurecer: 35, maiusculas: false })
  const [arroba, setArroba] = useState('')
  const [musica, setMusica] = useState<MusicaNuvem | null>(null)
  const [variarTrecho, setVariarTrecho] = useState(true)
  const [modo, setModo] = useState<'pares' | 'todas'>('pares')
  const [duracao, setDuracao] = useState(8)
  const [biblioteca, setBiblioteca] = useState(false)
  const [erro, setErro] = useState('')
  const [enviandoFotos, setEnviandoFotos] = useState(0)
  const [gerando, setGerando] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const inputFotos = useRef<HTMLInputElement>(null)
  const imgPrevia = useRef<HTMLImageElement | null>(null)
  const [versaoImg, setVersaoImg] = useState(0)

  const frases = texto.split('\n').map(f => f.trim()).filter(Boolean)
  const total = modo === 'todas' ? frases.length * Math.max(1, fotos.length) : frases.length
  const totalLimitado = Math.min(60, total)

  // @ da conta ativa no rodapé
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem('clippost_active_account') || 'null'); if (c?.username) setArroba(c.username.replace(/^@/, '')) } catch {}
  }, [])

  // fontes da prévia
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800&family=Roboto:wght@900&display=swap'
    document.head.appendChild(link)
    const t = setTimeout(() => setVersaoImg(v => v + 1), 800)
    return () => { clearTimeout(t); link.remove() }
  }, [])

  // imagem da prévia = primeira foto
  useEffect(() => {
    const f = fotos[0]
    if (!f) { imgPrevia.current = null; setVersaoImg(v => v + 1); return }
    const img = new Image()
    img.onload = () => { imgPrevia.current = img; setVersaoImg(v => v + 1) }
    img.src = f.previa
  }, [fotos])

  useEffect(() => {
    if (!canvas.current) return
    const fonte = FONTES.find(f => f.id === estilo.fonte)!.css.replace('{px}', '40')
    document.fonts?.load(fonte).catch(() => undefined).finally(() => {
      if (canvas.current) desenhar(canvas.current, imgPrevia.current, frases[0] || 'Sua frase aqui', arroba, estilo)
    })
  }, [estilo, arroba, texto, versaoImg]) // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionarFotos(arquivos: File[]) {
    const imgs = arquivos.filter(f => f.type.startsWith('image/')).slice(0, 60 - fotos.length)
    if (!imgs.length) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setErro('Faça login para enviar fotos.')
    const novas = imgs.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, previa: URL.createObjectURL(f), url: null as string | null, arquivo: f }))
    setFotos(fs => [...fs, ...novas.map(({ arquivo, ...r }) => { void arquivo; return r })])
    setEnviandoFotos(n => n + novas.length)
    for (const n of novas) {
      try {
        const ext = n.arquivo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const r = await uploadFileViaSignedUrl(supabase, 'videos', `${user.id}/frases/fotos/${n.id}.${ext}`, n.arquivo, { contentType: n.arquivo.type, upsert: true })
        setFotos(fs => fs.map(f => (f.id === n.id ? { ...f, url: r.publicUrl } : f)))
      } catch {
        setFotos(fs => fs.map(f => (f.id === n.id ? { ...f, erro: true } : f)))
      }
      setEnviandoFotos(k => k - 1)
    }
  }

  async function gerar() {
    if (!frases.length) return setErro('Escreva pelo menos uma frase (uma por linha).')
    if (enviandoFotos) return setErro('Espere as fotos terminarem de subir.')
    setErro('')
    setGerando(true)
    setJob(null)
    try {
      const r = await fetch('/api/frases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fotos: fotos.filter(f => f.url).map(f => f.url), frases, modo, duracao, arroba,
          musica_url: musica?.url ?? null, musica_inicio: 0, variar_trecho: variarTrecho,
          estilo: { fonte: estilo.fonte, tamanho: estilo.tamanho, cor: estilo.cor, contorno: estilo.contorno, cor_contorno: estilo.corContorno, posicao: estilo.posicao, escurecer: estilo.escurecer, maiusculas: estilo.maiusculas },
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível começar.')
      setJobId(d.job_id)
    } catch (e: any) {
      setErro(e.message)
      setGerando(false)
    }
  }

  // acompanha a geração
  useEffect(() => {
    if (!jobId) return
    let parar = false
    const tick = async () => {
      const r = await fetch(`/api/frases?job=${jobId}`, { cache: 'no-store' }).catch(() => null)
      const d = r && (await r.json().catch(() => null))
      if (parar) return
      if (r?.ok && d) {
        setJob(d)
        if (d.status !== 'processing') { setGerando(false); return }
      } else if (r && r.status === 404) {
        setErro(d?.detail || 'A geração se perdeu. Tente de novo.')
        setGerando(false)
        return
      }
      setTimeout(tick, 3000)
    }
    tick()
    return () => { parar = true }
  }, [jobId])

  const prontos = (job?.itens ?? []).filter(i => i.status === 'done' && i.clip_id)
  const feitos = (job?.itens ?? []).filter(i => i.status === 'done' || i.status === 'failed').length

  return (
    <Pagina icone={Quote} titulo="Vídeos com frases">
      <Intro selo="Fotos × frases × música" titulo="Vídeos com frases em série"
        descricao="Suba fotos, escreva as frases (uma por linha) e escolha a música. Saem vídeos 9:16 prontos na Biblioteca — e você já agenda." />

      <Cartao>
        {erro && <Aviso>{erro}</Aviso>}

        {/* fotos */}
        <div className="space-y-2.5">
          <Rotulo direita={fotos.length ? <span className="text-[10px] text-indigo-400 font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">{fotos.length} foto(s)</span> : null}>
            <ImagePlus className="w-3.5 h-3.5 text-indigo-400" /> Fotos de fundo
          </Rotulo>
          <div onClick={() => inputFotos.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); adicionarFotos(Array.from(e.dataTransfer.files)) }}
            className="border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]">
            {fotos.length ? (
              <div className="flex gap-2 overflow-x-auto">
                {fotos.map(f => (
                  <div key={f.id} className="relative w-14 aspect-[9/16] rounded-lg overflow-hidden shrink-0 bg-white/[0.05]">
                    <img src={f.previa} alt="" className={`w-full h-full object-cover ${f.url ? '' : 'opacity-50'}`} />
                    {!f.url && !f.erro && <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin" />}
                    {f.erro && <AlertCircle className="absolute inset-0 m-auto w-4 h-4 text-red-400" />}
                    <button type="button" aria-label="Tirar foto" onClick={e => { e.stopPropagation(); setFotos(fs => fs.filter(x => x.id !== f.id)) }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
                <div className="w-14 aspect-[9/16] rounded-lg border border-dashed border-white/[0.15] flex items-center justify-center shrink-0 text-zinc-500"><Plus className="w-4 h-4" /></div>
              </div>
            ) : (
              <p className="text-xs text-center text-zinc-400"><b className="text-white">Clique ou arraste fotos</b> — sem foto, o fundo fica escuro</p>
            )}
          </div>
          <input ref={inputFotos} type="file" accept="image/*" multiple hidden onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; adicionarFotos(f) }} />
        </div>

        {/* frases */}
        <div className="space-y-2.5">
          <Rotulo direita={<span className="text-[10px] text-indigo-400 font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">{frases.length} frase(s)</span>}>
            <Quote className="w-3.5 h-3.5 text-indigo-400" /> Frases — uma por linha
          </Rotulo>
          <textarea id="frases-texto" value={texto} onChange={e => setTexto(e.target.value)} rows={5}
            className="w-full px-4 py-3 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-y" />
        </div>

        {/* aparência com prévia */}
        <div className="pt-4 border-t border-white/[0.06] grid sm:grid-cols-[150px_1fr] gap-5">
          <canvas ref={canvas} width={270} height={480} className="w-[150px] aspect-[9/16] rounded-2xl border border-white/[0.1] mx-auto sm:mx-0 bg-black" aria-label="Prévia do vídeo" />
          <div className="space-y-4 min-w-0">
            <div className="space-y-2">
              <Rotulo><Type className="w-3.5 h-3.5 text-indigo-400" /> Fonte</Rotulo>
              <Opcoes<Fonte> colunas={4} valor={estilo.fonte} mudar={v => setEstilo(s => ({ ...s, fonte: v }))} opcoes={FONTES.map(f => ({ id: f.id, label: f.label }))} />
            </div>
            <div className="space-y-2">
              <Rotulo><Palette className="w-3.5 h-3.5 text-indigo-400" /> Cor e posição</Rotulo>
              <div className="flex flex-wrap items-center gap-2">
                {CORES.map(c => (
                  <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setEstilo(s => ({ ...s, cor: c, corContorno: c === '#111111' ? '#ffffff' : '#000000' }))}
                    className={`w-7 h-7 rounded-full border-2 ${estilo.cor === c ? 'border-indigo-400 scale-110' : 'border-white/20'}`} style={{ background: c }} />
                ))}
                <button type="button" onClick={() => setEstilo(s => ({ ...s, contorno: s.contorno ? 0 : 4 }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${estilo.contorno ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'border-white/[0.08] text-zinc-400'}`}>Contorno</button>
                <button type="button" onClick={() => setEstilo(s => ({ ...s, maiusculas: !s.maiusculas }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${estilo.maiusculas ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'border-white/[0.08] text-zinc-400'}`}>AA</button>
              </div>
              <Opcoes<Posicao> valor={estilo.posicao} mudar={v => setEstilo(s => ({ ...s, posicao: v }))}
                opcoes={[{ id: 'topo', label: 'Topo' }, { id: 'centro', label: 'Centro' }, { id: 'base', label: 'Embaixo' }]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-zinc-400 space-y-1">Tamanho
                <input id="frases-tamanho" type="range" min={44} max={130} value={estilo.tamanho} onChange={e => setEstilo(s => ({ ...s, tamanho: Number(e.target.value) }))} className="w-full accent-indigo-500" />
              </label>
              <label className="text-[11px] text-zinc-400 space-y-1">Escurecer foto
                <input id="frases-escurecer" type="range" min={0} max={80} value={estilo.escurecer} onChange={e => setEstilo(s => ({ ...s, escurecer: Number(e.target.value) }))} className="w-full accent-indigo-500" />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 shrink-0">@ no rodapé</span>
              <input id="frases-arroba" value={arroba} onChange={e => setArroba(e.target.value)} placeholder="seuperfil"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0c0c10] border border-white/[0.1] text-xs focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>

        {/* música */}
        <div className="space-y-2.5 pt-4 border-t border-white/[0.06]">
          <Rotulo><Music2 className="w-3.5 h-3.5 text-indigo-400" /> Música</Rotulo>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setBiblioteca(true)} className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-sm text-left truncate hover:border-indigo-500/50">
              {musica ? musica.nome : <span className="text-zinc-500">Escolher das minhas músicas…</span>}
            </button>
            {musica && <button type="button" onClick={() => setMusica(null)} aria-label="Sem música" className="p-3 rounded-2xl border border-white/[0.1] text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>}
          </div>
          {musica && (
            <label className="flex items-center gap-2 text-[11px] text-zinc-400">
              <input type="checkbox" checked={variarTrecho} onChange={e => setVariarTrecho(e.target.checked)} className="accent-indigo-500" /> Trecho diferente da música em cada vídeo
            </label>
          )}
        </div>

        {/* combinação + duração */}
        <div className="space-y-4 pt-4 border-t border-white/[0.06]">
          <div className="space-y-2">
            <Rotulo><Layers className="w-3.5 h-3.5 text-indigo-400" /> Como combinar</Rotulo>
            <Opcoes<'pares' | 'todas'> colunas={2} valor={modo} mudar={setModo} opcoes={[
              { id: 'pares', label: 'Uma frase por vídeo', desc: `${frases.length} vídeo(s) · fotos em rodízio` },
              { id: 'todas', label: 'Cada foto × cada frase', desc: `${frases.length * Math.max(1, fotos.length)} vídeo(s)` },
            ]} />
          </div>
          <div className="space-y-2">
            <Rotulo><Clock className="w-3.5 h-3.5 text-indigo-400" /> Duração</Rotulo>
            <Opcoes<number> colunas={4} valor={duracao} mudar={setDuracao} opcoes={[6, 8, 10, 15].map(s => ({ id: s, label: `${s}s` }))} />
          </div>
        </div>

        <BotaoPrincipal icone={Quote} onClick={gerar} disabled={!frases.length || !!enviandoFotos} carregando={gerando}
          textoCarregando={job ? `Gerando… ${feitos} de ${job.itens.length}` : 'Começando…'}>
          Gerar {totalLimitado} vídeo{totalLimitado === 1 ? '' : 's'}{total > 60 ? ' (máx. 60)' : ''}
        </BotaoPrincipal>
      </Cartao>

      {job && <Resultado job={job} />}
      {job && prontos.length > 0 && !gerando && <Agendar itens={prontos} />}

      {biblioteca && <BibliotecaMusicas multiplas={false} fechar={() => setBiblioteca(false)} aoEscolher={(_, ms) => setMusica(ms[0] ?? null)} />}
    </Pagina>
  )
}

function Resultado({ job }: { job: Job }) {
  return (
    <Cartao>
      <Rotulo direita={<Link href="/dashboard" className="text-[11px] text-indigo-300 flex items-center gap-1 hover:underline"><FolderOpen className="w-3.5 h-3.5" /> Ver na Biblioteca</Link>}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Vídeos
      </Rotulo>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {job.itens.map((i, k) => (
          <div key={k} className="aspect-[9/16] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] relative">
            {i.url ? <video src={i.url} controls playsInline preload="metadata" className="w-full h-full object-cover" /> : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                {i.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Loader2 className={`w-4 h-4 ${i.status === 'processing' ? 'animate-spin text-indigo-300' : 'text-zinc-600'}`} />}
                <p className="text-[9px] text-zinc-500 line-clamp-3">{i.status === 'failed' ? i.erro : i.frase}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {job.status === 'failed' && <Aviso>{job.erro || 'A geração falhou.'}</Aviso>}
    </Cartao>
  )
}

function Agendar({ itens }: { itens: ItemJob[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [contas, setContas] = useState<Conta[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [horarios, setHorarios] = useState<string[]>(['12:00', '19:00'])
  const [novoHorario, setNovoHorario] = useState('09:00')
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [legenda, setLegenda] = useState('{frase}\n\n#motivacao #frases #reflexao')
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('social_accounts').select('id, platform, username').eq('user_id', user.id)
      const lista = (data || []) as Conta[]
      setContas(lista)
      let ativa: string | null = null
      try { ativa = JSON.parse(localStorage.getItem('clippost_active_account') || 'null')?.id ?? null } catch {}
      setSel(lista.some(c => c.id === ativa) ? [ativa!] : lista.slice(0, 1).map(c => c.id))
    })()
  }, [supabase])

  const horas = calcularHorarios(dias, horarios, inicio, itens.length)

  async function agendar() {
    setErro('')
    if (!dias.length || !horarios.length) return setErro('Escolha pelo menos um dia e um horário.')
    if (!sel.length) return setErro('Conecte uma conta em Ajustes para agendar.')
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Faça login de novo.')
      const registros = sel.flatMap(id => {
        const c = contas.find(x => x.id === id)!
        return itens.map((i, k) => ({
          user_id: user.id, clip_id: i.clip_id, platform: plataformaPost(c.platform), social_account_id: c.id,
          caption: legenda.replaceAll('{frase}', i.frase), scheduled_at: horas[k].toISOString(), status: 'scheduled',
        }))
      })
      const { error } = await supabase.from('scheduled_posts').insert(registros)
      if (error) throw new Error(error.message)
      setFeito(`${registros.length} post(s) agendado(s), de ${horas[0].toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} a ${horas[horas.length - 1].toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (feito) return <Cartao><Aviso tipo="ok">{feito} <Link href="/schedule" className="underline font-semibold">Ver no calendário</Link></Aviso></Cartao>

  return (
    <Cartao>
      <Rotulo><Calendar className="w-3.5 h-3.5 text-indigo-400" /> Agendar os {itens.length} vídeos</Rotulo>
      {erro && <Aviso>{erro}</Aviso>}
      {contas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {contas.map(c => (
            <button key={c.id} type="button" onClick={() => setSel(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${sel.includes(c.id) ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'border-white/[0.08] text-zinc-400'}`}>
              @{(c.username || '').replace(/^@/, '')} · {NOME_REDE[c.platform as keyof typeof NOME_REDE] || c.platform}
            </button>
          ))}
        </div>
      ) : <p className="text-xs text-zinc-400">Nenhuma conta conectada. <Link href="/settings" className="underline">Conectar em Ajustes</Link></p>}
      <div className="flex flex-wrap gap-1.5">
        {DIAS.map((d, i) => (
          <button key={d} type="button" onClick={() => setDias(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]))}
            className={`w-11 py-2 rounded-xl text-xs font-bold border ${dias.includes(i) ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'border-white/[0.08] text-zinc-500'}`}>{d}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {horarios.map(h => (
          <span key={h} className="px-2.5 py-1.5 rounded-xl text-xs font-mono bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5">
            {h}<button type="button" aria-label={`Tirar ${h}`} onClick={() => setHorarios(s => s.filter(x => x !== h))}><X className="w-3 h-3 text-zinc-500" /></button>
          </span>
        ))}
        <input id="frases-novo-horario" type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="px-2 py-1.5 rounded-xl bg-[#0c0c10] border border-white/[0.1] text-xs" />
        <button type="button" onClick={() => novoHorario && !horarios.includes(novoHorario) && setHorarios(s => [...s, novoHorario])} className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/[0.06]">+ horário</button>
        <span className="ml-auto text-[11px] text-zinc-400 flex items-center gap-1.5">a partir de
          <input id="frases-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="px-2 py-1.5 rounded-xl bg-[#0c0c10] border border-white/[0.1] text-xs" />
        </span>
      </div>
      <div className="space-y-1.5">
        <textarea id="frases-legenda" value={legenda} onChange={e => setLegenda(e.target.value)} rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-[#0c0c10] border border-white/[0.1] text-sm focus:outline-none focus:border-indigo-500" />
        <p className="text-[10px] text-zinc-500 font-mono">{'{frase}'} vira a frase de cada vídeo</p>
      </div>
      <BotaoPrincipal icone={Calendar} onClick={agendar} carregando={salvando} textoCarregando="Agendando…" disabled={horas.length < itens.length}>
        Agendar {itens.length * Math.max(1, sel.length)} post(s)
      </BotaoPrincipal>
    </Cartao>
  )
}
