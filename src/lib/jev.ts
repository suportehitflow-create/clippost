/**
 * Jev System One Model Integration - TypeSafe AI / Vercel AI Gateway
 * Modelo ultra-rápido (70-200ms) de decisão estruturada e scoring de retenção.
 */

export interface JevEvaluationResult {
  hookStrength: 'viral' | 'moderate' | 'weak'
  viralityScore: number // 0 - 100
  recommendedPlatform: 'reels' | 'tiktok' | 'youtube_shorts'
  isHighRetention: boolean
  latencyMs: number
  source: 'jev-systemone' | 'jev-fast-fallback'
}

export async function evaluateWithJev(params: {
  title: string
  hook?: string | null
  transcriptSnippet?: string
  duration?: number
}): Promise<JevEvaluationResult> {
  const startTime = Date.now()
  const apiKey = process.env.TYPESAFE_API_KEY || process.env.VERCEL_AI_GATEWAY_TOKEN || process.env.OPENROUTER_API_KEY
  const stateText = `Título: ${params.title || ''}\nGancho: ${params.hook || ''}\nTrecho: ${params.transcriptSnippet || ''}\nDuração: ${params.duration || 30}s`

  if (apiKey) {
    try {
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: stateText,
          questions: {
            hook_strength: {
              type: 'choice',
              instructions: 'Quão forte é o gancho inicial para retenção em vídeos curtos?',
              criteria: {
                viral: 'Gera curiosidade imediata, choque ou quebra de padrão',
                moderate: 'Interessante mas previsível',
                weak: 'Lento, prolixo ou monótono'
              }
            },
            virality_score: {
              type: 'score',
              instructions: 'Pontuação de 0 a 100 do potencial viral'
            },
            recommended_platform: {
              type: 'choice',
              instructions: 'Melhor plataforma para distribuição deste conteúdo',
              criteria: {
                reels: 'Instagram Reels - foco em estética e autoridade',
                tiktok: 'TikTok - foco em dinâmica e tendência rápida',
                youtube_shorts: 'YouTube Shorts - foco em valor e tutoriais'
              }
            },
            is_high_retention: {
              type: 'boolean',
              instructions: 'O gancho segura o espectador nos primeiros 3 segundos?'
            }
          }
        }),
        signal: AbortSignal.timeout(2500)
      })

      if (response.ok) {
        const data = await response.json()
        const answers = data.answers || {}
        return {
          hookStrength: answers.hook_strength || 'viral',
          viralityScore: typeof answers.virality_score === 'number' ? Math.round(answers.virality_score) : 88,
          recommendedPlatform: answers.recommended_platform || 'reels',
          isHighRetention: answers.is_high_retention ?? true,
          latencyMs: Date.now() - startTime,
          source: 'jev-systemone'
        }
      }
    } catch {}
  }

  // Fallback rápido baseado nas mesmas diretrizes estruturadas do Jev
  const text = (params.title + ' ' + (params.hook || '')).toLowerCase()
  let score = 84

  if (/(?:segred|ningu[eé]m|revel|descubr|mist[eé]ri|proibid|vazou|dinheir|lucr|fatur|err|nunca)/i.test(text)) {
    score += 10
  }
  if (params.duration && params.duration >= 25 && params.duration <= 60) {
    score += 4
  }

  const clampedScore = Math.min(99, Math.max(65, score))
  const hookStrength: 'viral' | 'moderate' | 'weak' = clampedScore >= 90 ? 'viral' : clampedScore >= 78 ? 'moderate' : 'weak'

  return {
    hookStrength,
    viralityScore: clampedScore,
    recommendedPlatform: clampedScore >= 92 ? 'tiktok' : 'reels',
    isHighRetention: clampedScore >= 80,
    latencyMs: Date.now() - startTime,
    source: 'jev-fast-fallback'
  }
}
