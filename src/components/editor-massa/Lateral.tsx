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

type IdSecao = 'template' | 'ajustes' | 'limpeza' | 'texto' | 'legendas' | 'musica' | 'efeitos' | 'exportar';

function Secao(p: {
  id: IdSecao;
  icone: NomeIcone;
  titulo: string;
  resumo?: string;
  ligado?: boolean;
  mudarLigado?: (v: boolean) => void;
  aberta: boolean;
  alternar: (id: IdSecao) => void;
  children: ReactNode;
}) {
  const ativo = p.mudarLigado ? p.ligado : true;
  return (
    <section className={`${s.secao} ${ativo ? s.secaoLigada : ''}`}>
      <div className={s.secaoCabeca} role="button" tabIndex={0} onClick={() => p.alternar(p.id)} onKeyDown={(e) => e.key === 'Enter' && p.alternar(p.id)}>
        <span className={s.secaoIcone}>
          <Icone nome={p.icone} />
        </span>
        <span className={s.secaoTitulo}>
          {p.titulo}
          {p.resumo && <span className={s.secaoResumo}>{p.resumo}</span>}
        </span>
        {p.mudarLigado && <Toggle valor={!!p.ligado} mudar={p.mudarLigado} rotulo={p.titulo} />}
        <Icone nome="chevron" className={`${s.seta} ${p.aberta ? s.setaAberta : ''}`} />
      </div>
      {p.aberta && <div className={s.secaoCorpo}>{p.children}</div>}
    </section>
  );
}

