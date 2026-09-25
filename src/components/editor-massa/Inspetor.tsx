'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/lib/editor-massa/client/api';
import { carregarImagem } from '@/lib/editor-massa/client/midia';
import { desenharComposicao, type FonteQuadro } from '@/lib/editor-massa/client/render';
import { areaOrigem } from '@/lib/editor-massa/layout';
import type { ConfigGlobal, ConfigVideo } from '@/lib/editor-massa/types';
import type { MusicaCliente, TemplateCliente, VideoCliente } from './estado';
import { Icone } from './icones';
import s from './editor-massa.module.css';

interface PropsInspetor {
  video: VideoCliente | null;
  editando?: VideoCliente[];
  global: ConfigGlobal;
  template: TemplateCliente | null;
  musicas: MusicaCliente[];
  atualizarAtivo: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  atualizarSelecionados?: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  redetectar?: () => void;
  avisar: (msg: string) => void;
}

export default function Inspetor({
  video: v,
  global,
  template,
  musicas,
  atualizarAtivo,
  avisar,
}: PropsInspetor) {
  const [original, setOriginal] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [imgServidor, setImgServidor] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const tpl = template && !global.moldura.ativo ? { w: template.imagem.naturalWidth, h: template.imagem.naturalHeight } : null;

  // Carrega frame em alta resolução do servidor se não for tocável no navegador
  useEffect(() => {
    let cancelou = false;
    if (v && !v.tocavel && v.arquivoId) {
      carregarImagem(api.urlFrame(v.arquivoId, Math.min(1, v.duracao * 0.3), 1080))
        .then((img) => !cancelou && setImgServidor(img))
        .catch(() => {});
    } else {
      setImgServidor(null);
    }
    return () => {
      cancelou = true;
    };
  }, [v?.id, v?.arquivoId, v?.tocavel, v?.duracao]);

  const desenhar = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !v) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Resolução nítida para o canvas (Apple Retina)
    const baseW = 320;
    const baseH = Math.round(baseW * (16 / 9));
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    if (c.width !== baseW * dpr || c.height !== baseH * dpr) {
      c.width = baseW * dpr;
      c.height = baseH * dpr;
    }

    const fonte: FonteQuadro | null =
      tocando && videoRef.current
        ? { imagem: videoRef.current, largura: v.largura, altura: v.altura }
        : imgServidor
          ? { imagem: imgServidor, largura: v.largura, altura: v.altura }
          : v.quadro
            ? { imagem: v.quadro, largura: v.quadro.width, altura: v.quadro.height }
            : null;

    if (original) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      if (fonte) ctx.drawImage(fonte.imagem, 0, 0, c.width, c.height);
      const k = c.width / v.largura;
      const o = areaOrigem(v);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, c.width, o.y * k);
      ctx.fillRect(0, (o.y + o.h) * k, c.width, c.height);
      ctx.fillRect(0, o.y * k, o.x * k, o.h * k);
      ctx.fillRect((o.x + o.w) * k, o.y * k, c.width, o.h * k);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = '#6366f1';
      ctx.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k);
      return;
    }

    desenharComposicao(ctx, global, v, template?.imagem ?? null, fonte, { w: c.width, h: c.height });
  }, [v, global, template, tpl?.w, tpl?.h, original, imgServidor, tocando]);

  useEffect(() => {
    desenhar();
    if (!tocando) return;
    let id = 0;
    const loop = () => {
      const el = videoRef.current;
      if (el) {
        setTempo(el.currentTime);
      }
      desenhar();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [desenhar, tocando]);

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

  // Atalho de teclado: barra de espaço toca/pausa o preview
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

  // Arrastar vídeo livremente no palco se estiver no modo "Solto"
  const iniciarArrasto = (e: React.PointerEvent) => {
    if (!v || original || global.encaixe === 'template') return;
    arrasto.current = { x: e.clientX, y: e.clientY, px: v.posicao.x, py: v.posicao.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moverArrasto = (e: React.PointerEvent) => {
    if (!arrasto.current || !v || global.encaixe === 'template') return;
    const dx = e.clientX - arrasto.current.x;
    const dy = e.clientY - arrasto.current.y;
    atualizarAtivo(() => ({
      posicao: {
        ...v.posicao,
        x: Math.round(arrasto.current!.px + dx * 2),
        y: Math.round(arrasto.current!.py + dy * 2),
      },
    }));
  };
  const terminarArrasto = () => {
    arrasto.current = null;
  };

  if (!v) {
    return (
      <aside className={s.inspetor}>
        <div className={s.palco} style={{ height: '100%', margin: 0, borderRadius: 0 }}>
          <div className={s.palcoVazio}>
            <Icone nome="sparkles" tamanho={28} />
            <span>Selecione um corte para visualizar</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={s.inspetor}>
      <div className={s.inspetorTopo}>
        <span className={s.inspetorNome} title={v.texto || v.nome}>
          {v.texto || v.nome}
        </span>
        <button
          type="button"
          className={`${s.btn} ${s.btnPequeno} ${original ? s.btnPrimario : s.btnFantasma}`}
          onClick={() => setOriginal(!original)}
          title="Alterna entre o vídeo final composto e o corte original sem template"
        >
          {original ? 'Ver composto' : 'Ver original'}
        </button>
      </div>

      <div className={s.palco} ref={palcoRef}>
        {/* iPhone Mockup Apple HIG */}
        <div
          className={s.celular}
          onPointerDown={iniciarArrasto}
          onPointerMove={moverArrasto}
          onPointerUp={terminarArrasto}
        >
          <span className={s.celularIlha} />
          <div className={s.celularTela}>
            <canvas ref={canvasRef} style={{ cursor: global.encaixe === 'video' ? 'grab' : 'default' }} />
          </div>
          <span className={s.celularBarraHome} />
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

        <button type="button" className={s.play} onClick={alternarPlay} title="Play / Pausa (Barra de espaço)">
          <Icone nome={tocando ? 'pausa' : 'play'} tamanho={16} />
        </button>
      </div>
    </aside>
  );
}
