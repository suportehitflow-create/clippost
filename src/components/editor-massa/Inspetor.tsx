'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { urlFrame } from '@/lib/editor-massa/client/api';
import { abrirVideo, capturarQuadro } from '@/lib/editor-massa/client/midia';
import { desenharComposicao } from '@/lib/editor-massa/client/render';
import { areaOrigem, calcularLayout } from '@/lib/editor-massa/layout';
import type { ConfigGlobal, ConfigVideo, Lados } from '@/lib/editor-massa/types';
import { Campo, Opcao, Slider } from './campos';
import type { MusicaCliente, TemplateCliente, VideoCliente } from './estado';
import { Icone } from './icones';
import s from './editor-massa.module.css';

interface Props {
  video: VideoCliente | null;
  editando: VideoCliente[];
  global: ConfigGlobal;
  template: TemplateCliente | null;
  musicas: MusicaCliente[];
  atualizarAtivo: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  atualizarSelecionados: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  redetectar: () => void;
  avisar: (msg: string) => void;
}

const seg = (t: number) => `${t.toFixed(1).replace('.', ',')}s`;
const ORIGEM: Record<string, string> = {
  local: 'Template antigo removido',
  roboflow: 'Template antigo removido',
  margem: 'Margem de 5% cortada',
  completo: 'Vídeo inteiro',
  manual: 'Vídeo inteiro (manual)',
};

