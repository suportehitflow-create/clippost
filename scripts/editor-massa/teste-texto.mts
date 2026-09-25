// Teste rápido da detecção de texto sobre o vídeo: npx tsx scripts/editor-massa/teste-texto.mts
import { detectarAreaVideo } from '../../src/lib/editor-massa/deteccao-core';

const w = 160;
const h = 284;
// Template antigo: fundo parado; vídeo de y=60 a y=240, x=8..152; título parado de y=62 a y=80 dentro do vídeo
function quadro(f: number, comTexto: boolean) {
  const g = new Uint8Array(w * h).fill(20);
  for (let y = 60; y < 240; y++)
    for (let x = 8; x < 152; x++) {
      // conteúdo que se mexe e é suave (média borrada)
      g[y * w + x] = 90 + Math.round(60 * Math.sin((x + y) / 9 + f * 1.7));
    }
  if (comTexto)
    for (let y = 62; y < 80; y++)
      for (let x = 14; x < 146; x++) {
        // "letras": colunas brancas e pretas alternadas, paradas
        g[y * w + x] = (Math.floor(x / 3) + Math.floor(y / 6)) % 2 ? 250 : 5;
      }
  return g;
}

for (const comTexto of [false, true]) {
  const frames = Array.from({ length: 16 }, (_, f) => quadro(f, comTexto));
  const sem = detectarAreaVideo(frames, w, h);
  const com = detectarAreaVideo(frames, w, h, { cortarTexto: true });
  const px = (r: typeof sem) => r && `y=${Math.round(r.rect.y * h)} h=${Math.round(r.rect.h * h)} x=${Math.round(r.rect.x * w)} w=${Math.round(r.rect.w * w)}`;
  console.log(comTexto ? 'COM texto' : 'SEM texto', '| normal:', px(sem), '| cortarTexto:', px(com));
}
