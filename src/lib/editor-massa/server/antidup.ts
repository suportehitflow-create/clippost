// 🛡️ Anti Duplicidade — micro variações únicas por vídeo.
// "leve" = exatamente o que o original faz (log [ANTI-DUP]): zoom, atempo, crf, fps 29.97
// "forte" = também as variações do módulo de frases do original (log [AD]): brilho, contraste,
//           saturação, gama, matiz, ruído, nitidez e GOP.

export interface ParametrosAntiDup {
  zoom: number;
  atempo: number;
  crf: number;
  fps: number;
  gop: number | null;
  eq: { brilho: number; contraste: number; saturacao: number; gama: number } | null;
  matiz: number | null;
  ruido: number | null;
  nitidez: number | null;
}

/** Gerador determinístico por semente (mesmo vídeo + mesmo job = mesmas variações) */
function aleatorio(semente: string) {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarAntiDup(semente: string, nivel: 'leve' | 'forte'): ParametrosAntiDup {
  const r = aleatorio(semente);
  const entre = (a: number, b: number) => a + (b - a) * r();
  const p: ParametrosAntiDup = {
    zoom: Number(entre(1.015, 1.03).toFixed(3)),
    atempo: Number(entre(0.992, 1.008).toFixed(3)),
    crf: Math.round(entre(18, 22)),
    fps: 29.97,
    gop: null,
    eq: null,
    matiz: null,
    ruido: null,
    nitidez: null,
  };
  if (nivel === 'forte') {
    p.eq = {
      brilho: Number(entre(-0.025, 0.025).toFixed(3)),
      contraste: Number(entre(0.97, 1.04).toFixed(3)),
      saturacao: Number(entre(0.96, 1.07).toFixed(3)),
      gama: Number(entre(0.97, 1.03).toFixed(3)),
    };
    p.matiz = Number(entre(-3, 3).toFixed(1));
    p.ruido = Math.round(entre(2, 5));
    p.nitidez = Number(entre(0.2, 0.5).toFixed(2));
    p.gop = Math.round(entre(48, 90));
  }
  return p;
}