export default function Inspetor({ video: v, editando, global, template, musicas, atualizarAtivo, atualizarSelecionados, redetectar, avisar }: Props) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trilhaRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [tamPalco, setTamPalco] = useState({ w: 340, h: 480 });
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [faixa, setFaixa] = useState<[number, number]>([0, 0]);
  const [minis, setMinis] = useState<string[]>([]);
  const [original, setOriginal] = useState(false);
  const [imgServidor, setImgServidor] = useState<HTMLImageElement | null>(null);

  const tpl = template && !global.moldura.ativo ? { w: template.imagem.naturalWidth, h: template.imagem.naturalHeight } : null;

  useEffect(() => {
    const el = palcoRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTamPalco({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!v]);

  // troca de vídeo → reseta faixa, gera miniaturas da timeline
  useEffect(() => {
    setTocando(false);
    audioRef.current?.pause();
    setImgServidor(null);
    setMinis([]);
    if (!v) return;
    const ini = v.corte?.inicio ?? 0;
    setFaixa([ini, v.corte?.fim ?? v.duracao]);
    setTempo(Math.min(ini + 0.5, v.duracao));
    let cancelado = false;
    if (!v.tocavel) {
      if (v.arquivoId) {
        const img = new Image();
        img.src = urlFrame(v.arquivoId, Math.min(v.duracao * 0.3, 1), 1080);
        img.onload = () => !cancelado && setImgServidor(img);
      }
      return;
    }
    if (!v.duracao) return;
    (async () => {
      try {
        const el = await abrirVideo(v.url);
        const urls: string[] = [];
        const c = document.createElement('canvas');
        for (let i = 0; i < 8 && !cancelado; i++) {
          const q = await capturarQuadro(el, ((i + 0.5) / 8) * v.duracao, 90);
          c.width = q.width;
          c.height = q.height;
          c.getContext('2d')!.drawImage(q, 0, 0);
          urls.push(c.toDataURL('image/jpeg', 0.6));
        }
        el.removeAttribute('src');
        el.load();
        if (!cancelado) setMinis(urls);
      } catch {
        // sem miniaturas
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id, v?.tocavel, v?.duracao, v?.arquivoId]);

  // corte mudou por fora (ex.: "Desfazer ajustes")
  useEffect(() => {
    if (v) setFaixa([v.corte?.inicio ?? 0, v.corte?.fim ?? v.duracao]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.corte?.inicio, v?.corte?.fim]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || tocando || !v?.tocavel) return;
    if (Math.abs(el.currentTime - tempo) > 0.04) el.currentTime = tempo;
  }, [tempo, tocando, v?.tocavel]);

  const desenhar = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !v) return;
    const L = calcularLayout(global, v, tpl);
    const aspecto = original ? v.largura / v.altura || 1 : L.canvas.w / L.canvas.h;
    // no modo resultado a tela fica dentro da moldura do celular (borda de 10px + folga)
    const folga = original ? 24 : 48;
    const w = Math.max(60, Math.min(tamPalco.w - folga, (tamPalco.h - folga) * aspecto));
    const h = w / aspecto;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    c.style.borderRadius = original ? '4px' : `${Math.round(w * 0.12)}px`;
    const ctx = c.getContext('2d')!;
    const el = videoRef.current;
    const fonte =
      v.tocavel && el && el.readyState >= 2
        ? { imagem: el, largura: el.videoWidth, altura: el.videoHeight }
        : imgServidor
          ? { imagem: imgServidor, largura: imgServidor.naturalWidth, altura: imgServidor.naturalHeight }
          : v.quadro
            ? { imagem: v.quadro, largura: v.quadro.width, altura: v.quadro.height }
            : null;

    if (original) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      if (fonte) ctx.drawImage(fonte.imagem, 0, 0, c.width, c.height);
      const k = c.width / v.largura;
      const o = areaOrigem(v);
      // escurece o que fica de fora
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, c.width, o.y * k);
      ctx.fillRect(0, (o.y + o.h) * k, c.width, c.height);
      ctx.fillRect(0, o.y * k, o.x * k, o.h * k);
      ctx.fillRect((o.x + o.w) * k, o.y * k, c.width, o.h * k);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = '#34d399';
      ctx.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k);
      return;
    }
    desenharComposicao(ctx, global, v, template?.imagem ?? null, fonte, { w: c.width, h: c.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, global, template, tpl?.w, tpl?.h, tamPalco, original, imgServidor]);

  useEffect(() => {
    desenhar();
    if (!tocando) return;
    let id = 0;
    const loop = () => {
      const el = videoRef.current;
      if (el) {
        setTempo(el.currentTime);
        if (el.currentTime >= faixa[1] - 0.03) {
          el.currentTime = faixa[0];
          if (audioRef.current) audioRef.current.currentTime = inicioMusica();
        }
      }
      desenhar();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desenhar, tocando, faixa]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const musicaDoVideo = () => {
    if (!v) return null;
    const id = v.musica?.musicaId ?? global.musica.musicaId;
    return musicas.find((m) => m.id === id) ?? null;
  };
  const inicioMusica = () => v?.musica?.inicio ?? global.musica.inicio;

  const alternarPlay = async () => {
    const el = videoRef.current;
    if (!el || !v?.tocavel) return avisar('Este formato não toca no navegador — o preview mostra um quadro parado');
    if (tocando) {
      el.pause();
      audioRef.current?.pause();
      setTocando(false);
      return;
    }
    if (el.currentTime < faixa[0] || el.currentTime >= faixa[1] - 0.05) el.currentTime = faixa[0];
    const m = musicaDoVideo();
    const volOriginal = global.musica.mutarOriginal ? 0 : (global.musica.volumeVideo ?? 100) / 100;
    el.muted = v.mudo || volOriginal <= 0.001;
    el.volume = Math.max(0, Math.min(1, volOriginal));
    el.playbackRate = global.efeitos.velocidadePersonalizada ? global.efeitos.velocidade : global.efeitos.velocidade105 ? 1.05 : 1;
    if (m) {
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = m.url;
      a.currentTime = inicioMusica();
      a.volume = Math.min(1, global.musica.volumeMusica / 100);
      a.play().catch(() => {});
    }
    await el.play().catch(() => {});
    setTocando(true);
  };

  // atalho: espaço = play/pause
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(alvo.tagName)) return;
      e.preventDefault();
      alternarPlay();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // timeline: alças de início/fim (o corte é salvo ao soltar) e cursor
  const tempoMouse = (x: number) => {
    const r = trilhaRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (x - r.left) / r.width)) * (v?.duracao ?? 0);
  };
  const arrastarTrilha = (tipo: 'ini' | 'fim' | 'cursor') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    let atual = faixa;
    const mover = (ev: PointerEvent) => {
      const t = tempoMouse(ev.clientX);
      if (tipo === 'ini') atual = [Math.min(t, atual[1] - 0.3), atual[1]];
      else if (tipo === 'fim') atual = [atual[0], Math.max(t, atual[0] + 0.3)];
      if (tipo !== 'cursor') setFaixa(atual);
      setTempo(tipo === 'fim' ? Math.max(0, t - 0.05) : t);
    };
    mover(e.nativeEvent);
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      if (tipo !== 'cursor' && v) {
        const inteiro = atual[0] < 0.05 && atual[1] > v.duracao - 0.05;
        atualizarAtivo(() => ({ corte: inteiro ? null : { inicio: atual[0], fim: atual[1] } }));
      }
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  // arrastar o vídeo no palco
  const apertar = (e: React.PointerEvent) => {
    if (!v || original || (e.target as HTMLElement).tagName !== 'CANVAS') return;
    arrasto.current = { x: e.clientX, y: e.clientY, px: v.posicao.x, py: v.posicao.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent) => {
    const a = arrasto.current;
    const c = canvasRef.current;
    if (!a || !c || !v) return;
    const k = calcularLayout(global, v, tpl).canvas.w / c.clientWidth;
    atualizarSelecionados((x) => ({ posicao: { ...x.posicao, x: Math.round(a.px + (e.clientX - a.x) * k), y: Math.round(a.py + (e.clientY - a.y) * k) } }));
  };

  if (!v) {
    return (
      <aside className={s.inspetor}>
        <div className={s.inspetorTopo}>
          <span className={s.inspetorNome}>Preview</span>
        </div>
        <div className={s.palco} ref={palcoRef}>
          <div className={s.palcoVazio}>
            <Icone nome="olho" tamanho={28} />
            {template || global.moldura.ativo ? 'Clique em um vídeo para ver o resultado' : 'Escolha um template e adicione vídeos'}
          </div>
        </div>
      </aside>
    );
  }

  const dur = v.duracao || 1;
  const n = editando.length;
  const lados: [keyof Lados, string][] = [
    ['topo', 'Topo'],
    ['base', 'Base'],
    ['esq', 'Esquerda'],
    ['dir', 'Direita'],
  ];
  const canvasW = calcularLayout(global, v, tpl).canvas.w;
  const canvasH = calcularLayout(global, v, tpl).canvas.h;
  const sb = v.semBordas ?? global.semBordas;
  const cortado = !!v.corte;

  return (
    <aside className={s.inspetor}>
      <div className={s.inspetorTopo}>
        <span className={s.inspetorNome} title={v.nome}>
          {v.nome}
        </span>
        <button
          type="button"
          className={`${s.btn} ${s.btnPequeno} ${original ? s.btnPrimario : ''}`}
          onClick={() => setOriginal(!original)}
          title="Mostra o vídeo original e a área que será usada (verde)"
        >
          <Icone nome="scan" tamanho={14} /> {original ? 'Ver resultado' : 'Ver original'}
        </button>
      </div>

      <div className={s.palco} ref={palcoRef} onPointerDown={apertar} onPointerMove={mover} onPointerUp={() => (arrasto.current = null)}>
        <div className={original ? s.telaSolta : s.celular}>
          {!original && <span className={s.celularIlha} aria-hidden />}
          <canvas ref={canvasRef} style={{ cursor: original ? 'default' : 'grab' }} />
        </div>
        <video
          ref={videoRef}
          src={v.tocavel ? v.url : undefined}
          playsInline
          preload="auto"
          style={{ display: 'none' }}
          onLoadedData={desenhar}
          onSeeked={desenhar}
          onPause={() => setTocando(false)}
        />
        <button type="button" className={s.play} onClick={alternarPlay} title="Play / pausa (espaço)">
          <Icone nome={tocando ? 'pausa' : 'play'} tamanho={16} />
        </button>
        {!original && <span className={s.palcoDica}>arraste para mover</span>}
        {(v.detectando || v.origemDeteccao) && (
          <span className={`${s.chip} ${s.palcoChip} ${v.origemDeteccao === 'local' || v.origemDeteccao === 'roboflow' ? s.chipOk : ''}`}>
            {v.detectando ? 'Detectando…' : ORIGEM[v.origemDeteccao!]}
          </span>
        )}      </div>

      <div className={s.trilhaBloco}>
        <div className={s.rotuloLinha}>
          <span>
            <Icone nome="tesoura" tamanho={13} style={{ verticalAlign: -2 }} /> Trecho {seg(faixa[0])} – {seg(faixa[1])}
            <span className={s.dica}> · {seg(faixa[1] - faixa[0])}</span>
          </span>
          {cortado && (
            <button
              type="button"
              className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`}
              style={{ height: 22 }}
              onClick={() => {
                atualizarAtivo(() => ({ corte: null }));
                setFaixa([0, v.duracao]);
              }}
            >
              Vídeo todo
            </button>
          )}
        </div>
        <div className={s.trilha} ref={trilhaRef} onPointerDown={arrastarTrilha('cursor')}>
          <div className={s.trilhaMinis}>
            {minis.map((m, i) => (
              <img key={i} src={m} alt="" draggable={false} />
            ))}
          </div>
          <div className={s.trilhaFora} style={{ left: 0, width: `${(faixa[0] / dur) * 100}%` }} />
          <div className={s.trilhaFora} style={{ left: `${(faixa[1] / dur) * 100}%`, right: 0 }} />
          <div className={s.trilhaFaixa} style={{ left: `${(faixa[0] / dur) * 100}%`, width: `${((faixa[1] - faixa[0]) / dur) * 100}%` }} />
          <div className={s.trilhaCursor} style={{ left: `${(tempo / dur) * 100}%` }} />
          <div className={s.trilhaAlca} style={{ left: `calc(${(faixa[0] / dur) * 100}% - 4px)` }} onPointerDown={arrastarTrilha('ini')} />
          <div className={s.trilhaAlca} style={{ left: `calc(${(faixa[1] / dur) * 100}% - 8px)` }} onPointerDown={arrastarTrilha('fim')} />
        </div>
      </div>

      <div className={s.painel}>
        <div className={s.painelTitulo}>
          Ajustes {n > 1 && <span className={`${s.chip} ${s.chipAcento}`}>em {n} vídeos</span>}
        </div>

        <Slider rotulo="Tamanho" min={20} max={300} valor={v.posicao.escala} formatar={(x) => `${x}%`} padrao={100} mudar={(x) => atualizarSelecionados((y) => ({ posicao: { ...y.posicao, escala: x } }))} />
        <div className={s.grade2}>
          <Slider
            rotulo="Horizontal"
            min={-Math.round(canvasW / 2)}
            max={Math.round(canvasW / 2)}
            valor={v.posicao.x}
            padrao={0}
            mudar={(x) => atualizarSelecionados((y) => ({ posicao: { ...y.posicao, x } }))}
          />
          <Slider
            rotulo="Vertical"
            min={-Math.round(canvasH / 2)}
            max={Math.round(canvasH / 2)}
            valor={v.posicao.y}
            padrao={0}
            mudar={(x) => atualizarSelecionados((y) => ({ posicao: { ...y.posicao, y: x } }))}
          />
        </div>
        <Opcao rotulo="Espelhar" valor={v.espelhar} mudar={(x) => atualizarSelecionados(() => ({ espelhar: x }))} />
        <Opcao rotulo="Sem bordas" valor={sb} mudar={(x) => atualizarSelecionados(() => ({ semBordas: x }))} />
        <Opcao rotulo="Tirar o áudio" valor={v.mudo} mudar={(x) => atualizarSelecionados(() => ({ mudo: x }))} />

        <Campo rotulo="Música deste vídeo">
          <select
            className={s.select}
            value={v.musica?.musicaId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              atualizarSelecionados(() => ({ musica: id ? { musicaId: id, inicio: 0 } : null }));
            }}
          >
            <option value="">{global.musica.musicaId ? 'Usar a música de fundo geral' : 'Nenhuma'}</option>
            {musicas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        {v.musica && (
          <Slider
            rotulo="Música começa em"
            min={0}
            max={Math.max(1, Math.floor(musicas.find((m) => m.id === v.musica!.musicaId)?.duracao ?? 60))}
            valor={v.musica.inicio}
            formatar={(x) => `${x}s`}
            mudar={(x) => atualizarSelecionados((y) => (y.musica ? { musica: { ...y.musica, inicio: x } } : {}))}
          />
        )}

        <details className={s.detalhes}>
          <summary>
            <Icone nome="chevron" tamanho={14} /> Recortar bordas do vídeo original
          </summary>
          <div className={s.cartao}>
            <div className={s.linha}>
              <button type="button" className={`${s.btn} ${s.btnPequeno}`} style={{ flex: 1 }} onClick={redetectar}>
                <Icone nome="refresh" tamanho={13} /> Detectar de novo
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnPequeno}`}
                style={{ flex: 1 }}
                onClick={() => atualizarSelecionados((x) => ({ areaDetectada: { x: 0, y: 0, w: x.largura, h: x.altura }, origemDeteccao: 'manual' }))}
              >
                Usar vídeo inteiro
              </button>
            </div>
            <div className={s.grade2}>
              {lados.map(([lado, rot]) => (
                <Slider
                  key={lado}
                  rotulo={rot}
                  min={0}
                  max={Math.round((lado === 'topo' || lado === 'base' ? v.altura : v.largura) * 0.45)}
                  valor={v.recorte[lado]}
                  formatar={(x) => `${x}px`}
                  padrao={0}
                  mudar={(x) => atualizarSelecionados((y) => ({ recorte: { ...y.recorte, [lado]: x } }))}
                />
              ))}
            </div>
          </div>
        </details>

        <details className={s.detalhes}>
          <summary>
            <Icone nome="chevron" tamanho={14} /> Aparar o vídeo no resultado
          </summary>
          <div className={s.cartao}>
            <div className={s.grade2}>
              {lados.map(([lado, rot]) => (
                <Slider
                  key={lado}
                  rotulo={rot}
                  min={0}
                  max={Math.round((lado === 'topo' || lado === 'base' ? canvasH : canvasW) * 0.45)}
                  valor={v.vcrop[lado]}
                  formatar={(x) => `${x}px`}
                  padrao={0}
                  mudar={(x) => atualizarSelecionados((y) => ({ vcrop: { ...y.vcrop, [lado]: x } }))}
                />
              ))}
            </div>
          </div>
        </details>

        <button
          type="button"
          className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`}
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            atualizarSelecionados(() => ({
              recorte: { topo: 0, base: 0, esq: 0, dir: 0 },
              vcrop: { topo: 0, base: 0, esq: 0, dir: 0 },
              posicao: { x: 0, y: 0, escala: 100 },
              espelhar: false,
              semBordas: null,
              mudo: false,
              corte: null,
              musica: null,
              marcasExtras: [],
            }))
          }
        >
          <Icone nome="reset" tamanho={13} /> Desfazer ajustes {n > 1 ? `dos ${n} vídeos` : 'deste vídeo'}
        </button>
      </div>
    </aside>
  );
}
