/**
 * Motor de Títulos e Ganchos Magnéticos com IA - CLIPOST
 * Gera títulos de alto CTR, persuasivos e diretamente contextualizados
 * com o tema real do vídeo (estilo Opus.pro, Viralday, MrBeast, Hormozi).
 */

export interface MagneticClipData {
  title: string
  hook: string
  category: string
  emoji: string
  badge: string
}

export function extractCoreSubject(rawTitle: string): string {
  if (!rawTitle) return 'ESTE VÍDEO'

  // 1. Remove sufixos comuns de canais (ex: '- Loop Infinito', '| Podpah', '#42')
  let cleaned = rawTitle.replace(/\s*[-|–—]\s*(?:canal|oficial|podcast|loop infinito|[a-zA-Z0-9_\s]+$)/gi, '')

  // 2. Remove tags entre colchetes ou parênteses [OFICIAL], (COMPLETO)
  cleaned = cleaned.replace(/[\(\[\{].*?[\)\]\}]/g, '')

  // 3. Divide em pontuações de título (dois pontos, interrogação, exclamação)
  const parts = cleaned.split(/[:?!]/).map(p => p.trim()).filter(Boolean)
  let mainSubject = parts[0] || cleaned

  // 4. Remove palavras vazias do início ou termos genéricos
  mainSubject = mainSubject.replace(/^(?:como|o que|por que|porque|veja|assista|corte do|corte de|trecho de)\s+/gi, '')

  // 5. Limpeza de preposições no final
  mainSubject = mainSubject.replace(/\s+(?:em|de|da|do|com|para|por|a|o)\s*$/gi, '')

  const words = mainSubject.split(/\s+/).filter(w => w.length > 1)
  if (words.length > 0) {
    return words.slice(0, 4).join(' ').toUpperCase()
  }

  return 'ESTE CONTEÚDO'
}

export function generateMagneticClips(rawProjectTitle: string): MagneticClipData[] {
  const subject = extractCoreSubject(rawProjectTitle)

  return [
    {
      title: `${subject}: VAZOU TUDO E DEIXOU TODOS EM CHOQUE!`,
      hook: `O que acabou de ser revelado sobre ${subject.toLowerCase()} que ninguém esperava! 😱`,
      category: 'Choque & Quebra de Expectativa',
      emoji: '😱',
      badge: '98% CTR'
    },
    {
      title: `O QUE ESCONDERAM SOBRE ${subject}?! SEGREDO REVELADO`,
      hook: `Existe um detalhe crucial que quase ninguém percebeu até agora... 🤫`,
      category: 'Segredo Oculto',
      emoji: '🤫',
      badge: '96% Viral'
    },
    {
      title: `NÃO COMPRE NADA ANTES DE VER ESTE VÍDEO SOBRE ${subject}!`,
      hook: `Preste muita atenção nisto antes de tomar qualquer decisão ou gastar dinheiro! 🚨`,
      category: 'Alerta Urgente',
      emoji: '🚨',
      badge: '94% Retenção'
    },
    {
      title: `ISSO MUDA TUDO NO MERCADO: ${subject}!`,
      hook: `A partir deste momento, nada mais será como antes! ⚡`,
      category: 'Impacto & Tendência',
      emoji: '⚡',
      badge: '92% Viral'
    },
    {
      title: `O MAIOR ERRO COMETIDO COM ${subject} REVELADO!`,
      hook: `A maioria das pessoas está errando feio exatamente aqui... 🔥`,
      category: 'Polêmica & Erro Crítico',
      emoji: '🔥',
      badge: '89% Envio'
    },
    {
      title: `VALE A PENA VENDER TUDO PRA TER ${subject}?!`,
      hook: `A resposta definitiva com números e análise sincera! 💰`,
      category: 'Finanças & Custo',
      emoji: '💰',
      badge: '85% Salvos'
    },
    {
      title: `A SACADA GENIAL POR TRÁS DE ${subject}!`,
      hook: `O ponto chave que explica todo o sucesso que você precisa entender! 💡`,
      category: 'Insight & Estratégia',
      emoji: '💡',
      badge: '82% Compartilhado'
    },
    {
      title: `A VERDADE DEFINITIVA QUE NINGUÉM TE CONTOU SOBRE ${subject}!`,
      hook: `O resumo final sem enrolação para você entender de uma vez por todas! 🤯`,
      category: 'Revelação Final',
      emoji: '🤯',
      badge: '80% Retenção'
    }
  ]
}
