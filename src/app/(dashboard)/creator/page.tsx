'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Flame,
  Copy,
  Check,
  Scissors,
  Clock,
  Volume2,
  Video,
  Wand2
} from 'lucide-react'

interface Scene {
  time: string
  label: string
  spoken_text: string
  b_roll: string
  sound_fx: string
  duration: number
}

interface ScriptResult {
  topic: string
  title: string
  hook: string
  tone: string
  total_duration_secs: number
  total_words: number
  estimated_retention_score: number
  scenes: Scene[]
}

const TEMPLATES = [
  {
    id: 'hormozi',
    name: 'Fórmula $100M (Hormozi)',
    badge: 'Mais Compartilhado',
    category: 'Negócios & Hacks',
    desc: 'Afirmação contra-intuitiva brutal, desmontagem de mitos populares e framework de 3 passos rápidos.',
  },
  {
    id: 'storytelling',
    name: 'Storytelling Emocional',
    badge: 'Maior Retenção',
    category: 'Narrativa',
    desc: 'Abertura com cena vívida, conflito crescente, virada surpreendente e lição memorável.',
  },
  {
    id: 'news_tech',
    name: 'Análise Tech & Notícias Quentes',
    badge: 'Autoridade Rápida',
    category: 'Tecnologia & IA',
    desc: 'Notícia bomba explicada em 1 minuto: o que aconteceu, o que ninguém notou e o que muda pra você.',
  },
  {
    id: 'tutorial_express',
    name: 'Tutorial Prático Express',
    badge: 'Mais Salvo',
    category: 'Educacional',
    desc: 'Promessa clara nos primeiros 3 segundos, passo 1, 2 e 3 na tela com dica bônus no final.',
  },
  {
    id: 'infinite_loop',
    name: 'Short com Loop Infinito',
    badge: 'Algoritmo Favorito',
    category: 'Shorts & Reels',
    desc: 'A última frase se conecta perfeitamente com a primeira palavra, incentivando replays imediatos.',
  },
]

