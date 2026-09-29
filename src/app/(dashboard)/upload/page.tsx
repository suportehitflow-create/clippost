'use client'

import ProfileSwitcher from '@/components/ProfileSwitcher'
import { LiquidToggle } from '@/components/ui/LiquidToggle'
import { Suspense, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadFileViaSignedUrl } from '@/lib/storage-upload'
import { Intro, Cartao, Rotulo, Campo, Opcoes, BotaoPrincipal, Aviso, Divisoria } from '@/components/pagina/Base'
import Explorador, { type PedidoBusca } from '@/components/explorar/Explorador'
import { Scissors, Link2, UploadCloud, Search } from 'lucide-react'

// Criar cortes: UM campo de link que entende o que foi colado.
//  - vídeo do YouTube (ou arquivo MP4) → a IA escolhe os melhores momentos e gera os cortes
//  - canal ou perfil (YouTube, Instagram, TikTok, Facebook) → busca os vídeos em massa e, se quiser,
//    automatiza os cortes dos vídeos que ainda vão sair (o antigo Piloto automático)

type Tipo = 'video' | 'perfil' | 'post' | null
type Duracao = '30' | '60' | '90' | 'auto'
type Modo = 'biblioteca' | 'aprovar' | 'auto'

function tipoDoLink(t: string): { tipo: Tipo; nome: string } {
  const s = t.trim()
  if (!s) return { tipo: null, nome: '' }
  const u = s.toLowerCase()
  if (/^@?[a-z0-9._]{2,30}$/.test(u)) return { tipo: 'perfil', nome: 'Perfil do Instagram' }
  if (/youtube\.com|youtu\.be/.test(u)) {
    if (/youtu\.be\/|[?&]v=|\/shorts\/|\/live\//.test(u)) return { tipo: 'video', nome: 'Vídeo do YouTube' }
    return { tipo: 'perfil', nome: 'Canal do YouTube' }
  }
  if (/instagram\.com/.test(u)) return /\/(p|reel|reels|tv)\//.test(u) ? { tipo: 'post', nome: 'Post do Instagram' } : { tipo: 'perfil', nome: 'Perfil do Instagram' }
  if (/tiktok\.com/.test(u)) return /\/video\/|vm\.tiktok|vt\.tiktok/.test(u) ? { tipo: 'post', nome: 'Vídeo do TikTok' } : { tipo: 'perfil', nome: 'Perfil do TikTok' }
  if (/facebook\.com|fb\.watch/.test(u)) return /\/(watch|reel|videos)\b|fb\.watch/.test(u) ? { tipo: 'post', nome: 'Vídeo do Facebook' } : { tipo: 'perfil', nome: 'Página do Facebook' }
  return { tipo: 'video', nome: 'Vídeo' }
}

const DURACOES: { id: Duracao; label: string; desc: string }[] = [
  { id: 'auto', label: 'Automático', desc: 'A IA decide, até 1m30s' },
  { id: '30', label: 'Curtos', desc: '20 a 50s' },
  { id: '90', label: 'Longos', desc: '60 a 90s' },
]
const QUANTOS = [{ id: 10, label: '10' }, { id: 25, label: '25' }, { id: 50, label: '50' }, { id: 500, label: 'Todos' }]
const ORDENS = [{ id: 'recentes', label: 'Mais recentes' }, { id: 'visualizados', label: 'Mais vistos' }, { id: 'curtidos', label: 'Mais curtidos' }]
const PERIODOS = [{ id: 0, label: 'Tudo' }, { id: 7, label: '7 dias' }, { id: 30, label: '30 dias' }, { id: 90, label: '90 dias' }]
const INTERVALOS = [60, 180, 300, 420, 720, 1440]
const MODOS: { id: Modo; label: string; desc: string }[] = [
  { id: 'biblioteca', label: 'Só na Biblioteca', desc: 'Você posta quando quiser' },
  { id: 'aprovar', label: 'Eu aprovo antes', desc: 'Aprova cada corte' },
  { id: 'auto', label: 'Postar sozinho', desc: 'Um corte a cada 3h' },
]

function Conteudo() {
  const [aba, setAba] = useState<'link' | 'file'>('link')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [duracao, setDuracao] = useState<Duracao>('auto')
  const [quantos, setQuantos] = useState(25)
  const [ordem, setOrdem] = useState('recentes')
  const [periodo, setPeriodo] = useState(0)
  const [automatizar, setAutomatizar] = useState(false)
  const [intervalo, setIntervalo] = useState(60)
  const [modo, setModo] = useState<Modo>('biblioteca')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [pedido, setPedido] = useState<PedidoBusca | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { tipo, nome } = tipoDoLink(url)

  useEffect(() => {
    const u = searchParams.get('url')
    if (u) { setUrl(decodeURIComponent(u)); setAba('link') }
    fetch('/api/autopilot/settings', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => d?.interval_minutes && setIntervalo(d.interval_minutes)).catch(() => {})
  }, [searchParams])

  /** Um vídeo (link ou arquivo) → projeto + processamento. Devolve o id do projeto. */
  async function criarCortes(fonte: { url?: string; file?: File; titulo?: string }): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); throw new Error('Entre na sua conta.') }
    let titulo = fonte.titulo || fonte.file?.name || 'Processamento com IA'
    if (fonte.url && !fonte.titulo) {
      try {
        const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(fonte.url)}&format=json`)
        if (oe.ok) titulo = (await oe.json()).title || titulo
      } catch {}
    }
    const { data: project, error: dbErr } = await supabase.from('projects').insert({
      user_id: user.id, title: titulo, source_url: fonte.url || null, source_type: fonte.url ? 'url' : 'file', status: 'processing',
    }).select().single()
    if (dbErr || !project) throw new Error(dbErr?.message || 'Erro ao criar projeto.')
    let sourceUrl = fonte.url || ''
    if (fonte.file) {
      const path = `${user.id}/${project.id}/original.${fonte.file.name.split('.').pop()}`
      const up = await uploadFileViaSignedUrl(supabase, 'videos', path, fonte.file)
      sourceUrl = up.publicUrl
      await supabase.from('projects').update({ source_url: sourceUrl, storage_path: up.path }).eq('id', project.id)
    }
    // o template é o do perfil ativo (o servidor lê direto da conta)
    const r = await fetch('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl, user_id: user.id, clip_duration: duracao, project_id: project.id, remove_silence: false }),
    }).catch(() => null)
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {}
      const msg = d.error || 'O servidor de processamento não respondeu. Tente novamente em instantes.'
      await supabase.from('projects').update({ status: 'failed', error_message: msg }).eq('id', project.id)
      throw new Error(msg)
    }
    return project.id
  }

  async function automatizarPerfil() {
    const r = await fetch('/api/autopilot/watches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: url.trim(), clip_duration: duracao, modo, auto_post: modo === 'auto' }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.detail || 'Não foi possível automatizar esse perfil.')
    await fetch('/api/autopilot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval_minutes: intervalo }) }).catch(() => null)
    return d.watch?.channel_name || 'o perfil'
  }

  async function enviar() {
    setErro('')
    setOk('')
    if (aba === 'file') {
      if (!file) return setErro('Escolha um arquivo de vídeo.')
    } else if (!url.trim()) {
      return setErro('Cole um link.')
    }
    setLoading(true)
    try {
      if (aba === 'file') {
        router.push(`/project/${await criarCortes({ file: file! })}`)
        return
      }
      if (tipo === 'perfil') {
        if (automatizar) setOk(`Cortes futuros automatizados: ${await automatizarPerfil()}. Cada vídeo novo vira corte sozinho.`)
        // canal do YouTube: os vídeos longos (aba Vídeos), que são os que viram cortes
        // link de compartilhar vem com ?si=... / ?igsh=... : só o endereço do perfil interessa
        let perfil = url.trim().replace(/[?#].*$/, '')
        if (/youtube\.com\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)\/?$/i.test(perfil)) perfil = perfil.replace(/\/?$/, '/videos')
        setPedido({ perfil, limite: quantos, ordem, periodo, n: Date.now() })
        setLoading(false)
        return
      }
      if (tipo === 'post') {
        // um vídeo curto de rede social: vai direto para o editor, no seu template
        const r = await fetch('/api/bulk/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'files', videos: [{ url: url.trim(), title: nome }], options: { download_only: true, salvar_biblioteca: true } }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.detail || d.error || 'Não foi possível baixar esse vídeo.')
        try { localStorage.setItem('clipost:editor-importar-lote', JSON.stringify({ batch: d.batch_id, itens: [{ titulo: nome }] })) } catch {}
        router.push('/bulk?aba=editor')
        return
      }
      router.push(`/project/${await criarCortes({ url: url.trim() })}`)
    } catch (e: any) {
      setErro(e.message || 'Falha ao iniciar.')
      setLoading(false)
    }
  }

  // canal do YouTube: cada vídeo marcado vira um projeto de cortes
  async function cortesDoCanal(videos: { url: string; titulo: string }[]) {
    for (const v of videos) await criarCortes({ url: v.url, titulo: v.titulo || undefined })
    router.push('/dashboard')
  }

  const textoBotao = aba === 'file' ? 'Criar cortes'
    : tipo === 'perfil' ? (automatizar ? 'Buscar vídeos e automatizar' : 'Buscar vídeos')
    : tipo === 'post' ? 'Abrir no editor'
    : 'Criar cortes'

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#07070a] text-white">
      <header className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 sm:px-8 bg-[#0a0a0e]/80 backdrop-blur-xl sticky top-0 z-20">
        <h1 className="text-sm font-semibold text-zinc-200">Criar cortes</h1>
        <ProfileSwitcher />
      </header>

      {pedido ? (
        <Explorador embutido pedido={pedido} aoNovaBusca={() => setPedido(null)} aoCriarCortes={cortesDoCanal} />
      ) : (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-10 space-y-8">
          <Intro titulo="Criar cortes" descricao="Cole um link. Vídeo vira cortes; canal ou perfil traz os vídeos em massa." />

          <div className="flex p-1 bg-white/[0.02] border border-white/[0.08] rounded-2xl max-w-xs mx-auto gap-1">
            {([{ id: 'link', l: 'Por link', i: Link2 }, { id: 'file', l: 'Arquivo MP4', i: UploadCloud }] as const).map(x => (
              <button key={x.id} type="button" onClick={() => setAba(x.id)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border ${aba === x.id ? 'bg-indigo-600 text-white border-indigo-500' : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.03]'}`}>
                <x.i className="w-3.5 h-3.5" /> {x.l}
              </button>
            ))}
          </div>

          <Cartao>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {ok && <Aviso tipo="ok">{ok}</Aviso>}

            {aba === 'link' ? (
              <div className="space-y-2.5">
                <Rotulo direita={nome ? <span className="text-[11px] text-zinc-400">{nome}</span> : undefined}>Link</Rotulo>
                <Campo icone={Link2} id="criar-link" type="text" value={url} onChange={e => setUrl(e.target.value)} disabled={loading}
                  onKeyDown={e => e.key === 'Enter' && !loading && enviar()}
                  placeholder="Vídeo do YouTube, canal ou perfil (Instagram, TikTok, Facebook)" />
                <p className="text-[11px] text-zinc-500">Vídeo longo do YouTube → cortes curtos · Canal ou perfil → extração em massa dos vídeos</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Rotulo>Arquivo de vídeo</Rotulo>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-white/[0.01] hover:bg-white/[0.03] space-y-2">
                  <UploadCloud className="w-6 h-6 text-indigo-400 mx-auto" />
                  <p className="text-xs font-bold text-white">{file ? file.name : 'Clique para escolher um vídeo do computador'}</p>
                  <p className="text-[11px] text-zinc-500">MP4 ou MOV, até 500 MB</p>
                </button>
                <input ref={fileRef} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                <p className="text-[11px] text-zinc-500">Vários vídeos curtos para editar de uma vez? <Link href="/bulk?aba=editor" className="underline hover:text-zinc-300">Abra o editor em massa</Link></p>
              </div>
            )}

            {aba === 'link' && tipo === 'perfil' && (
              <div className="space-y-4">
                <Divisoria />
                <div className="space-y-2">
                  <Rotulo>Quantos vídeos</Rotulo>
                  <Opcoes<number> colunas={4} valor={quantos} mudar={setQuantos} opcoes={QUANTOS} />
                </div>
                <div className="space-y-2">
                  <Rotulo>Ordem</Rotulo>
                  <Opcoes valor={ordem} mudar={setOrdem} opcoes={ORDENS} />
                </div>
                <div className="space-y-2">
                  <Rotulo>Período</Rotulo>
                  <Opcoes<number> colunas={4} valor={periodo} mudar={setPeriodo} opcoes={PERIODOS} />
                </div>
                <Divisoria />
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="text-sm font-semibold text-white block">Automatizar cortes futuros</span>
                    <span className="text-[11px] text-zinc-500">Cada vídeo novo desse perfil vira corte sozinho</span>
                  </span>
                  <LiquidToggle checked={automatizar} onChange={setAutomatizar} />
                </label>
                {automatizar && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Rotulo direita={
                        <select id="criar-intervalo" value={intervalo} onChange={e => setIntervalo(Number(e.target.value))} aria-label="Verificar a cada"
                          className="text-[11px] text-zinc-300 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] outline-none cursor-pointer">
                          {INTERVALOS.map(m => <option key={m} value={m}>Verificar a cada {m / 60}h</option>)}
                        </select>
                      }>O que fazer com os cortes</Rotulo>
                      <Opcoes valor={modo} mudar={setModo} opcoes={MODOS} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(aba === 'file' || tipo === 'video' || tipo === null || (tipo === 'perfil' && automatizar)) && (
              <div className="space-y-2">
                {aba === 'link' && tipo === 'perfil' ? null : <Divisoria />}
                <Rotulo>Duração dos cortes</Rotulo>
                <Opcoes valor={duracao} mudar={setDuracao} opcoes={DURACOES} />
              </div>
            )}

            <BotaoPrincipal icone={tipo === 'perfil' && aba === 'link' ? Search : Scissors} onClick={enviar} carregando={loading} textoCarregando="Iniciando…">
              {textoBotao}
            </BotaoPrincipal>
          </Cartao>

          <p className="text-center text-[11px] text-zinc-600">
            <Link href="/autopilot" className="hover:text-zinc-400">Ver perfis automatizados e cortes para aprovar</Link>
          </p>
        </div>
      )}
    </div>
  )
}

export default function CreateClipsPage() {
  return (
    <Suspense fallback={<div className="flex-1 min-h-screen bg-[#07070a]" />}>
      <Conteudo />
    </Suspense>
  )
}
