/**
 * Motor de Emojis Automáticos e Inteligentes para Legendas - CLIPOST
 * Padrão Apple HIG: Curado, dinâmico e contextual.
 */

export interface EmojiRule {
  pattern: RegExp
  emoji: string
  category: string
}

export const SMART_EMOJI_RULES: EmojiRule[] = [
  // Dinheiro, Finanças e Sucesso
  { pattern: /(?:dinheir|lucr|ric|gran|milh|riquez|faturament|dolar|dólar|invest|vend|comiss|rend|patrimon|pagament|gratis|grátis|preç|cust)/i, emoji: '💰', category: 'finance' },
  // Segredos, Mistérios e Curiosidades
  { pattern: /(?:segred|ningu[eé]m|revelad|escondid|mist[eé]ri|descobr|proibid|vazou|bastidor|ocult|sil[eê]nci)/i, emoji: '🤫', category: 'secret' },
  // Alerta, Atenção e Erros Críticos
  { pattern: /(?:aten[cç][aã]o|cuidad|perig|err|par[ae]|nunc|urgent|alert|avis|grav|proibid)/i, emoji: '🚨', category: 'alert' },
  // Fogo, Viral e Tendência
  { pattern: /(?:viral|estour|fog|cham|bomb|hype|famos|explod|quebr|sucess|arras)/i, emoji: '🔥', category: 'viral' },
  // Choque, Mente Explodindo e Inacreditável
  { pattern: /(?:ment|cabe[cç]|chocad|choqu|inacredit[aá]vel|uau|loucur|surreal|absurd|impression|bizarro|surpres)/i, emoji: '🤯', category: 'mindblown' },
  // Ideias, Estratégias e Dicas
  { pattern: /(?:idei|dic|insight|sacad|truqu|aprend|estrat[eé]g|m[eé]tod|f[oó]rmul|solu[cç]|chave|caminh)/i, emoji: '💡', category: 'idea' },
  // Foco, Metas e Objetivos
  { pattern: /(?:met|objetiv|foc|resultad|alcan[cç]|vitor|vit[oó]ri|campe|disciplin|conquist|ganh)/i, emoji: '🎯', category: 'target' },
  // Velocidade, Rápido e Urgência
  { pattern: /(?:r[aá]pid|velocidad|aceler|temp|urgent|turb|agil|[aá]gil|agor|j[aá]|corra)/i, emoji: '⚡', category: 'speed' },
  // Crescimento, Foguete e Escala
  { pattern: /(?:foguet|cresc|decol|alt|subir|escal|multiplic|evolu|gigant)/i, emoji: '🚀', category: 'growth' },
  // Gráfico e Alta Performance
  { pattern: /(?:gr[aá]fic|estat[ií]stic|aument|lucrativ|milion[aá]ri|performance|alavanc)/i, emoji: '📈', category: 'stats' },
  // Emoção, Amor e Paixão
  { pattern: /(?:amor|paix[aã]|vida|cora[cç][aã]|sentim|verdadeir|fam[ií]li|gratid)/i, emoji: '❤️', category: 'heart' },
  // Parar, Negativa Firme
  { pattern: /(?:parar|chega|bast|bloque|n[aã]o|jamais)/i, emoji: '🛑', category: 'stop' },
  // Valor Raro, Diamante, Preciosidade
  { pattern: /(?:our|j[oó]i|precios|rar|diamant|exclusiv|lux)/i, emoji: '💎', category: 'value' },
  // Confirmação, Certeza e Garantia
  { pattern: /(?:cert|garantid|certez|100%|definitiv|aprovad|valid|provad)/i, emoji: '✅', category: 'verified' },
  // Troféu, Primeiro Lugar e Vencedor
  { pattern: /(?:trof[eé]u|primeir|melhor|topo|venced|top)/i, emoji: '🏆', category: 'winner' },
  // Pensamento, Raciocínio e Cérebro
  { pattern: /(?:pens|raciocin|c[eé]rebr|psicolog|mentalidad|mindset)/i, emoji: '🧠', category: 'brain' }
]

export function getSmartEmojiForWord(rawWord: string): string | null {
  if (!rawWord || rawWord.length < 3) return null
  const clean = rawWord.trim()
  for (const rule of SMART_EMOJI_RULES) {
    if (rule.pattern.test(clean)) {
      return rule.emoji
    }
  }
  return null
}

export function formatSubtitleWord(word: string, emojisEnabled: boolean = true): {
  displayWord: string
  emoji: string | null
  fullText: string
} {
  if (!emojisEnabled) {
    return { displayWord: word, emoji: null, fullText: word }
  }

  const emoji = getSmartEmojiForWord(word)
  return {
    displayWord: word,
    emoji: emoji,
    fullText: emoji ? (word + ' ' + emoji) : word
  }
}
