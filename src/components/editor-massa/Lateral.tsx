'use client';

import { useRef, useState, type ReactNode } from 'react';
import type { ConfigGlobal, Qualidade } from '@/lib/editor-massa/types';
import { PRESETS_LEGENDA } from '@/lib/editor-massa/defaults';
import { Campo, Opcao, Segmentado, Slider, Toggle } from './campos';
import type { MusicaCliente, TemplateCliente } from './estado';
import { Icone, type NomeIcone } from './icones';
import s from './editor-massa.module.css';

export interface PropsLateral {
  global: ConfigGlobal;
  mudarGlobal: (fn: (g: ConfigGlobal) => ConfigGlobal) => void;
  template: TemplateCliente | null;
  /** @ / nome do perfil do template Clipost */
  perfilTemplate: string;
  carregandoTemplate: boolean;
  editarTemplate: () => void;
  musicas: MusicaCliente[];
  importarMusicas: () => void;
  removerMusica: (id: string) => void;
  totalVideos: number;
  aplicarTextosEmMassa: (linhas: string[]) => void;
  redetectarTodos: () => void;
}

type IdSecao = 'template' | 'limpeza' | 'texto' | 'legendas' | 'musica' | 'efeitos' | 'exportar';

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
  const [abertas, setAbertas] = useState<Set<IdSecao>>(() => new Set<IdSecao>(['template']));
  const [massa, setMassa] = useState('');
  const [tocando, setTocando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

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

  const et = g.estiloTexto;
  const mudarTexto = (parcial: Partial<typeof et>) => mudar('estiloTexto', { ...et, ...parcial });
  // Tamanho/posição mexidos à mão: o template não sobrescreve mais
  const ajustarTexto = (parcial: Partial<typeof et>) => p.mudarGlobal((x) => ({ ...x, textoAjustado: true, estiloTexto: { ...x.estiloTexto, ...parcial } }));
  const canvasH = g.moldura.ativo ? g.moldura.altura : (p.template?.imagem.naturalHeight ?? 1920);
  const musicaSel = p.musicas.find((m) => m.id === g.musica.musicaId);
  const volOriginal = g.musica.mutarOriginal ? 0 : g.musica.volumeVideo;
  const leg = g.legendas ?? { ativo: false, preset: 'hormozi_yellow', posicaoY: 75 };
  const velocidade = g.efeitos.velocidadePersonalizada ? 'custom' : g.efeitos.velocidade105 ? '105' : '1';
  const efeitosAtivos = [
    g.efeitos.removerSilencio && 'Sem silêncios',
    g.efeitos.espelhar && 'Espelhado',
    g.efeitos.cortarInicioFim && 'Corta 0,5s',
    g.efeitos.ajusteAutomatico && 'Cor auto',
    velocidade !== '1' && `${velocidade === '105' ? 1.05 : g.efeitos.velocidade}x`,
  ].filter(Boolean);

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

  return (
    <aside className={s.lateral}>
      {/* ---------------- TEMPLATE ---------------- */}
      <Secao
        {...comum}
        id="template"
        icone="layout"
        titulo="Template e layout"
        resumo={p.carregandoTemplate ? 'Carregando…' : p.perfilTemplate || 'Seu template'}
        aberta={abertas.has('template')}
      >
        <div className={s.templateCard} role="button" tabIndex={0} onClick={p.editarTemplate} onKeyDown={(e) => e.key === 'Enter' && p.editarTemplate()}>
          <span className={s.templateMini} style={p.template ? { backgroundImage: `url(${p.template.url})` } : undefined}>
            {!p.template && <Icone nome="imagem" />}
          </span>
          <span className={s.templateInfo}>
            <span className={s.templateNome}>{p.carregandoTemplate ? 'Carregando seu template…' : p.perfilTemplate || 'Seu template'}</span>
            <span className={s.dica}>Fundo, perfil, título e marca d'água do editor de Templates</span>
          </span>
        </div>
        <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.editarTemplate} disabled={p.carregandoTemplate}>
          <Icone nome="layout" tamanho={14} /> Editar template
        </button>

        <Campo rotulo="Encaixe do vídeo">
          <Segmentado
            valor={g.encaixe}
            mudar={(v) => mudar('encaixe', v)}
            opcoes={[
              { valor: 'template', rotulo: 'No quadro do template', titulo: 'O vídeo ocupa o quadro de vídeo do seu template' },
              { valor: 'video', rotulo: 'Solto', titulo: 'O vídeo fica no formato dele, abaixo do perfil' },
            ]}
          />
        </Campo>
        <Slider
          rotulo="Espaço no topo"
          min={-Math.round(canvasH * 0.2)}
          max={Math.round(canvasH * 0.3)}
          valor={g.espacoTopo}
          formatar={(v) => `${v > 0 ? '+' : ''}${v}px`}
          padrao={0}
          mudar={(v) => mudar('espacoTopo', v)}
        />
        <Opcao
          rotulo="Sem bordas"
          descricao={g.encaixe === 'template' ? 'Preenche o quadro todo, cortando o que sobrar' : 'Vídeo de ponta a ponta na largura'}
          valor={g.semBordas}
          mudar={(v) => mudar('semBordas', v)}
        />
      </Secao>

      {/* ---------------- LIMPEZA ---------------- */}
      <Secao
        {...comum}
        id="limpeza"
        icone="vassoura"
        titulo="Remover template antigo"
        resumo={{ auto: 'Automático', margem: 'Só margem de 5%', nenhuma: 'Desligado' }[g.deteccao.modo]}
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
          Se o vídeo já vier dentro de outro template, detectamos onde o vídeo está e só essa parte entra no seu template. Use
          "Ver original" no preview para conferir. Mudou a opção? Clique em "Detectar de novo".
        </span>
        <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={p.redetectarTodos} disabled={!p.totalVideos}>
          <Icone nome="refresh" tamanho={14} /> Detectar de novo em todos
        </button>
      </Secao>

      {/* ---------------- TEXTO ---------------- */}
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
            placeholder={'Um texto por linha, na ordem dos vídeos\nTexto do vídeo 1\nTexto do vídeo 2'}
            value={massa}
            onChange={(e) => setMassa(e.target.value)}
          />
        </Campo>
        <button
          type="button"
          className={`${s.btn} ${s.btnPequeno}`}
          disabled={!massa.trim() || !p.totalVideos}
          onClick={() => p.aplicarTextosEmMassa(massa.split(/\r?\n/).filter((l) => l.trim()))}
        >
          <Icone nome="check" tamanho={14} /> Aplicar nos {p.totalVideos} vídeos
        </button>
        <span className={s.dica}>Ou digite direto no campo abaixo de cada vídeo.</span>

        <span className={s.dica}>Fonte, cor, contorno e maiúsculas vêm do seu template (botão "Editar template").</span>
        <Opcao rotulo="Emojis no texto" valor={!et.semEmojis} mudar={(v) => mudarTexto({ semEmojis: !v })} />
        <Slider rotulo="Tamanho" min={12} max={160} valor={et.tamanho} formatar={(v) => `${v}px`} mudar={(v) => ajustarTexto({ tamanho: v })} />

        <div className={s.subtitulo}>Posição da caixa (%)</div>
        <div className={s.grade2}>
          <Slider rotulo="Horizontal" min={0} max={100} valor={et.posicao.x} formatar={(v) => `${v}%`} mudar={(v) => ajustarTexto({ posicao: { ...et.posicao, x: v } })} />
          <Slider rotulo="Vertical" min={0} max={100} valor={et.posicao.y} formatar={(v) => `${v}%`} mudar={(v) => ajustarTexto({ posicao: { ...et.posicao, y: v } })} />
          <Slider rotulo="Largura" min={5} max={100} valor={et.posicao.w} formatar={(v) => `${v}%`} mudar={(v) => ajustarTexto({ posicao: { ...et.posicao, w: v } })} />
          <Slider rotulo="Altura" min={2} max={100} valor={et.posicao.h} formatar={(v) => `${v}%`} mudar={(v) => ajustarTexto({ posicao: { ...et.posicao, h: v } })} />
        </div>
        <Slider rotulo="Opacidade" min={0} max={100} valor={et.opacidade} formatar={(v) => `${v}%`} padrao={100} mudar={(v) => mudarTexto({ opacidade: v })} />
        {g.textoAjustado && (
          <button type="button" className={`${s.btn} ${s.btnFantasma} ${s.btnPequeno}`} onClick={() => mudar('textoAjustado', false)}>
            <Icone nome="reset" tamanho={13} /> Voltar ao tamanho e posição do template
          </button>
        )}
      </Secao>

      {/* ---------------- LEGENDAS ---------------- */}
      <Secao
        {...comum}
        id="legendas"
        icone="texto"
        titulo="Legendas automáticas"
        resumo={leg.ativo ? (PRESETS_LEGENDA.find((x) => x.id === leg.preset)?.nome ?? leg.preset) : 'Desligadas'}
        ligado={leg.ativo}
        mudarLigado={ligar('legendas', () => mudar('legendas', { ...leg, ativo: !leg.ativo }))}
        aberta={abertas.has('legendas')}
      >
        <span className={s.dica}>
          A fala de cada vídeo é transcrita e vira legenda animada, já sincronizada com cortes, silêncios removidos e velocidade.
          Cortes do Criar Cortes já vêm legendados.
        </span>
        <Campo rotulo="Estilo">
          <select id="legenda-preset" className={s.select} value={leg.preset} onChange={(e) => mudar('legendas', { ...leg, preset: e.target.value })}>
            {PRESETS_LEGENDA.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Slider rotulo="Altura na tela" min={20} max={92} valor={leg.posicaoY} formatar={(v) => `${v}%`} padrao={75} mudar={(v) => mudar('legendas', { ...leg, posicaoY: v })} />
      </Secao>

      {/* ---------------- MÚSICA ---------------- */}
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
                // clicar na música ativa tira a música; clicar em outra troca
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

      {/* ---------------- EFEITOS ---------------- */}
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
        <Campo rotulo="Velocidade">
          <Segmentado
            valor={velocidade}
            mudar={(v) =>
              mudar('efeitos', {
                ...g.efeitos,
                velocidade105: v === '105',
                velocidadePersonalizada: v === 'custom',
              })
            }
            opcoes={[
              { valor: '1', rotulo: 'Normal' },
              { valor: '105', rotulo: '1,05x' },
              { valor: 'custom', rotulo: 'Personalizada' },
            ]}
          />
        </Campo>
        {velocidade === 'custom' && (
          <Slider
            rotulo="Velocidade"
            min={0.5}
            max={2}
            passo={0.05}
            valor={g.efeitos.velocidade}
            formatar={(v) => `${v.toFixed(2)}x`}
            padrao={1}
            mudar={(v) => mudar('efeitos', { ...g.efeitos, velocidade: v })}
          />
        )}
      </Secao>

      {/* ---------------- EXPORTAÇÃO ---------------- */}
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
        {g.antiDup && (
          <Segmentado
            valor={g.antiDupNivel}
            mudar={(v) => mudar('antiDupNivel', v)}
            opcoes={[
              { valor: 'leve', rotulo: 'Leve', titulo: 'Zoom, velocidade, bitrate e FPS' },
              { valor: 'forte', rotulo: 'Forte', titulo: '+ cor, ruído, nitidez e GOP' },
            ]}
          />
        )}
        <Opcao rotulo="Melhorar áudio" descricao="Remove ruído e normaliza o volume" valor={g.melhorarAudio} mudar={(v) => mudar('melhorarAudio', v)} />
        <Opcao rotulo="Remover metadados" valor={g.removerMetadados} mudar={(v) => mudar('removerMetadados', v)} />
      </Secao>
    </aside>
  );
}
