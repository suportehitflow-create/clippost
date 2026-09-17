/**
 * CLIPPOST x BENCHO DESIGN SYSTEM TOKENS & UTILITIES
 * Diretrizes oficiais extraídas do Bencho.dev padronizadas para todo o projeto Clippost.
 */

export const BENCHO_THEME = {
  // Paleta de Superfície e Fundo
  colors: {
    bgApp: '#090a0f',           // Fundo neutro ultra-dark
    bgSidebar: '#0c0d12',       // Fundo da sidebar com leve distinção
    bgCard: 'rgba(24, 24, 27, 0.65)', // Superfície de card glassmorphic
    borderGlass: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(99, 102, 241, 0.5)',

    // Degradê de Marca Oficial (Electric Indigo & Cyber Violet)
    brandGradient: 'from-indigo-600 via-indigo-500 to-purple-600',
    brandGradientHover: 'hover:opacity-95',
    brandShadow: 'shadow-lg shadow-indigo-500/25',
    brandGlow: 'shadow-[0_0_24px_rgba(99,102,241,0.35)]',

    // Cores de Acento
    accentPrimary: '#6366f1',
    accentSecondary: '#8b5cf6',
    accentSuccess: '#10b981',
    accentWarning: '#f59e0b',
    accentDanger: '#ef4444',
  },

  // Classes de Estilo Reutilizáveis (Tailwind)
  classes: {
    // Botão Primário Padrão Bencho
    buttonPrimary:
      'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',

    // Botão Secundário / Glass
    buttonGlass:
      'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] transition-all duration-150 flex items-center justify-center gap-2 active:scale-95 cursor-pointer',

    // Card Glassmorphic com Borda Sutil
    cardGlass:
      'bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.15] rounded-2xl p-4 sm:p-6 transition-all duration-200 shadow-xl',

    // Seletor de Pílula Ativa (Tabs e Filtros)
    pillActive:
      'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 font-bold',
    pillInactive:
      'bg-white/[0.03] hover:bg-white/[0.07] text-zinc-400 hover:text-white border border-white/[0.06] font-medium',

    // Alça de Redimensionamento Bencho (Pílula Tátil)
    resizeHandlePillH:
      'w-16 h-3.5 rounded-full bg-white border border-zinc-500 shadow-xl cursor-ns-resize z-40 hover:scale-110 flex items-center justify-center transition-all group',
    resizeHandlePillV:
      'w-3.5 h-16 rounded-full bg-white border border-zinc-500 shadow-xl cursor-ew-resize z-40 hover:scale-110 flex items-center justify-center transition-all group',
    resizeHandleCorner:
      'w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md z-30 hover:scale-125 transition-transform',
  },

  // Especificações de Animação e Física (Spring)
  spring: {
    tactile: { type: 'spring', stiffness: 450, damping: 28 },
    smooth: { type: 'spring', stiffness: 300, damping: 25 },
    bounce: { type: 'spring', stiffness: 500, damping: 15 },
  }
} as const;
