// Ícones de linha (estilo Lucide), inline para não depender de biblioteca.
import type { SVGProps } from 'react';

const caminhos: Record<string, string> = {
  upload: 'M12 3v12M7 8l5-5 5 5M5 21h14',
  imagem: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 8.5h.01',
  musica: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  texto: 'M4 7V5h16v2M9 19h6M12 5v14',
  gota: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  varinha: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10M18 14l1 1M18 2l1 1',
  exportar: 'M12 15V3M7 10l5 5 5-5M5 21h14',
  vassoura: 'M19 3l-8 8M9 11l4 4-5 6H3v-5l6-5zM7 16l1 1',
  layout: 'M3 3h18v18H3zM3 9h18M9 21V9',
  play: 'M7 4l13 8-13 8z',
  pausa: 'M7 4h4v16H7zM13 4h4v16h-4z',
  parar: 'M6 6h12v12H6z',
  espelhar: 'M12 3v18M8 7L3 12l5 5M16 7l5 5-5 5',
  expandir: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  somOff: 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  som: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  lixo: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  mais: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  chevron: 'M6 9l6 6 6-6',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  scan: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M7 12h10',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  tesoura: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  pasta: 'M3 6h6l2 2h10v11H3z',
  log: 'M4 17l6-5-6-5M12 19h8',
  alvo: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  alinharE: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alinharC: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alinharD: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};

export type NomeIcone = keyof typeof caminhos;

export function Icone({ nome, tamanho = 16, ...resto }: { nome: NomeIcone; tamanho?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...resto}
    >
      <path d={caminhos[nome]} />
    </svg>
  );
}
