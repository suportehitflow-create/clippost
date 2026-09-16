'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Layers,
  Upload,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  Zap,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Play,
  Check,
  Film,
  Sliders,
  FileVideo,
  Smartphone,
  Copy,
  ExternalLink,
  X
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

interface BatchItem {
  id: string
  file?: File
  url?: string
  name: string
  size?: number
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed'
  progress: number
  projectId?: string
  clips?: any[]
  error?: string
}

const TEMPLATE_PRESETS = [
  {
    id: 'hormozi_yellow',
    name: 'Hormozi Viral',
    tag: 'Mais Viral',
    color: '#FACC15',
    desc: 'Caixa alta, amarelo neon e contorno grosso para máxima retenção.'
  },
  {
    id: 'minimal_apple',
    name: 'Apple Minimal',
    tag: 'Elegante',
    color: '#E4E4E7',
    desc: 'Design limpo, tipografia nítida e acabamento refinado.'
  },
  {
    id: 'neon_glow',
    name: 'Neon Glow',
    tag: 'Gamer / Tech',
    color: '#06B6D4',
    desc: 'Efeito fluorescente ciano iluminado.'
  },
  {
    id: 'clean_box',
    name: 'Clean Box',
    tag: 'Corporativo',
    color: '#FFFFFF',
    desc: 'Legenda dentro de caixa translúcida de alto contraste.'
  }
]

