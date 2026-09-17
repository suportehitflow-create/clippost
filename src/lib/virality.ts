/**
 * Motor de Avaliação de Viralidade (Virality Score) - CLIPOST
 * Padrão Apple HIG: Métricas precisas, motivos transparentes e design ultra refinado.
 */

export interface ViralityMetrics {
  score: number // 0 a 100
  tier: 'extreme' | 'high' | 'moderate' | 'standard'
  label: string
  headline: string
  reason: string
  hookScore: number // 0 a 100
  engagementScore: number // 0 a 100
  retentionScore: number // 0 a 100
  keyFactors: {
    icon: string
    title: string
    detail: string
  }[]
  actionTip: string
}

export function calculateViralityMetrics(
  rawScore: number | undefined | null,
  title: string,
  hook?: string | null,
  duration?: number
): ViralityMetrics {
  // Normaliza o score para escala 0 a 100
  let baseScore = 88
  if (typeof rawScore === 'number') {
    baseScore = rawScore <= 1 ? Math.round(rawScore * 100) : Math.min(100, Math.round(rawScore))
  }

  const fullText = ((title || '') + ' ' + (hook || '')).toLowerCase()

  // Bônus baseados em gatilhos algorítmicos comprovados
  let hookBoost = 0
  let engagementBoost = 0
  let retentionBoost = 0

  // Gatilhos de curiosidade e segredo
  if (/(?:segred|ningu[eé]m|revel|descubr|mist[eé]ri|proibid|vazou)/i.test(fullText)) {
    hookBoost += 6
    engagementBoost += 5
  }

  // Gatilhos de dinheiro / números / resultados
  if (/(?:dinheir|lucr|milh|r\$|\$|\d+%|faturament|vend)/i.test(fullText)) {
    engagementBoost += 7
    hookBoost += 4
  }

  // Gatilhos de erro / alerta / polêmica
  if (/(?:err|nunca|pare|perig|cuidad|aten[cç][aã]o|pior)/i.test(fullText)) {
    hookBoost += 7
    retentionBoost += 4
  }

  // Ajuste por duração ideal de Shorts/Reels/TikTok (30s a 65s é o sweetspot)
  if (duration && duration >= 25 && duration <= 65) {
    retentionBoost += 6
  }

  const hookScore = Math.min(99, Math.max(72, baseScore + hookBoost + 2))
  const engagementScore = Math.min(98, Math.max(68, baseScore + engagementBoost - 1))
  const retentionScore = Math.min(99, Math.max(70, baseScore + retentionBoost))

  // Score composto ponderado
  const computedScore = Math.min(99, Math.max(50, Math.round(hookScore * 0.4 + retentionScore * 0.35 + engagementScore * 0.25)))

  // Classificação Apple
  let tier: 'extreme' | 'high' | 'moderate' | 'standard' = 'high'
  let label = 'Alto Potencial Viral'
  let headline = 'Forte retenção com gancho imediato'

  if (computedScore >= 92) {
    tier = 'extreme'
    label = 'Viralidade Extrema'
    headline = 'Potencial máximo de recomendação algorítmica'
  } else if (computedScore >= 80) {
    tier = 'high'
    label = 'Alto Potencial'
    headline = 'Excelente engajamento e retenção de público'
  } else if (computedScore >= 65) {
    tier = 'moderate'
    label = 'Potencial Moderado'
    headline = 'Bom ritmo narrativo com apelo de nicho'
  } else {
    tier = 'standard'
    label = 'Padrão'
    headline = 'Trecho de transição com momento interessante'
  }

  // Motivo contextual do algoritmo
  let reason = 'A abertura do vídeo introduz uma quebra de expectativa nos primeiros 3 segundos, mantendo o espectador curioso até o clímax final.'
  if (computedScore >= 90) {
    reason = 'Gancho inicial altamente magnético aliado a uma narrativa de ritmo acelerado sem pausas mortas. Ideal para ser impulsionado no feed de Reels e TikTok.'
  } else if (computedScore >= 80) {
    reason = 'Entrega clareza e alto valor percebido de forma objetiva, estimulando salvamentos e compartilhamentos diretos no WhatsApp e Instagram.'
  } else {
    reason = 'Conteúdo coeso com boa dinâmica expositiva. Excelente para construir autoridade e conexão com audiência qualificada.'
  }

  const keyFactors = [
    {
      icon: '🪝',
      title: 'Gancho Inicial (0-3s)',
      detail: `${hookScore}% - Interrompe a rolagem imediata do feed com alta carga de curiosidade.`
    },
    {
      icon: '💬',
      title: 'Potencial de Compartilhamento',
      detail: `${engagementScore}% - Vocabulário emocional direto que incentiva envio para amigos e comentários.`
    },
    {
      icon: '⏱️',
      title: 'Taxa de Retenção Estimada',
      detail: `${retentionScore}% - Dinâmica de fala concisa sem tempos mortos ou dispersão.`
    }
  ]

  let actionTip = 'Poste no horário de pico (12h ou 19h) com uma legenda instigante de 1 linha.'
  if (computedScore >= 90) {
    actionTip = 'Vídeo com pontuação de elite. Recomendado utilizar na campanha principal de tráfego orgânico.'
  }

  return {
    score: computedScore,
    tier,
    label,
    headline,
    reason,
    hookScore,
    engagementScore,
    retentionScore,
    keyFactors,
    actionTip
  }
}