export default function CreatorPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState('hormozi')
  const [topic, setTopic] = useState('Como usar agentes de IA para criar conteúdo automático sem gastar nada')
  const [targetAudience, setTargetAudience] = useState('Criadores de conteúdo e empreendedores digitais')
  const [tone, setTone] = useState('Direto, enérgico e provocador')
  const [durationSecs, setDurationSecs] = useState(45)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const [script, setScript] = useState<ScriptResult>({
    topic: 'Como usar agentes de IA para criar conteúdo automático sem gastar nada',
    title: 'Roteiro Viral: Conteúdo com IA Sem Gastar Nada',
    hook: 'Pare de perder 5 horas por dia editando vídeo. Você está jogando dinheiro na lata do lixo.',
    tone: 'Direto, enérgico e provocador',
    total_duration_secs: 45,
    total_words: 98,
    estimated_retention_score: 97,
    scenes: [
      {
        time: '00:00 - 00:03',
        label: 'Gancho Visual & Quebra de Padrão',
        spoken_text: 'Pare de perder 5 horas por dia editando vídeo. Você está jogando dinheiro na lata do lixo.',
        b_roll: 'Close-up dramático apontando para a câmera com legenda amarela estilo Hormozi pulsando.',
        sound_fx: 'Impacto seco de grave (Sub-Bass Thud).',
        duration: 3,
      },
      {
        time: '00:04 - 00:15',
        label: 'Desconstrução do Mito',
        spoken_text: '90% dos criadores acham que precisam de Premiere, After Effects e uma agência inteira. Em 2026, três ferramentas open-source no GitHub fazem tudo sozinhas.',
        b_roll: 'Zoom rápido (punch zoom) cortando para gravação de tela com terminal rodando em alta velocidade.',
        sound_fx: 'Whoosh rápido de transição.',
        duration: 11,
      },
      {
        time: '00:16 - 00:32',
        label: 'O Framework de 3 Passos',
        spoken_text: 'Passo 1: Encontre o vídeo com mais retenção no YouTube. Passo 2: O Clippost corta os momentos virais e queima legendas com safe zone. Passo 3: O Autopilot agenda direto nas suas redes.',
        b_roll: 'Badges numeradas "1", "2" e "3" aparecendo na tela com caixas translúcidas.',
        sound_fx: 'Ding agudo no passo 1, clique de mouse no passo 2, sino de caixa no passo 3.',
        duration: 16,
      },
      {
        time: '00:33 - 00:45',
        label: 'Chamada para Ação com Urgência',
        spoken_text: 'Salve esse vídeo agora para não perder o passo a passo e comente "CORTE" que eu te mando o link de acesso.',
        b_roll: 'Apontando para a barra lateral com ícone de salvar e comentários destacados.',
        sound_fx: 'Notificação do iPhone (Pizzicato / Chime).',
        duration: 12,
      },
    ],
  })

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/creator/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          template_id: selectedTemplate,
          tone,
          duration_secs: durationSecs,
          target_audience: targetAudience,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setScript(data)
      } else {
        throw new Error('Erro no servidor')
      }
    } catch {
      // fallback local rápido
      const hook = `Se você fizer isso sobre ${topic} da forma tradicional, você vai falhar.`
      setScript({
        topic,
        title: `Roteiro Viral: ${topic}`,
        hook,
        tone,
        total_duration_secs: durationSecs,
        total_words: Math.round(durationSecs * 2.2),
        estimated_retention_score: 96,
        scenes: [
          { time: '00:00 - 00:03', label: 'Gancho', spoken_text: hook, b_roll: 'Zoom in dramático.', sound_fx: 'Impacto grave.', duration: 3 },
          { time: '00:04 - 00:18', label: 'O Problema', spoken_text: `A maioria falha com ${topic} por um motivo simples: insiste no método errado.`, b_roll: 'Pessoa frustrada no monitor.', sound_fx: 'Trilha com batida contínua.', duration: 14 },
          { time: '00:19 - 00:35', label: 'A Solução', spoken_text: 'Passo 1: identifique o gargalo. Passo 2: automatize. Passo 3: distribua com consistência diária.', b_roll: 'Ícones dos 3 passos.', sound_fx: 'Pop de confirmação.', duration: 16 },
          { time: '00:36 - 00:45', label: 'Chamada', spoken_text: 'Salve esse vídeo e aplique hoje.', b_roll: 'Botão de salvar animado.', sound_fx: 'Sino final.', duration: 9 },
        ],
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    const formatted = `${script.title}\n\n[GANCHO - 0-3s]\n${script.hook}\n\n` +
      script.scenes.map(s => `[${s.time}] (${s.label})\nFALAR: "${s.spoken_text}"\nVISUAL: ${s.b_roll}\nSFX: ${s.sound_fx}\n`).join('\n')
    navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToClipper = () => {
    router.push(`/upload?prompt=${encodeURIComponent(script.topic)}`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              OpenCreator Scripting Engine
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-medium">
              Fórmulas de Retenção Ativas
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Estúdio de Roteiros & Ganchos Virais
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Crie roteiros milimetricamente calculados para vídeos curtos (Reels, TikTok e Shorts) com ganchos de 3 segundos e marcações exatas de narração, B-roll e som.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-indigo-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Roteiro Copiado!' : 'Copiar Roteiro'}</span>
          </button>
          <button
            onClick={handleSendToClipper}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-semibold text-white flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Transformar em Vídeo</span>
          </button>
        </div>
      </div>

      {/* Grid Principal: Configuração à Esquerda, Roteiro à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna de Configuração */}
        <div className="lg:col-span-5 space-y-6">
          {/* Seletor de Templates Virais */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              1. Escolha a Estrutura / Fórmula
            </label>
            <div className="space-y-2">
              {TEMPLATES.map(t => {
                const active = selectedTemplate === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      active
                        ? 'bg-indigo-600/15 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                        : 'bg-[#121216] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold ${active ? 'text-white' : 'text-zinc-200'}`}>
                        {t.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-zinc-400">
                        {t.badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Input do Tema */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              2. Tema ou Assunto do Vídeo
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Como economizar 30 horas por mês automatizando seus relatórios..."
              className="w-full p-3.5 rounded-2xl bg-[#121216] border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Público & Tom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 block">Público-Alvo</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#121216] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 block">Tom de Voz</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#121216] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 block">Duração Alvo</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { s: 30, label: '30 seg', sub: 'Micro-Short' },
                { s: 45, label: '45 seg', sub: 'Equilibrado' },
                { s: 60, label: '60 seg', sub: 'Completo' },
              ].map(d => (
                <button
                  key={d.s}
                  type="button"
                  onClick={() => setDurationSecs(d.s)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    durationSecs === d.s
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-[#121216] text-zinc-400 border-white/[0.06] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold block">{d.label}</span>
                  <span className="text-[10px] text-zinc-500 block">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Botão Gerar */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Calculando Roteiro com IA...' : 'Gerar Roteiro Otimizado'}</span>
          </button>
        </div>

        {/* Coluna do Roteiro Gerado */}
        <div className="lg:col-span-7 space-y-5">
          {/* Header do Roteiro */}
          <div className="p-5 rounded-2xl bg-[#121216] border border-white/[0.08] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Visualização do Roteiro</span>
                <h2 className="text-base font-bold text-white">{script.title}</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
                  {script.estimated_retention_score}% Retenção Prevista
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-xs font-mono">
                  ~{script.total_duration_secs}s ({script.total_words} palavras)
                </div>
              </div>
            </div>

            {/* Hook Box de Alta Atenção */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-black border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 fill-zinc-400 text-zinc-400" />
                  Gancho Crítico de 3 Segundos (00:00 - 00:03)
                </span>
                <span className="text-[10px] text-zinc-400">Taxa de Parada &gt; 80%</span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-white leading-snug">
                "{script.hook}"
              </p>
            </div>
          </div>

          {/* Cenas Estruturadas */}
          <div className="space-y-3">
            {script.scenes.map((scene, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#121216] border border-white/[0.06] hover:border-white/[0.12] transition-colors space-y-3"
              >
                {/* Cabeçalho da Cena */}
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold font-mono flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">{scene.label}</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {scene.time}
                  </span>
                </div>

                {/* Texto da Narração */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold block">
                    O que falar (Voz):
                  </span>
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium bg-black/30 p-2.5 rounded-xl border border-white/[0.04]">
                    "{scene.spoken_text}"
                  </p>
                </div>

                {/* Dicas de Visual & Som */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-2">
                    <Video className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-500 font-bold block">Visual sugerido:</span>
                      <span className="text-zinc-300">{scene.b_roll}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-500 font-bold block">Efeito sonoro (SFX):</span>
                      <span className="text-zinc-300">{scene.sound_fx}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