export default function Lateral(p: PropsLateral) {
  const g = p.global;
  const [abertas, setAbertas] = useState<Set<IdSecao>>(() => new Set<IdSecao>());
  const [massa, setMassa] = useState('');
  const [tocando, setTocando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  // Redimensionamento e recolhimento da barra lateral (controlado via props ou local)
  const [larguraLocal, setLarguraLocal] = useState(330);
  const [recolhidoLocal, setRecolhidoLocal] = useState(false);
  const largura = p.largura ?? larguraLocal;
  const setLargura = p.setLargura ?? setLarguraLocal;
  const recolhido = p.recolhido ?? recolhidoLocal;
  const setRecolhido = p.setRecolhido ?? setRecolhidoLocal;
  const redimensionando = useRef(false);
  const inputCorRef = useRef<HTMLInputElement>(null);

  const alternar = (id: IdSecao) =>
    setAbertas((a) => {
      const n = new Set(a);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const abrir = (id: IdSecao) => setAbertas((a) => new Set(a).add(id));
  const mudar = <K extends keyof ConfigGlobal>(k: K, v: ConfigGlobal[K]) => p.mudarGlobal((x) => ({ ...x, [k]: v }));
  const ligar = (id: IdSecao, fn: () => void) => (v: boolean) => {
    fn();
    if (v) abrir(id);
  };

  // Aplicação de ajustes (individual ou em massa)
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
  const leg = g.legendas ?? { ativo: true, preset: 'hormozi_amarelo', posicaoY: 75 };
  const musicaSel = p.musicas.find((m) => m.id === g.musica.musicaId);
  const volOriginal = g.musica.mutarOriginal ? 0 : g.musica.volumeVideo;
  const velocidade = g.efeitos.velocidadePersonalizada ? 'custom' : g.efeitos.velocidade105 ? '105' : '1';
  const efeitosAtivos = [
    g.efeitos.removerSilencio && 'Sem silêncios',
    g.efeitos.espelhar && 'Espelhado',
    g.efeitos.cortarInicioFim && 'Corta 0,5s',
    g.efeitos.ajusteAutomatico && 'Cor auto',
    velocidade !== '1' && `${velocidade === '105' ? 1.05 : g.efeitos.velocidade}x`,
  ].filter(Boolean);

  const corFundoRaw = String(p.tplClipost?.config?.templateBg || 'dark');
  const corFundoAtual = corFundoRaw;
  const ehDark = corFundoRaw === 'dark' || corFundoRaw === '#000000';
  const ehWhite = corFundoRaw === 'white' || corFundoRaw.toLowerCase() === '#ffffff';
  const ehGray = corFundoRaw === 'gray' || corFundoRaw === 'zinc' || corFundoRaw.toLowerCase() === '#18181b';
  const ehCustom = !ehDark && !ehWhite && !ehGray;
  const corHexAtual = ehDark ? '#000000' : ehWhite ? '#ffffff' : ehGray ? '#18181b' : (corFundoRaw.startsWith('#') ? corFundoRaw : '#6366f1');

  // Redimensionar por arrasto na borda direita
  const iniciarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    redimensionando.current = true;
    const startX = e.clientX;
    const startW = largura;

    const onMove = (ev: PointerEvent) => {
      if (!redimensionando.current) return;
      const novo = Math.max(280, Math.min(500, startW + (ev.clientX - startX)));
      setLargura(novo);
    };

    const onUp = () => {
      redimensionando.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Sugestão de Emojis Contextuais inteligentes baseados no conteúdo do texto
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

  const comum = { alternar };

  if (recolhido) {
    return null;
  }

  return (
    <aside className={s.lateral} style={{ width: '100%', position: 'relative' }}>
      {/* Alça para redimensionar arrastando para a direita */}
      <div className={s.alcaResize} onPointerDown={iniciarResize} title="Arraste para ajustar a largura da barra lateral" />

      

      {/* ---------------- 1. TEMPLATE E LAYOUT (SÓ COR DO FUNDO + ENCAIXE + SEM BORDAS + TOPO) ---------------- */}
      <Secao
        {...comum}
        id="template"
        icone="layout"
        titulo="Template"
        resumo={p.carregandoTemplate ? 'Carregando…' : corFundoAtual === 'white' ? 'Fundo Branco' : corFundoAtual === 'gray' ? 'Fundo Cinza' : 'Fundo Preto'}
        aberta={abertas.has('template')}
      >
        {/* Cor do Fundo do Template (Preto, Branco, Cinza) */}
        <Campo rotulo="Cor do fundo">
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
              title="Cor Personalizada (clique para escolher qualquer cor)"
              style={{ position: 'relative' }}
            >
              <span
                className={s.amostraCor}
                style={{
                  background: ehCustom ? corHexAtual : 'conic-gradient(from 180deg at 50% 50%, #f43f5e 0deg, #ec4899 45deg, #a855f7 90deg, #6366f1 135deg, #3b82f6 180deg, #10b981 225deg, #eab308 270deg, #f97316 315deg, #f43f5e 360deg)',
                  boxShadow: ehCustom ? '0 0 0 2px #fff' : 'none'
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
        </Campo>

        {/* Encaixe do Vídeo: Fixo no template vs Solto */}
        <Campo rotulo="Encaixe do vídeo">
          <Segmentado
            valor={g.encaixe}
            mudar={(v) => mudar('encaixe', v)}
            opcoes={[
              { valor: 'template', rotulo: 'Fixo', titulo: 'O vídeo ocupa o quadro fixo do seu template' },
              { valor: 'video', rotulo: 'Solto', titulo: 'O vídeo fica solto, permitindo ajuste de tamanho e posição' },
            ]}
          />
        </Campo>

        {/* Espaço no topo: desloca o vídeo verticalmente sem alterar a escala */}
        <Slider
          rotulo="Altura do vídeo"
          min={-Math.round(canvasH * 0.25)}
          max={Math.round(canvasH * 0.35)}
          valor={g.espacoTopo}
          formatar={(v) => `${v > 0 ? '+' : ''}${v}px`}
          padrao={0}
          mudar={(v) => mudar('espacoTopo', v)}
        />

        {/* Sem bordas */}
        <Opcao
          rotulo="Sem bordas"
          descricao={g.encaixe === 'template' ? 'Preenche o quadro todo, cortando o que sobrar' : 'Vídeo de ponta a ponta na largura'}
          valor={g.semBordas}
          mudar={(v) => mudar('semBordas', v)}
        />
      </Secao>

      {/* ---------------- 2. AJUSTES DO VÍDEO (SE SOLTO: TAMANHO, POSIÇÃO, ESPELHAR, ÁUDIO) ---------------- */}
      {g.encaixe === 'video' && (
        <Secao
          {...comum}
          id="ajustes"
          icone="ajustes"
          titulo="Ajustes do vídeo"
          resumo={vAtivo ? `${vAtivo.posicao.escala}%` : 'Tamanho e posição'}
          aberta={abertas.has('ajustes')}
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
            rotulo="Espelhar vídeo"
            valor={vAtivo?.espelhar ?? false}
            mudar={(x) => aplicarAjusteVideo(() => ({ espelhar: x }))}
          />
          <Opcao
            rotulo="Tirar áudio deste corte"
            valor={vAtivo?.mudo ?? false}
            mudar={(x) => aplicarAjusteVideo(() => ({ mudo: x }))}
          />
        </Secao>
      )}

      {/* ---------------- 3. LEGENDA DEDICADA ---------------- */}
      <Secao
        {...comum}
        id="legendas"
        icone="texto"
        titulo="Legenda"
        resumo={leg.ativo ? (leg.fonte ? `${leg.fonte} · ${leg.corTexto || '#FFF'}` : 'Ativada') : 'Desligada'}
        aberta={abertas.has('legendas')}
      >
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
      </Secao>

      {/* ---------------- 4. REMOVER TEMPLATE ANTIGO (SÓ MOSTRA SE NÃO FOR YOUTUBE) ---------------- */}
      {!p.isYouTube && (
        <Secao
          {...comum}
          id="limpeza"
          icone="vassoura"
          titulo="Remover template antigo"
          resumo={{ auto: 'Automático', margem: 'Só margem 5%', nenhuma: 'Desligado' }[g.deteccao.modo]}
          aberta={abertas.has('limpeza')}
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
              descricao="Se o título antigo estiver escrito sobre o vídeo, corta logo abaixo dele"
              valor={g.deteccao.cortarTexto}
              mudar={(v) => mudar('deteccao', { ...g.deteccao, cortarTexto: v })}
            />
          )}
          <span className={s.dica}>
            Detecta onde o vídeo original está para recortar barras e molduras antigas de feeds externos.
          </span>
          <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.redetectarTodos} disabled={!p.totalVideos}>
            <Icone nome="refresh" tamanho={14} /> Detectar de novo em todos
          </button>
        </Secao>
      )}

      {/* ---------------- 5. TEXTO DO VÍDEO (TÍTULO) & EMOJIS CONTEXTUAIS ---------------- */}
      <Secao
        {...comum}
        id="texto"
        icone="texto"
        titulo="Texto"
        resumo={`Estilo do template · ${et.tamanho}px`}
        aberta={abertas.has('texto')}
      >
        <Campo rotulo="Textos em massa">
          <textarea
            className={s.textarea}
            placeholder={'Um texto por linha, na ordem dos vídeos\nTexto do corte 1\nTexto do corte 2'}
            value={massa}
            onChange={(e) => setMassa(e.target.value)}
            rows={4}
          />
        </Campo>
        <div className={s.linha} style={{ gap: 8, marginTop: 6 }}>
          <button
            type="button"
            className={`${s.btn} ${s.btnPequeno}`}
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
        <Slider
          rotulo="Tamanho da fonte"
          min={16}
          max={96}
          valor={et.tamanho}
          formatar={(v) => `${v}px`}
          mudar={(v) => mudarTexto({ tamanho: v })}
        />
      </Secao>

      {/* ---------------- 6. MÚSICA E ÁUDIO ---------------- */}
      <Secao
        {...comum}
        id="musica"
        icone="musica"
        titulo="Áudio e música"
        resumo={[musicaSel ? musicaSel.nome : 'Sem música', `áudio original ${volOriginal}%`].join(' · ')}
        aberta={abertas.has('musica')}
      >
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
        <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.importarMusicas}>
          <Icone nome="mais" tamanho={14} /> Importar músicas
        </button>
        {p.abrirBibliotecaMusicas && (
          <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.abrirBibliotecaMusicas}>
            <Icone nome="musica" tamanho={14} /> Minhas músicas (salvas)
          </button>
        )}
        {musicaSel && (
          <>
            <Slider
              rotulo="Começar em"
              min={0}
              max={Math.max(1, Math.floor(musicaSel.duracao || 60))}
              valor={g.musica.inicio}
              formatar={(v) => `${v}s`}
              mudar={(v) => mudar('musica', { ...g.musica, inicio: v })}
            />
            <Slider rotulo="Volume da música" min={0} max={200} valor={g.musica.volumeMusica} formatar={(v) => `${v}%`} padrao={30} mudar={(v) => mudar('musica', { ...g.musica, volumeMusica: v })} />
            <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={ouvir}>
              <Icone nome={tocando ? 'parar' : 'play'} tamanho={13} /> {tocando ? 'Parar' : 'Ouvir 10s'}
            </button>
          </>
        )}
        <Slider
          rotulo="Volume do áudio original"
          min={0}
          max={200}
          valor={volOriginal}
          formatar={(v) => (v === 0 ? 'Sem áudio' : `${v}%`)}
          padrao={100}
          mudar={(v) => mudar('musica', { ...g.musica, mutarOriginal: false, volumeVideo: v })}
        />
      </Secao>

      {/* ---------------- 7. EFEITOS ---------------- */}
      <Secao
        {...comum}
        id="efeitos"
        icone="varinha"
        titulo="Efeitos"
        resumo={efeitosAtivos.length ? efeitosAtivos.join(' · ') : 'Nenhum'}
        aberta={abertas.has('efeitos')}
      >
        <Opcao
          rotulo="Remover silêncios"
          descricao="Corta as pausas sem fala (o vídeo fica mais dinâmico)"
          valor={!!g.efeitos.removerSilencio}
          mudar={(v) => mudar('efeitos', { ...g.efeitos, removerSilencio: v })}
        />
        <Opcao rotulo="Espelhar vídeo" valor={g.efeitos.espelhar} mudar={(v) => mudar('efeitos', { ...g.efeitos, espelhar: v })} />
        <Opcao
          rotulo="Cortar início e fim"
          descricao="Tira 0,5s de cada ponta"
          valor={g.efeitos.cortarInicioFim}
          mudar={(v) => mudar('efeitos', { ...g.efeitos, cortarInicioFim: v })}
        />
        <Opcao
          rotulo="Ajuste automático de cor"
          descricao="Realça contraste e saturação"
          valor={g.efeitos.ajusteAutomatico}
          mudar={(v) => mudar('efeitos', { ...g.efeitos, ajusteAutomatico: v })}
        />
      </Secao>

      {/* ---------------- 8. EXPORTAÇÃO ---------------- */}
      <Secao
        {...comum}
        id="exportar"
        icone="exportar"
        titulo="Exportação"
        resumo={[`${g.qualidade}p`, g.antiDup && 'Anti-duplicidade', g.melhorarAudio && 'Áudio melhorado'].filter(Boolean).join(' · ')}
        aberta={abertas.has('exportar')}
      >
        <Campo rotulo="Qualidade">
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
        <Opcao rotulo="Melhorar áudio" descricao="Remove ruído e normaliza o volume" valor={g.melhorarAudio} mudar={(v) => mudar('melhorarAudio', v)} />

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
      </Secao>

      {/* ---------------- BARRA INFERIOR: APLICAR A TODOS (TOGGLE PADRÃO DO SITE) ---------------- */}
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
    </aside>
  );
}
