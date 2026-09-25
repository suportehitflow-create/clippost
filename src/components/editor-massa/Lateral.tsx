'use client';

import { useRef, useState, type ReactNode } from 'react';
import type { ConfigGlobal, ConfigVideo, Qualidade } from '@/lib/editor-massa/types';
import { PRESETS_LEGENDA } from '@/lib/editor-massa/defaults';
import { SMART_EMOJI_RULES } from '@/lib/emojis';
import type { TemplateClipost } from '@/lib/editor-massa/client/templateClipost';
import { Campo, Opcao, Segmentado, Slider, Toggle } from './campos';
import type { MusicaCliente, TemplateCliente, VideoCliente } from './estado';
import { Icone, type NomeIcone } from './icones';
import s from './editor-massa.module.css';

export interface PropsLateral {
  largura?: number;
  setLargura?: (w: number) => void;
  recolhido?: boolean;
  setRecolhido?: (r: boolean) => void;
  ferramentaAtiva?: string | null;
  setFerramentaAtiva?: (f: string | null) => void;
  global: ConfigGlobal;
  mudarGlobal: (fn: (g: ConfigGlobal) => ConfigGlobal) => void;
  template: TemplateCliente | null;
  tplClipost?: TemplateClipost | null;
  mudarTemplate?: (parcial: Record<string, any>) => void;
  perfilTemplate: string;
  carregandoTemplate: boolean;
  editarTemplate?: () => void;
  musicas: MusicaCliente[];
  importarMusicas: () => void;
  abrirBibliotecaMusicas?: () => void;
  removerMusica: (id: string) => void;
  totalVideos: number;
  aplicarTextosEmMassa: (linhas: string[]) => void;
  redetectarTodos: () => void;
  isYouTube?: boolean;
  emMassa: boolean;
  setEmMassa: (v: boolean) => void;
  videoAtivo?: VideoCliente | null;
  atualizarAtivo?: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  atualizarTodos?: (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => void;
  aoProcessar?: () => void;
  processando?: boolean;
}

export type TipoFerramenta = 'template' | 'texto' | 'legendas' | 'musica' | 'efeitos' | 'exportar';

interface ToolItem {
  id: TipoFerramenta;
  rotulo: string;
  icone: NomeIcone;
  titulo: string;
  subtitulo: string;
}

const TOOLS: ToolItem[] = [
  { id: 'template', rotulo: 'Modelos', icone: 'layout', titulo: 'Modelos de Template', subtitulo: 'Cor de fundo, enquadramento e corte' },
  { id: 'texto', rotulo: 'Texto', icone: 'texto', titulo: 'Textos & Ganchos', subtitulo: 'Títulos para cada corte do lote' },
  { id: 'legendas', rotulo: 'Legenda', icone: 'sparkles', titulo: 'Legendas Animadas', subtitulo: 'Fontes, cores, sombras e sincronia' },
  { id: 'musica', rotulo: 'Áudio', icone: 'musica', titulo: 'Áudio & Música', subtitulo: 'Trilha sonora e volume original' },
  { id: 'efeitos', rotulo: 'Efeitos', icone: 'varinha', titulo: 'Efeitos & Dinâmica', subtitulo: 'Corte de silêncios e retenção' },
  { id: 'exportar', rotulo: 'Exportar', icone: 'exportar', titulo: 'Exportação do Lote', subtitulo: 'Qualidade, anti-dup e renderização' },
];

function CartaoRecolhivel(p: {
  titulo: string;
  aberto: boolean;
  alternar: () => void;
  resumo?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.cartaoRecolhivel}>
      <button type="button" className={s.cartaoRecolhivelCabeca} onClick={p.alternar}>
        <span>{p.titulo}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {p.resumo && <span style={{ fontSize: 10, color: 'var(--suave)' }}>{p.resumo}</span>}
          <Icone nome="chevron" tamanho={12} style={{ transform: p.aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
        </div>
      </button>
      {p.aberto && <div className={s.cartaoRecolhivelCorpo}>{p.children}</div>}
    </div>
  );
}

export default function Lateral(p: PropsLateral) {
  const g = p.global;
  const [ferramentaLocal, setFerramentaLocal] = useState<TipoFerramenta | null>(null);
  const ferramentaAtiva = (p.ferramentaAtiva !== undefined ? p.ferramentaAtiva : ferramentaLocal) as TipoFerramenta | null;
  const setFerramentaAtiva = (f: TipoFerramenta | null) => {
    if (p.setFerramentaAtiva) p.setFerramentaAtiva(f);
    else setFerramentaLocal(f);
  };

  // Sub-accordions para manter a interface com menos informações e expansível
  const [subAjustesAberto, setSubAjustesAberto] = useState(false);
  const [subLimpezaAberto, setSubLimpezaAberto] = useState(false);

  const [massa, setMassa] = useState('');
  const [tocando, setTocando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const inputCorRef = useRef<HTMLInputElement>(null);

  const mudar = <K extends keyof ConfigGlobal>(k: K, v: ConfigGlobal[K]) => p.mudarGlobal((x) => ({ ...x, [k]: v }));

  const aplicarAjusteVideo = (fn: (v: ConfigVideo) => Partial<ConfigVideo>) => {
    if (p.emMassa && p.atualizarTodos) {
      p.atualizarTodos(fn);
    } else if (p.atualizarAtivo) {
      p.atualizarAtivo(fn);
    }
  };

  const vAtivo = p.videoAtivo;
  const et = g.estiloTexto;
  const mudarTexto = (parcial: Partial<typeof et>) => mudar('estiloTexto', { ...et, ...parcial });
  const canvasH = g.moldura.ativo ? g.moldura.altura : (p.template?.imagem.naturalHeight ?? 1920);
  const canvasW = g.moldura.ativo ? g.moldura.largura : (p.template?.imagem.naturalWidth ?? 1080);
  const leg = g.legendas ?? { ativo: false, preset: 'hormozi_yellow', posicaoY: 75, fonte: 'Montserrat', corTexto: '#FFFFFF', borda: true, sombra: true, fundo: false };
  const musicaSel = p.musicas.find((m) => m.id === g.musica.musicaId);
  const volOriginal = g.musica.mutarOriginal ? 0 : g.musica.volumeVideo;

  const corFundoRaw = String(p.tplClipost?.config?.templateBg || 'dark');
  const ehDark = corFundoRaw === 'dark' || corFundoRaw === '#000000';
  const ehWhite = corFundoRaw === 'white' || corFundoRaw.toLowerCase() === '#ffffff';
  const ehCustom = !ehDark && !ehWhite;
  const corHexAtual = ehDark ? '#000000' : ehWhite ? '#ffffff' : (corFundoRaw.startsWith('#') ? corFundoRaw : '#6366f1');

  const inserirEmojisContextuais = () => {
    const textoBase = massa || vAtivo?.texto || '';
    if (!textoBase) return;

    const palavras = textoBase.toLowerCase().split(/\s+/);
    const sugeridos: string[] = [];
    for (const pal of palavras) {
      const limpo = pal.replace(/[^a-zA-Z0-9áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '');
      for (const rule of SMART_EMOJI_RULES) {
        if (rule.pattern.test(limpo) && !sugeridos.includes(rule.emoji)) {
          sugeridos.push(rule.emoji);
          if (sugeridos.length >= 2) break;
        }
      }
      if (sugeridos.length >= 2) break;
    }

    if (sugeridos.length > 0) {
      const emojiStr = ' ' + sugeridos.join(' ');
      if (massa) {
        setMassa((prev) => prev.split('\n').map((l) => l.trim() ? l + emojiStr : l).join('\n'));
      } else if (vAtivo) {
        aplicarAjusteVideo((x) => ({ texto: (x.texto || '').trim() + emojiStr }));
      }
    }
  };

  const ouvir = () => {
    if (!musicaSel) return;
    if (tocando) {
      audio.current?.pause();
      setTocando(false);
      return;
    }
    const a = audio.current ?? new Audio();
    audio.current = a;
    a.src = musicaSel.url;
    a.currentTime = g.musica.inicio;
    a.volume = Math.min(1, g.musica.volumeMusica / 100);
    a.ontimeupdate = () => {
      if (a.currentTime >= g.musica.inicio + 10) {
        a.pause();
        setTocando(false);
      }
    };
    a.play().catch(() => {});
    setTocando(true);
  };

  if (p.recolhido) {
    return null;
  }

  const toolAtual = TOOLS.find((t) => t.id === ferramentaAtiva);

  return (
    <aside className={s.barraTrilhoContainer}>
      {/* 1. BARRA DE FERRAMENTAS VERTICAL (CANVA / TEMPLATES RAIL) */}
      <nav className={s.trilho}>
        {TOOLS.map((t) => {
          const ativo = ferramentaAtiva === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`${s.btnTrilho} ${ativo ? s.btnTrilhoAtivo : ''}`}
              onClick={() => setFerramentaAtiva(ativo ? null : t.id)}
              title={t.rotulo}
            >
              <Icone nome={t.icone} tamanho={20} />
              <span className={s.btnTrilhoTexto}>{t.rotulo}</span>
            </button>
          );
        })}
      </nav>

      {/* 2. GAVETA / DRAWER DO CARD SELECIONADO */}
      {toolAtual && (
        <div className={s.gaveta}>
          <div className={s.gavetaCabeca}>
            <div className={s.gavetaTituloBox}>
              <div className={s.gavetaIconeBadge}>
                <Icone nome={toolAtual.icone} tamanho={15} />
              </div>
              <div>
                <h3 className={s.gavetaTituloTexto}>{toolAtual.titulo}</h3>
                <span className={s.gavetaSubtitulo}>{toolAtual.subtitulo}</span>
              </div>
            </div>
            <button
              type="button"
              className={s.btnFecharGaveta}
              onClick={() => setFerramentaAtiva(null)}
              title="Fechar painel"
            >
              <Icone nome="x" tamanho={14} />
            </button>
          </div>

          <div className={s.gavetaCorpo}>
            {/* ================= CARD 1: MODELOS / TEMPLATE ================= */}
            {ferramentaAtiva === 'template' && (
              <>
                <div className={s.cartaoGrupo}>
                  <span className={s.cartaoGrupoTitulo}>Cor do Fundo</span>
                  <div className={s.gradeCores}>
                    <button
                      type="button"
                      className={`${s.btnCor} ${ehDark ? s.btnCorAtiva : ''}`}
                      onClick={() => p.mudarTemplate?.({ templateBg: 'dark' })}
                      title="Fundo Preto"
                    >
                      <span className={s.amostraCor} style={{ background: '#000000' }} />
                      Preto
                    </button>
                    <button
                      type="button"
                      className={`${s.btnCor} ${ehWhite ? s.btnCorAtiva : ''}`}
                      onClick={() => p.mudarTemplate?.({ templateBg: 'white' })}
                      title="Fundo Branco"
                    >
                      <span className={s.amostraCor} style={{ background: '#ffffff', border: '1px solid #444' }} />
                      Branco
                    </button>
                    <button
                      type="button"
                      className={`${s.btnCor} ${ehCustom ? s.btnCorAtiva : ''}`}
                      onClick={() => inputCorRef.current?.click()}
                      title="Cor Personalizada"
                      style={{ position: 'relative' }}
                    >
                      <span
                        className={s.amostraCor}
                        style={{
                          background: ehCustom ? corHexAtual : 'conic-gradient(from 180deg at 50% 50%, #f43f5e 0deg, #ec4899 45deg, #a855f7 90deg, #6366f1 135deg, #3b82f6 180deg, #10b981 225deg, #eab308 270deg, #f97316 315deg, #f43f5e 360deg)',
                          boxShadow: ehCustom ? '0 0 0 2px #fff' : 'none',
                        }}
                      />
                      <span>{ehCustom ? corHexAtual.toUpperCase() : 'Outro'}</span>
                      <input
                        ref={inputCorRef}
                        type="color"
                        value={corHexAtual}
                        onChange={(e) => p.mudarTemplate?.({ templateBg: e.target.value.toLowerCase() })}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                      />
                    </button>
                  </div>
                </div>

                <div className={s.cartaoGrupo}>
                  <span className={s.cartaoGrupoTitulo}>Enquadramento do Vídeo</span>
                  <Campo rotulo="Encaixe">
                    <Segmentado
                      valor={g.encaixe}
                      mudar={(v) => mudar('encaixe', v)}
                      opcoes={[
                        { valor: 'template', rotulo: 'Fixo', titulo: 'O vídeo ocupa o quadro fixo do seu template' },
                        { valor: 'video', rotulo: 'Solto', titulo: 'O vídeo fica solto, permitindo ajuste de tamanho e posição' },
                      ]}
                    />
                  </Campo>

                  <Slider
                    rotulo="Altura do vídeo"
                    min={-Math.round(canvasH * 0.25)}
                    max={Math.round(canvasH * 0.35)}
                    valor={g.espacoTopo}
                    formatar={(v) => `${v > 0 ? '+' : ''}${v}px`}
                    padrao={0}
                    mudar={(v) => mudar('espacoTopo', v)}
                  />

                  <Opcao
                    rotulo="Sem bordas"
                    descricao={g.encaixe === 'template' ? 'Preenche o quadro todo cortando sobras' : 'Vídeo de ponta a ponta na largura'}
                    valor={g.semBordas}
                    mudar={(v) => mudar('semBordas', v)}
                  />
                </div>

                {/* Seção Recolhível: Ajustes do Corte Individual (se Solto) */}
                {g.encaixe === 'video' && (
                  <CartaoRecolhivel
                    titulo="Ajustes Manuais do Corte"
                    resumo={vAtivo ? `${vAtivo.posicao.escala}%` : undefined}
                    aberto={subAjustesAberto}
                    alternar={() => setSubAjustesAberto((x) => !x)}
                  >
                    <Slider
                      rotulo="Tamanho (Zoom)"
                      min={20}
                      max={300}
                      valor={vAtivo?.posicao.escala ?? 100}
                      formatar={(x) => `${x}%`}
                      padrao={100}
                      mudar={(x) => aplicarAjusteVideo((y) => ({ posicao: { ...y.posicao, escala: x } }))}
                    />
                    <div className={s.grade2}>
                      <Slider
                        rotulo="Horizontal"
                        min={-Math.round(canvasW / 2)}
                        max={Math.round(canvasW / 2)}
                        valor={vAtivo?.posicao.x ?? 0}
                        padrao={0}
                        mudar={(x) => aplicarAjusteVideo((y) => ({ posicao: { ...y.posicao, x } }))}
                      />
                      <Slider
                        rotulo="Vertical"
                        min={-Math.round(canvasH / 2)}
                        max={Math.round(canvasH / 2)}
                        valor={vAtivo?.posicao.y ?? 0}
                        padrao={0}
                        mudar={(x) => aplicarAjusteVideo((y) => ({ posicao: { ...y.posicao, y: x } }))}
                      />
                    </div>
                    <Opcao
                      rotulo="Espelhar corte"
                      valor={vAtivo?.espelhar ?? false}
                      mudar={(x) => aplicarAjusteVideo(() => ({ espelhar: x }))}
                    />
                    <Opcao
                      rotulo="Tirar áudio deste corte"
                      valor={vAtivo?.mudo ?? false}
                      mudar={(x) => aplicarAjusteVideo(() => ({ mudo: x }))}
                    />
                  </CartaoRecolhivel>
                )}

                {/* Seção Recolhível: Remover Template Antigo */}
                {!p.isYouTube && (
                  <CartaoRecolhivel
                    titulo="Remover Template Antigo"
                    resumo={{ auto: 'Automático', margem: 'Margem 5%', nenhuma: 'Desligado' }[g.deteccao.modo]}
                    aberto={subLimpezaAberto}
                    alternar={() => setSubLimpezaAberto((x) => !x)}
                  >
                    <Segmentado
                      valor={g.deteccao.modo}
                      mudar={(v) => mudar('deteccao', { ...g.deteccao, modo: v })}
                      opcoes={[
                        { valor: 'auto', rotulo: 'Automático' },
                        { valor: 'margem', rotulo: 'Margem 5%' },
                        { valor: 'nenhuma', rotulo: 'Desligado' },
                      ]}
                    />
                    {g.deteccao.modo === 'auto' && (
                      <Opcao
                        rotulo="Cortar texto em cima do vídeo"
                        descricao="Se o título antigo estiver escrito sobre o vídeo, corta logo abaixo"
                        valor={g.deteccao.cortarTexto}
                        mudar={(v) => mudar('deteccao', { ...g.deteccao, cortarTexto: v })}
                      />
                    )}
                    <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.redetectarTodos} disabled={!p.totalVideos}>
                      <Icone nome="refresh" tamanho={14} /> Redetectar em todos os cortes
                    </button>
                  </CartaoRecolhivel>
                )}
              </>
            )}

            {/* ================= CARD 2: TEXTO & GANCHOS ================= */}
            {ferramentaAtiva === 'texto' && (
              <div className={s.cartaoGrupo}>
                <span className={s.cartaoGrupoTitulo}>Textos em Massa</span>
                <textarea
                  className={s.textarea}
                  placeholder={'Um título por linha, na ordem dos vídeos\nTítulo do corte 1\nTítulo do corte 2'}
                  value={massa}
                  onChange={(e) => setMassa(e.target.value)}
                  rows={4}
                />
                <div className={s.linha} style={{ gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnPequeno} ${s.btnPrimario}`}
                    onClick={() => {
                      const linhas = massa.split('\n').map((l) => l.trim()).filter(Boolean);
                      if (linhas.length) p.aplicarTextosEmMassa(linhas);
                    }}
                    disabled={!massa.trim()}
                  >
                    Aplicar linhas
                  </button>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnPequeno} ${s.btnFantasma}`}
                    onClick={inserirEmojisContextuais}
                    title="Detecta o contexto da frase e insere 1 a 2 emojis condizentes"
                  >
                    <Icone nome="sparkles" tamanho={13} /> Sugerir emojis
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Slider
                    rotulo="Tamanho da fonte"
                    min={16}
                    max={96}
                    valor={et.tamanho}
                    formatar={(v) => `${v}px`}
                    mudar={(v) => mudarTexto({ tamanho: v })}
                  />
                </div>
              </div>
            )}

            {/* ================= CARD 3: LEGENDAS ANIMADAS ================= */}
            {ferramentaAtiva === 'legendas' && (
              <div className={s.cartaoGrupo}>
                <Opcao
                  rotulo="Legenda ativada"
                  descricao="Legendas animadas sincronizadas com a fala de cada corte"
                  valor={leg.ativo}
                  mudar={(v) => mudar('legendas', { ...leg, ativo: v })}
                />

                {leg.ativo && (
                  <>
                    <Campo rotulo="Fonte da legenda">
                      <select
                        id="legenda-fonte"
                        className={s.select}
                        value={leg.fonte || 'Montserrat'}
                        onChange={(e) => mudar('legendas', { ...leg, fonte: e.target.value })}
                      >
                        {['Montserrat', 'Anton', 'Roboto', 'DejaVu Sans', 'Inter', 'Impact', 'Arial', 'Bebas Neue', 'Poppins'].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo rotulo="Cor da legenda">
                      <div className={s.gradeCores}>
                        {[
                          { nome: 'Branco', hex: '#FFFFFF' },
                          { nome: 'Amarelo', hex: '#FACC15' },
                          { nome: 'Ciano', hex: '#22D3EE' },
                          { nome: 'Rosa', hex: '#F472B6' },
                          { nome: 'Verde', hex: '#22C55E' },
                          { nome: 'Laranja', hex: '#FB923C' },
                        ].map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            className={`${s.btnCor} ${(leg.corTexto || '#FFFFFF').toUpperCase() === c.hex ? s.btnCorAtiva : ''}`}
                            onClick={() => mudar('legendas', { ...leg, corTexto: c.hex })}
                            title={c.nome}
                          >
                            <span className={s.amostraCor} style={{ background: c.hex, border: c.hex === '#FFFFFF' ? '1px solid #444' : 'none' }} />
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    </Campo>

                    <Opcao
                      rotulo="Borda destacada (contorno)"
                      descricao="Borda preta em volta das palavras para facilitar leitura"
                      valor={leg.borda ?? true}
                      mudar={(v) => mudar('legendas', { ...leg, borda: v })}
                    />

                    <Opcao
                      rotulo="Sombra projetada"
                      descricao="Sombra escura suave atrás da legenda"
                      valor={leg.sombra ?? true}
                      mudar={(v) => mudar('legendas', { ...leg, sombra: v })}
                    />

                    <Opcao
                      rotulo="Caixa de fundo"
                      descricao="Pílula ou caixa de fundo atrás da legenda"
                      valor={leg.fundo ?? false}
                      mudar={(v) => mudar('legendas', { ...leg, fundo: v })}
                    />

                    <Slider
                      rotulo="Altura na tela"
                      min={20}
                      max={92}
                      valor={leg.posicaoY}
                      formatar={(v) => `${v}%`}
                      padrao={75}
                      mudar={(v) => mudar('legendas', { ...leg, posicaoY: v })}
                    />
                  </>
                )}
              </div>
            )}

            {/* ================= CARD 4: ÁUDIO & MÚSICA ================= */}
            {ferramentaAtiva === 'musica' && (
              <>
                <div className={s.cartaoGrupo}>
                  <span className={s.cartaoGrupoTitulo}>Volume Original</span>
                  <Slider
                    rotulo="Volume do áudio do vídeo"
                    min={0}
                    max={200}
                    valor={volOriginal}
                    formatar={(v) => (v === 0 ? 'Sem áudio' : `${v}%`)}
                    padrao={100}
                    mudar={(v) => mudar('musica', { ...g.musica, mutarOriginal: false, volumeVideo: v })}
                  />
                </div>

                <div className={s.cartaoGrupo}>
                  <span className={s.cartaoGrupoTitulo}>Trilha Sonora</span>
                  <div className={s.lista}>
                    {p.musicas.map((m) => (
                      <div
                        key={m.id}
                        className={`${s.musicaItem} ${m.id === g.musica.musicaId ? s.musicaAtiva : ''}`}
                        onClick={() =>
                          p.mudarGlobal((x) => ({
                            ...x,
                            musica: { ...x.musica, ativo: x.musica.musicaId !== m.id, musicaId: x.musica.musicaId === m.id ? null : m.id, inicio: 0 },
                          }))
                        }
                        title={m.id === g.musica.musicaId ? 'Clique para tirar a música' : 'Usar esta música'}
                        style={{ cursor: 'pointer' }}
                      >
                        <Icone nome="musica" tamanho={14} />
                        <span title={m.nome}>{m.nome}</span>
                        <span className={s.dica}>{m.upload < 1 ? `${Math.round(m.upload * 100)}%` : m.duracao ? `${Math.round(m.duracao)}s` : ''}</span>
                        <button
                          type="button"
                          className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno} ${s.btnIcone}`}
                          style={{ width: 24, height: 24 }}
                          title="Remover"
                          onClick={(e) => {
                            e.stopPropagation();
                            p.removerMusica(m.id);
                          }}
                        >
                          <Icone nome="x" tamanho={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={s.linha} style={{ gap: 8, marginTop: 4 }}>
                    <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.importarMusicas}>
                      <Icone nome="mais" tamanho={14} /> Importar música
                    </button>
                    {p.abrirBibliotecaMusicas && (
                      <button type="button" className={`${s.btn} ${s.btnPequeno} ${s.btnFantasma}`} onClick={p.abrirBibliotecaMusicas}>
                        Biblioteca
                      </button>
                    )}
                  </div>

                  {musicaSel && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Slider
                        rotulo="Começar em"
                        min={0}
                        max={Math.max(1, Math.floor(musicaSel.duracao || 60))}
                        valor={g.musica.inicio}
                        formatar={(v) => `${v}s`}
                        mudar={(v) => mudar('musica', { ...g.musica, inicio: v })}
                      />
                      <Slider
                        rotulo="Volume da música"
                        min={0}
                        max={200}
                        valor={g.musica.volumeMusica}
                        formatar={(v) => `${v}%`}
                        padrao={30}
                        mudar={(v) => mudar('musica', { ...g.musica, volumeMusica: v })}
                      />
                      <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={ouvir}>
                        <Icone nome={tocando ? 'parar' : 'play'} tamanho={13} /> {tocando ? 'Parar' : 'Ouvir 10s'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ================= CARD 5: EFEITOS & DINÂMICA ================= */}
            {ferramentaAtiva === 'efeitos' && (
              <div className={s.cartaoGrupo}>
                <Opcao
                  rotulo="Remover silêncios"
                  descricao="Corta as pausas sem fala, mantendo ritmo dinâmico sincronizado com a legenda"
                  valor={!!g.efeitos.removerSilencio}
                  mudar={(v) => mudar('efeitos', { ...g.efeitos, removerSilencio: v })}
                />
                <Opcao
                  rotulo="Espelhar vídeo"
                  descricao="Inverte horizontalmente para variação de corte"
                  valor={g.efeitos.espelhar}
                  mudar={(v) => mudar('efeitos', { ...g.efeitos, espelhar: v })}
                />
                <Opcao
                  rotulo="Cortar início e fim"
                  descricao="Tira 0,5s de cada ponta para corte imediato"
                  valor={g.efeitos.cortarInicioFim}
                  mudar={(v) => mudar('efeitos', { ...g.efeitos, cortarInicioFim: v })}
                />
                <Opcao
                  rotulo="Ajuste automático de cor"
                  descricao="Realça contraste e saturação suavemente"
                  valor={g.efeitos.ajusteAutomatico}
                  mudar={(v) => mudar('efeitos', { ...g.efeitos, ajusteAutomatico: v })}
                />
              </div>
            )}

            {/* ================= CARD 6: EXPORTAÇÃO ================= */}
            {ferramentaAtiva === 'exportar' && (
              <div className={s.cartaoGrupo}>
                <Campo rotulo="Qualidade do Vídeo">
                  <Segmentado
                    valor={g.qualidade}
                    mudar={(v: Qualidade) => mudar('qualidade', v)}
                    opcoes={[
                      { valor: 480, rotulo: '480p' },
                      { valor: 720, rotulo: '720p' },
                      { valor: 1080, rotulo: '1080p HD' },
                    ]}
                  />
                </Campo>
                <Opcao
                  rotulo="Anti-duplicidade"
                  descricao="Micro variações únicas por vídeo (zoom, velocidade, bitrate, FPS)"
                  valor={g.antiDup}
                  mudar={(v) => mudar('antiDup', v)}
                />
                <Opcao
                  rotulo="Melhorar áudio"
                  descricao="Remove ruído e normaliza o volume de todos os cortes"
                  valor={g.melhorarAudio}
                  mudar={(v) => mudar('melhorarAudio', v)}
                />

                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimario}`}
                  style={{
                    width: '100%',
                    marginTop: 14,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    cursor: 'pointer',
                  }}
                  onClick={p.aoProcessar}
                  disabled={!p.totalVideos || p.processando}
                >
                  <Icone nome={p.processando ? 'refresh' : 'play'} tamanho={15} />
                  <span>{p.processando ? 'Processando vídeos…' : p.totalVideos > 0 ? `Exportar todos os vídeos (${p.totalVideos})` : 'Exportar todos os vídeos'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Rodapé Fixo da Gaveta: Aplicar a todos */}
          <div className={s.barraMassaFixa}>
            <div className={s.massaInfo}>
              <span className={s.massaTitulo}>Aplicar a todos</span>
              <span className={s.massaDesc}>
                {p.emMassa ? 'Ajustes valem para todos os cortes' : 'Ajustes valem apenas para este corte'}
              </span>
            </div>
            <Toggle
              valor={p.emMassa}
              mudar={p.setEmMassa}
              rotulo="Aplicar a todos"
            />
          </div>
        </div>
      )}
    </aside>
  );
}
