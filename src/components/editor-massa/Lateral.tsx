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
  const [abertas, setAbertas] = useState<Set<IdSecao>>(() => new Set<IdSecao>(['template', 'legendas']));
  const [massa, setMassa] = useState('');
  const [tocando, setTocando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  // Redimensionamento e recolhimento da barra lateral
  const [largura, setLargura] = useState(330);
  const [recolhido, setRecolhido] = useState(false);
  const redimensionando = useRef(false);

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

  const corFundoAtual = (p.tplClipost?.config?.templateBg as 'dark' | 'white' | 'gray') || 'dark';

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
    return (
      <button
        type="button"
        className={s.btnExpandirLateral}
        onClick={() => setRecolhido(false)}
        title="Expandir painel de edições"
      >
        <Icone nome="chevron" tamanho={14} style={{ transform: 'rotate(-90deg)' }} />
        Editar
      </button>
    );
  }

  return (
    <aside className={s.lateral} style={{ width: largura }}>
      {/* Alça para redimensionar arrastando para a direita */}
      <div className={s.alcaResize} onPointerDown={iniciarResize} title="Arraste para redimensionar" />

      {/* Botão de recolher o painel */}
      <button
        type="button"
        className={s.btnRecolher}
        onClick={() => setRecolhido(true)}
        title="Recolher painel"
      >
        <Icone nome="chevron" tamanho={13} style={{ transform: 'rotate(90deg)' }} />
      </button>

      {/* ---------------- 1. TEMPLATE E LAYOUT (SÓ COR DO FUNDO + ENCAIXE + SEM BORDAS + TOPO) ---------------- */}
      <Secao
        {...comum}
        id="template"
        icone="layout"
        titulo="Template e layout"
        resumo={p.carregandoTemplate ? 'Carregando…' : corFundoAtual === 'white' ? 'Fundo Branco' : corFundoAtual === 'gray' ? 'Fundo Cinza' : 'Fundo Preto'}
        aberta={abertas.has('template')}
      >
        {/* Cor do Fundo do Template (Preto, Branco, Cinza) */}
        <Campo rotulo="Cor do fundo">
          <div className={s.gradeCores}>
            <button
              type="button"
              className={`${s.btnCor} ${corFundoAtual === 'dark' ? s.btnCorAtiva : ''}`}
              onClick={() => p.mudarTemplate?.({ templateBg: 'dark' })}
              title="Fundo Preto"
            >
              <span className={s.amostraCor} style={{ background: '#000000' }} />
              Preto
            </button>
            <button
              type="button"
              className={`${s.btnCor} ${corFundoAtual === 'white' ? s.btnCorAtiva : ''}`}
              onClick={() => p.mudarTemplate?.({ templateBg: 'white' })}
              title="Fundo Branco"
            >
              <span className={s.amostraCor} style={{ background: '#ffffff' }} />
              Branco
            </button>
            <button
              type="button"
              className={`${s.btnCor} ${corFundoAtual === 'gray' ? s.btnCorAtiva : ''}`}
              onClick={() => p.mudarTemplate?.({ templateBg: 'gray' })}
              title="Fundo Cinza"
            >
              <span className={s.amostraCor} style={{ background: '#18181b' }} />
              Cinza
            </button>
          </div>
        </Campo>

        {/* Encaixe do Vídeo: Fixo no template vs Solto */}
        <Campo rotulo="Encaixe do vídeo">
          <Segmentado
            valor={g.encaixe}
            mudar={(v) => mudar('encaixe', v)}
            opcoes={[
              { valor: 'template', rotulo: 'Fixo no template', titulo: 'O vídeo ocupa o quadro fixo do seu template' },
              { valor: 'video', rotulo: 'Solto', titulo: 'O vídeo fica solto, permitindo ajuste de tamanho e posição' },
            ]}
          />
        </Campo>

        {/* Espaço no topo: desloca o vídeo verticalmente sem alterar a escala */}
        <Slider
          rotulo="Espaço no topo"
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
        resumo={leg.ativo ? (PRESETS_LEGENDA.find((x) => x.id === leg.preset)?.nome ?? 'Ativa') : 'Desligada'}
        ligado={leg.ativo}
        mudarLigado={ligar('legendas', () => mudar('legendas', { ...leg, ativo: !leg.ativo }))}
        aberta={abertas.has('legendas')}
      >
        <span className={s.dica}>
          Legendas animadas sincronizadas com a fala de cada corte, estilo Shorts e Reels virais.
        </span>
        <Campo rotulo="Estilo da legenda">
          <select
            id="legenda-preset"
            className={s.select}
            value={leg.preset}
            onChange={(e) => mudar('legendas', { ...leg, preset: e.target.value })}
          >
            {PRESETS_LEGENDA.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Slider
          rotulo="Altura na tela"
          min={20}
          max={92}
          valor={leg.posicaoY}
          formatar={(v) => `${v}%`}
          padrao={75}
          mudar={(v) => mudar('legendas', { ...leg, posicaoY: v })}
        />
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
        resumo={g.textoAtivo ? `Estilo do template · ${et.tamanho}px` : 'Desligado'}
        ligado={g.textoAtivo}
        mudarLigado={ligar('texto', () => mudar('textoAtivo', !g.textoAtivo))}
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
        titulo="Música e áudio"
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
      </Secao>

      {/* ---------------- BARRA INFERIOR: EDIÇÃO EM MASSA (SIM / NÃO) ---------------- */}
      <div className={s.barraMassaFixa}>
        <div className={s.massaInfo}>
          <span className={s.massaTitulo}>Edição em massa em todos os vídeos</span>
          <span className={s.massaDesc}>
            {p.emMassa ? 'Ajustes valem para todos os cortes' : 'Ajustes valem apenas para o vídeo selecionado'}
          </span>
        </div>
        <div style={{ width: 100 }}>
          <Segmentado
            valor={p.emMassa ? 'sim' : 'nao'}
            mudar={(v) => p.setEmMassa(v === 'sim')}
            opcoes={[
              { valor: 'sim', rotulo: 'Sim' },
              { valor: 'nao', rotulo: 'Não' },
            ]}
          />
        </div>
      </div>
    </aside>
  );
}
