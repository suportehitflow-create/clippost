'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Layers,
  Send,
  Trash2,
  Sparkles,
  ExternalLink,
  Film,
  Zap,
  Info,
  ChevronDown,
  Check,
  Play,
  RotateCcw,
  Video
} from 'lucide-react'


type Platform = 'instagram' | 'tiktok' | 'youtube_shorts'
type TrialReelMode = 'disabled' | 'manual' | 'auto'

interface Clip {
  id: string
  title: string
  hook: string
  storage_url: string
  score: number
}

interface SocialAccount {
  platform: Platform
  handle: string
}

interface ScheduledPost {
  id: string
  caption: string
  platform: Platform
  scheduled_at: string
  status: 'scheduled' | 'published' | 'failed'
  trial_reel?: string
  clips?: { title: string; storage_url: string } | null
}

export default function SchedulePageV2() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  
  // Selection states (Screenshot 1)
  const [selectedProfile, setSelectedProfile] = useState<string>('@clippost_oficial')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['instagram'])
  const [publicationType, setPublicationType] = useState<'reels'>('reels')
  const [trialReelMode, setTrialReelMode] = useState<TrialReelMode>('disabled')
  
  // Media selection
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('Confira essa dica incrível sobre criação de conteúdo viral! 🚀 #shorts #reels #corte')
  const [scheduleDateTime, setScheduleDateTime] = useState('')

  const [saving, setSaving] = useState(false)
  const [schedulingAll, setSchedulingAll] = useState(false)
  const [publishingNow, setPublishingNow] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Set default schedule time to tomorrow 18:00
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(18, 0, 0, 0)
    setScheduleDateTime(tomorrow.toISOString().slice(0, 16))

    supabase.auth.getUser()
      .then(({ data }) => {
        if (!data?.user) return
        setUserId(data.user.id)
        loadData(data.user.id).catch(err => console.warn('loadData error:', err))
      })
      .catch(() => {})
  }, [])

  async function loadData(uid: string) {
    // Load generated clips
    const { data: clipsData } = await supabase
      .from('clips')
      .select('id, title, hook, storage_url, score')
      .order('created_at', { ascending: false })
      .limit(10)

    if (clipsData && clipsData.length > 0) {
      setClips(clipsData as Clip[])
      setSelectedClipId(clipsData[0].id)
      setMediaPreviewUrl(clipsData[0].storage_url)
    }

    // Load scheduled posts directly from Supabase (immune to CORS / 502)
    try {
      const { data: postsData } = await supabase
        .from('scheduled_posts')
        .select('id, caption, platform, scheduled_at, status, clips(title, storage_url)')
        .eq('user_id', uid)
        .order('scheduled_at', { ascending: true })

      if (postsData) {
        setPosts(postsData as any)
      }
    } catch (err) {
      console.warn('Erro ao carregar posts agendados:', err)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setSelectedClipId('')
    setMediaPreviewUrl(URL.createObjectURL(file))
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    )
  }

  const handleScheduleSubmit = async (publishImmediately = false) => {
    if (!userId) return
    if (selectedPlatforms.length === 0) {
      setErrorMsg('Selecione ao menos um destino para publicação.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      let finalClipId = selectedClipId

      // If local uploaded file, upload to storage first
      if (uploadedFile) {
        const ext = uploadedFile.name.split('.').pop()
        const path = `uploads/${userId}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('videos').upload(path, uploadedFile)
        if (upErr) throw upErr
        
        const pubUrl = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
        const { data: projData } = await supabase
          .from('projects')
          .insert({ user_id: userId, title: uploadedFile.name, source_type: 'file', status: 'done' })
          .select('id')
          .single()

        const { data: newClip, error: clipErr } = await supabase
          .from('clips')
          .insert({
            user_id: userId,
            project_id: projData?.id,
            title: uploadedFile.name,
            storage_url: pubUrl,
            start_time: 0,
            end_time: 0,
            score: 95,
            status: 'ready'
          })
          .select()
          .single()

        if (clipErr) throw clipErr
        finalClipId = newClip.id
      }

      // Schedule for each selected platform
      // Schedule for each selected platform directly in Supabase
      for (const plat of selectedPlatforms) {
        await supabase.from('scheduled_posts').insert({
          user_id: userId,
          clip_id: finalClipId,
          platform: plat,
          caption,
          scheduled_at: publishImmediately ? new Date().toISOString() : new Date(scheduleDateTime).toISOString(),
          status: 'scheduled'
        })
      }

      setSuccessMsg(publishImmediately ? 'Post enviado para publicação imediata!' : 'Post agendado com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      loadData(userId)
    } catch (err: any) {
      setErrorMsg('Falha ao agendar: ' + err.message)
    } finally {
      setSaving(false)
      setPublishingNow(false)
    }
  }


  const handleScheduleAll = async () => {
    if (!userId || clips.length === 0) {
      setErrorMsg('Nenhum clipe disponível para agendar.')
      return
    }
    if (selectedPlatforms.length === 0) {
      setErrorMsg('Selecione ao menos um destino.')
      return
    }
    setSchedulingAll(true)
    setErrorMsg('')
    let count = 0
    for (const clip of clips) {
      for (const plat of selectedPlatforms) {
        try {
          await supabase.from('scheduled_posts').insert({
            user_id: userId,
            clip_id: clip.id,
            platform: plat,
            caption: caption || clip.title || clip.hook || '',
            scheduled_at: new Date(scheduleDateTime).toISOString(),
            status: 'scheduled',
          })
          count++
        } catch {}
      }
    }
    setSchedulingAll(false)
    setSuccessMsg(`${count} posts agendados com sucesso!`)
    setTimeout(() => setSuccessMsg(''), 4000)
    loadData(userId)
  }
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-6 lg:p-10 font-sans">
      
      {/* Top Title & Subtitle (Screenshot 1) */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
          Programar Posts
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure profile, destinos, mídia e agenda com clareza
        </p>
      </div>

      {/* Purple Warning Banner (Screenshot 1) */}
      <div className="max-w-7xl mx-auto mb-6 p-4 rounded-2xl bg-[#1e1035] border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">Assinatura ativa</span>
            <span className="text-[11px] text-purple-300">Você tem agendamentos automáticos e ilimitados liberados para todos os seus perfis.</span>
          </div>
        </div>
        <Link
          href="/billing"
          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-all text-center self-start sm:self-auto cursor-pointer"
        >
          Ver planos
        </Link>
      </div>

      {/* Main Grid: Left Steps (7 cols) + Right Summary & Preview (5 cols) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: 4 Configuration Steps (Screenshot 1) */}
        <div className="lg:col-span-7 space-y-6">

          {/* STEP 1: PROFILE */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                1
              </span>
              <h3 className="text-sm font-semibold text-white">Profile</h3>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  CP
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">{selectedProfile}</span>
                  <span className="text-[11px] text-zinc-400">Instagram Professional Connected</span>
                </div>
              </div>
              <span className="text-[11px] text-purple-400 font-medium hover:underline cursor-pointer">
                Trocar Perfil →
              </span>
            </div>
          </div>

          {/* STEP 2: ONDE PUBLICAR */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                2
              </span>
              <h3 className="text-sm font-semibold text-white">Onde publicar</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'instagram' as Platform, name: 'Instagram', sub: 'Reels' },
                { id: 'tiktok' as Platform, name: 'TikTok', sub: 'Vídeos' },
                { id: 'youtube_shorts' as Platform, name: 'YouTube', sub: 'Shorts' }
              ].map(dest => {
                const isSelected = selectedPlatforms.includes(dest.id)
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => togglePlatform(dest.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/10 border-purple-500 text-white ring-1 ring-purple-500/30'
                        : 'bg-black/40 border-white/[0.06] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{dest.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <span className="text-[10px] text-zinc-500 block">{dest.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 3: TIPO DE PUBLICAÇÃO */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                3
              </span>
              <h3 className="text-sm font-semibold text-white">Tipo de Publicação</h3>
            </div>

            <div className="p-4 rounded-xl border-2 border-purple-500 bg-purple-500/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Reels</span>
                  <span className="text-[10px] text-zinc-400">Vídeos verticais 9:16 de alta retenção</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                Padrão Viral
              </span>
            </div>
          </div>

          {/* SPECIAL CARD: MODO TRIAL REEL (REELS DE TESTE) (Screenshot 1) */}
          <div className="bg-[#15101f] border border-purple-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🚀</span>
              <h3 className="text-sm font-bold text-white">Modo Trial Reel (Reels de Teste)</h3>
            </div>

            <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
              Trial Reels são compartilhados inicialmente <strong className="text-white">apenas com não-seguidores</strong>. Após graduação de retenção pelo algoritmo do Instagram, ficam visíveis para todos.
            </p>

            {/* Warning requirement box */}
            <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] mb-4 text-[11px] text-zinc-300 leading-snug">
              <strong className="text-white">Atenção:</strong> Trial Reels só funcionam para contas com <strong className="text-purple-300">1k de seguidores</strong>. Se sua conta tiver menos de 1k, o post será publicado normalmente sem os parâmetros de teste.
            </div>

            {/* 3 Mode Switchers (Screenshot 1) */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {[
                { id: 'disabled' as TrialReelMode, label: 'Desativado' },
                { id: 'manual' as TrialReelMode, label: 'Manual (via App)' },
                { id: 'auto' as TrialReelMode, label: 'Automática (Performance)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrialReelMode(opt.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    trialReelMode === opt.id
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                      : 'bg-black/50 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-zinc-400/90 flex items-center gap-1 font-mono">
              ⚠️ Limite: 10 Reels de teste por dia por perfil conectado (Apenas Instagram).
            </span>
          </div>

          {/* STEP 4: UPLOAD OU SELEÇÃO DE CLIPE (Screenshot 1) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                4
              </span>
              <h3 className="text-sm font-semibold text-white">Upload & Conteúdo</h3>
            </div>

            {/* Drag and Drop Zone (Screenshot 1) */}
            <label className="relative border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/30 hover:bg-black/50">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-zinc-500 mb-2" />
              <span className="text-xs font-semibold text-white">
                {uploadedFile ? uploadedFile.name : 'Arraste vídeos ou clique para selecionar'}
              </span>
              <span className="text-[11px] text-zinc-500 mt-1">
                Formatos aceitos: MP4, MOV, WebM
              </span>
              <span className="text-[10px] text-purple-400 font-mono mt-2">
                📍 Máximo de 150 mídias por agendamento. Para mais, faça outro lote.
              </span>
              <span className="text-[10px] text-zinc-400 font-mono mt-1">
                ⚠️ Somente vídeos 1080x1920 (9:16 vertical) são aceitos — padrão Instagram Reels
              </span>
            </label>

            {/* Ou selecione dos seus clipes cortados pela IA */}
            {clips.length > 0 && (
              <div>
                <span className="text-xs font-medium text-zinc-400 block mb-2">
                  Ou selecione um clipe gerado pela IA:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {clips.map(c => {
                    const isSelected = selectedClipId === c.id
                        return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedClipId(c.id)
                          setUploadedFile(null)
                          setMediaPreviewUrl(c.storage_url)
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-black/40 border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-medium line-clamp-1 block">{c.title}</span>
                        <span className="text-[10px] text-purple-400 font-mono">Score: {c.score}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Caption & Schedule Time Inputs */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Legenda da Publicação</label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Data e Horário de Disparo</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={e => setScheduleDateTime(e.target.value)}
                  className="w-full p-2.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Resumo do Post, Preview & Dicas (Screenshot 1) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Resumo do Post Box (Screenshot 1) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-white">Resumo do Post</h3>

            <div className="space-y-2 text-xs divide-y divide-white/[0.05]">
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Profile</span>
                <span className="font-mono text-white">{selectedProfile}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Destinos</span>
                <span className="font-semibold text-purple-400">
                  {selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : '0 selecionados'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Tipo</span>
                <span className="font-mono text-white uppercase">Reels</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Modo Trial Reel</span>
                <span className="font-mono text-purple-300 uppercase">{trialReelMode}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Mídias</span>
                <span className="text-white">1 vídeo 9:16</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">
                {successMsg}
              </div>
            )}

            {/* Action Buttons (Screenshot 1) */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleScheduleSubmit(false)}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                {saving ? 'Agendando...' : '🚀 Agendar Post'}
              </button>

              <button
                type="button"
                onClick={() => handleScheduleSubmit(true)}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                ⚡ Publicar Agora
              </button>

              {clips.length > 1 && (
                <button
                  type="button"
                  onClick={handleScheduleAll}
                  disabled={schedulingAll || saving}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {schedulingAll ? 'Agendando todos...' : `📅 Agendar todos (${clips.length} clipes)`}
                </button>
              )}
            </div>
          </div>

          {/* Preview da Mídia (Screenshot 1) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white">Preview da Mídia</span>
              <span className="text-[10px] text-zinc-500 font-mono">1 vídeo</span>
            </div>

            <div className="relative aspect-[9/16] w-full max-w-[240px] mx-auto rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl">
              {mediaPreviewUrl ? (
                <video
                  src={mediaPreviewUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <span className="text-xs text-zinc-400 block font-medium">Faça upload de mídia</span>
                  <span className="text-[10px] text-zinc-600 block mt-0.5">Arraste ou clique no card de upload</span>
                </div>
              )}
            </div>
          </div>

          {/* Dicas Card (Screenshot 1) */}
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-5 shadow-sm text-xs text-zinc-400 space-y-2">
            <span className="font-semibold text-white block">💡 Dicas</span>
            <ul className="space-y-1 text-[11px] list-disc list-inside">
              <li>Selecione ao menos 1 destino</li>
              <li>Faça upload antes de agendar</li>
              <li>Vídeo vertical recomendado para Reels</li>
              <li>O Modo Trial Reel potencializa o alcance inicial</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tabela de Posts Agendados */}
      {posts.length > 0 && (
        <div className="max-w-7xl mx-auto mt-10 bg-[#121214] border border-white/[0.08] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Histórico de Agendamentos</h3>
          <div className="divide-y divide-white/[0.05]">
            {posts.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-white font-medium block">{p.caption || 'Sem legenda'}</span>
                  <span className="text-zinc-500 font-mono text-[10px]">
                    {p.platform} · {new Date(p.scheduled_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-mono uppercase">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