export default function BulkStudioPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [mode, setMode] = useState<'files' | 'urls'>('files')
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('hormozi_yellow')
  const [clipDuration, setClipDuration] = useState<'auto' | '30' | '60'>('auto')
  const [showMobileQr, setShowMobileQr] = useState(false)
  const [copiedBulkUrl, setCopiedBulkUrl] = useState(false)
  // Opcoes Anti-Algoritmo (Reels / TikTok)
  const [speedBoost, setSpeedBoost] = useState(true)
  const [horizontalFlip, setHorizontalFlip] = useState(false)
  const [removeSilence, setRemoveSilence] = useState(true)
  const [colorEnhance, setColorEnhance] = useState(true)
  const [hypitBRoll, setHypitBRoll] = useState(true)
  const [hypitZoomPunch, setHypitZoomPunch] = useState(true)
  const [hypitMultiVariants, setHypitMultiVariants] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeStep, setActiveStep] = useState<'setup' | 'running' | 'results'>('setup')
  const [statusMessage, setStatusMessage] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  // Handle multiple files selected
  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newItems: BatchItem[] = Array.from(files).map((f, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
      progress: 0
    }))

    setBatchItems(prev => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle URLs pasted (one per line)
  const handleAddUrls = () => {
    const lines = urlInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && (l.startsWith('http://') || l.startsWith('https://')))

    if (lines.length === 0) return

    const newItems: BatchItem[] = lines.map((u, idx) => ({
      id: `batch-url-${Date.now()}-${idx}`,
      url: u,
      name: u,
      status: 'pending',
      progress: 0
    }))

    setBatchItems(prev => [...prev, ...newItems])
    setUrlInput('')
  }

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id))
  }

  // Execute Batch Processing
  const startBatchProcessing = async () => {
    if (!userId || batchItems.length === 0) return

    setIsProcessing(true)
    setActiveStep('running')
    setStatusMessage('Iniciando fila de processamento em massa...')

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i]
      
      // Update item to uploading / processing
      setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'uploading', progress: 20 } : it))

      try {
        let sourceUrl = item.url

        // 1. Create project in Supabase
        const { data: project, error: pErr } = await supabase
          .from('projects')
          .insert({
            user_id: userId,
            title: item.name.replace(/\.[^/.]+$/, ''),
            source_url: item.url || null,
            source_type: item.file ? 'file' : 'url',
            status: 'pending'
          })
          .select()
          .single()

        if (pErr || !project) throw new Error(pErr?.message || 'Falha ao criar projeto')

        // 2. Upload file if local
        if (item.file) {
          const ext = item.file.name.split('.').pop()
          const storagePath = `${userId}/${project.id}/original.${ext}`
          const { error: upErr } = await supabase.storage
            .from('videos')
            .upload(storagePath, item.file)

          if (upErr) throw upErr
          sourceUrl = supabase.storage.from('videos').getPublicUrl(storagePath).data.publicUrl
        }

        setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing', projectId: project.id, progress: 60 } : it))

        // 3. Dispatch to backend Celery worker
        await fetch(`${API}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: sourceUrl,
            user_id: userId,
            clip_duration: clipDuration,
            project_id: project.id,
            template_id: selectedTemplate
          })
        })

        // Mark item as queued/processing
        setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'done', progress: 100 } : it))
      } catch (err: any) {
        console.error('Erro no item do lote:', err)
        setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'failed', error: err.message } : it))
      }
    }

    setIsProcessing(false)
    setActiveStep('results')
    setStatusMessage('Todos os vídeos do lote foram enfileirados com sucesso!')
  }

  const completedCount = batchItems.filter(i => i.status === 'done').length
  const totalCount = batchItems.length

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Batch Studio
            </span>
            <span className="text-xs text-zinc-500">• Esteira de Produção em Escala</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Edição em Massa de Vídeos
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Processe até 30 vídeos de uma só vez. Aplique um template com legenda e identidade visual automaticamente em todos eles em segundo plano.
          </p>
        </div>

        {batchItems.length > 0 && activeStep === 'setup' && (
          <button
            onClick={startBatchProcessing}
            disabled={isProcessing}
            className="px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            Processar Lote ({batchItems.length} Vídeo{batchItems.length !== 1 ? 's' : ''})
          </button>
        )}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Batch Setup & Queue */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* STEP 1: UPLOAD OR URL SELECTION */}
          {activeStep === 'setup' && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                  <Film className="w-4 h-4" /> 1. Adicionar Vídeos ao Lote
                </h2>
                <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => setMode('files')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      mode === 'files' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Arquivos
                  </button>
                  <button
                    onClick={() => setMode('urls')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      mode === 'urls' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Links
                  </button>
                </div>
              </div>

              {mode === 'files' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-orange-500/50 bg-white/[0.01] hover:bg-white/[0.03] rounded-2xl p-8 text-center cursor-pointer transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/*"
                    hidden
                    onChange={handleFilesAdded}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Arraste vários vídeos ou clique para selecionar
                  </p>
                  <p className="text-xs text-zinc-500">
                    MP4, MOV, MKV, AVI — Suporte a até 30 arquivos de uma vez
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Cole os links dos vídeos aqui (um por linha)&#10;https://youtube.com/watch?v=...&#10;https://instagram.com/reel/...&#10;https://tiktok.com/@user/video/..."
                    rows={4}
                    className="w-full px-4 py-3 bg-black/40 border border-white/[0.08] focus:border-orange-500/50 rounded-xl text-xs font-mono text-white placeholder-zinc-600 outline-none"
                  />
                  <button
                    onClick={handleAddUrls}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2 text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white rounded-xl transition-all disabled:opacity-40"
                  >
                    Adicionar Links à Fila
                  </button>
                </div>
              )}
            </div>
          )}

          {/* QUEUE LIST */}
          {batchItems.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Fila do Lote ({batchItems.length} Iten{batchItems.length !== 1 ? 's' : ''})
                </span>
                {activeStep === 'setup' && (
                  <button
                    onClick={() => setBatchItems([])}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Limpar Todos
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {batchItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-zinc-400 flex-shrink-0">
                        {item.file ? <FileVideo className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">{item.name}</p>
                        {item.size && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {(item.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase ${
                          item.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'processing' || item.status === 'uploading'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            : item.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {item.status === 'done' ? 'Pronto' : item.status === 'uploading' ? 'Upload...' : item.status === 'processing' ? 'Render...' : item.status === 'failed' ? 'Erro' : 'Na fila'}
                      </span>

                      {activeStep === 'setup' && (
                        <button
                          onClick={() => removeBatchItem(item.id)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE PROGRESS BAR */}
          {activeStep === 'running' && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-white font-semibold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  Processando Lote em Segundo Plano...
                </span>
                <span className="font-mono text-orange-400">
                  {completedCount} de {totalCount} concluído(s)
                </span>
              </div>

              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full transition-all duration-300"
                  style={{ width: `${(completedCount / Math.max(1, totalCount)) * 100}%` }}
                />
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Você pode deixar esta página aberta ou navegar pelo painel. Os cortes estarão disponíveis no seu Dashboard assim que o Celery finalizar cada arquivo.
              </p>
            </div>
          )}

          {/* RESULTS STATE */}
          {activeStep === 'results' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-md text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">
                Lote Enfileirado com Sucesso!
              </h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto mb-6">
                Todos os {totalCount} vídeos foram enviados para o pipeline da IA. Eles estão sendo cortados, legendados e formatados em 9:16.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-all shadow-md shadow-orange-500/20"
                >
                  Ver no Dashboard
                </Link>
                <Link
                  href="/schedule"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                >
                  🚀 Agendar com Modo Trial Reel
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Template & Batch Options */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* TEMPLATE PICKER */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 2. Template do Lote
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              O estilo visual de legenda e enquadramento aplicado a todos os vídeos.
            </p>

            <div className="space-y-2.5">
              {TEMPLATE_PRESETS.map((t) => {
                const isSelected = selectedTemplate === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-500/50 shadow-sm ring-1 ring-orange-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                        {t.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{t.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* DURATION PREFERENCE */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> 3. Duração dos Clipes
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Tempo aproximado de cada corte viral gerado.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(['auto', '30', '60'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setClipDuration(d)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    clipDuration === d
                      ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/20'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                  }`}
                >
                  {d === 'auto' ? 'IA Auto' : `${d}s`}
                </button>
              ))}
            </div>
          </div>

          {/* HYPIT VIRAL ENGINE (Clonagem & B-Rolls Ancorados a Palavras) */}
          <div className="bg-gradient-to-b from-purple-950/20 to-black/40 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Hypit Viral Engine
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                100M Views Tech
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Tecnologia inspirada no Hypit: elementos visuais ancorados a palavras, b-rolls dinâmicos e testes A/B.
            </p>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <span className="text-zinc-200 font-medium block">🎬 Inserção Automática de B-Rolls</span>
                  <span className="text-[10px] text-zinc-500">Insere cortes visuais sobre palavras-chave de alto impacto</span>
                </div>
                <input
                  type="checkbox"
                  checked={hypitBRoll}
                  onChange={(e) => setHypitBRoll(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <span className="text-zinc-200 font-medium block">🔍 Zoom Punch Dinâmico (1.15x)</span>
                  <span className="text-[10px] text-zinc-500">Corte rápido para close nos ganchos de maior retenção</span>
                </div>
                <input
                  type="checkbox"
                  checked={hypitZoomPunch}
                  onChange={(e) => setHypitZoomPunch(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <span className="text-zinc-200 font-medium block">🧬 Gerar 3 Variantes de Gancho (Teste A/B)</span>
                  <span className="text-[10px] text-zinc-500">Cria 3 versões com começos diferentes para testar no Reels</span>
                </div>
                <input
                  type="checkbox"
                  checked={hypitMultiVariants}
                  onChange={(e) => setHypitMultiVariants(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 4. BLINDAGEM ANTI-ALGORITMO */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> 4. Blindagem Anti-Algoritmo
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300">
                Instagram & TikTok
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Micro-alterações para que os vídeos sejam reconhecidos como originais sem perder qualidade.
            </p>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/[0.06] cursor-pointer hover:border-white/10 transition-colors">
                <span className="text-zinc-200">⚡ Micro-Aceleração (1.05x sem alterar tom)</span>
                <input
                  type="checkbox"
                  checked={speedBoost}
                  onChange={(e) => setSpeedBoost(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/[0.06] cursor-pointer hover:border-white/10 transition-colors">
                <span className="text-zinc-200">🪞 Espelhamento Horizontal (Flip)</span>
                <input
                  type="checkbox"
                  checked={horizontalFlip}
                  onChange={(e) => setHorizontalFlip(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/[0.06] cursor-pointer hover:border-white/10 transition-colors">
                <span className="text-zinc-200">✂️ Corte Inteligente de Silêncios</span>
                <input
                  type="checkbox"
                  checked={removeSilence}
                  onChange={(e) => setRemoveSilence(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/[0.06] cursor-pointer hover:border-white/10 transition-colors">
                <span className="text-zinc-200">🎨 Realce Sutil de Cores (+5%)</span>
                <input
                  type="checkbox"
                  checked={colorEnhance}
                  onChange={(e) => setColorEnhance(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: TRANSFERÊNCIA PARA CELULAR EM LOTE (ESTILO LOCALSEND) */}
      {showMobileQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <button
              onClick={() => setShowMobileQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Transferência para Celular</h3>
              <p className="text-xs text-zinc-400 mt-1">Lote de {totalCount} cortes prontos para Reels / TikTok</p>
            </div>

            {/* QR CODE BOX */}
            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/dashboard' : 'https://clippost-three.vercel.app/dashboard')}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed px-2">
              Aponte a câmera do seu <strong>iPhone ou Android</strong> para abrir a galeria e salvar direto no rolo da câmera sem cabo!
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.origin + '/dashboard')
                    setCopiedBulkUrl(true)
                    setTimeout(() => setCopiedBulkUrl(false), 2000)
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedBulkUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedBulkUrl ? 'Copiado!' : 'Copiar Link'}
              </button>
              <a
                href="/dashboard"
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Acessar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
