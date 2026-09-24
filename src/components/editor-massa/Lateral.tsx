'use client';

import { useRef, useState, type ReactNode } from 'react';
import { FORMATOS_MOLDURA } from '@/lib/editor-massa/defaults';
import type { ConfigGlobal, Qualidade } from '@/lib/editor-massa/types';
import { Campo, Cores, Fonte, Opcao, Segmentado, Slider, Toggle } from './campos';
import type { MusicaCliente, TemplateCliente } from './estado';
import { Icone, type NomeIcone } from './icones';
import s from './editor-massa.module.css';

export interface PropsLateral {
  global: ConfigGlobal;
  mudarGlobal: (fn: (g: ConfigGlobal) => ConfigGlobal) => void;
  template: TemplateCliente | null;
  escolherTemplate: () => void;
  musicas: MusicaCliente[];
  importarMusicas: () => void;
  removerMusica: (id: string) => void;
  totalVideos: number;
  aplicarTextosEmMassa: (linhas: string[]) => void;
  redetectarTodos: () => void;
}

type IdSecao = 'template' | 'limpeza' | 'texto' | 'marca' | 'musica' | 'efeitos' | 'exportar';

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
  const canvasW = g.moldura.ativo ? g.moldura.largura : (p.template?.imagem.naturalWidth ?? 1080);
  const canvasH = g.moldura.ativo ? g.moldura.altura : (p.template?.imagem.naturalHeight ?? 1920);
  const musicaSel = p.musicas.find((m) => m.id === g.musica.musicaId);
  const velocidade = g.efeitos.velocidadePersonalizada ? 'custom' : g.efeitos.velocidade105 ? '105' : '1';
  const efeitosAtivos = [
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
        resumo={g.moldura.ativo ? `Cor sólida ${g.moldura.largura}×${g.moldura.altura}` : p.template ? p.template.nome : 'Nenhum template'}
        aberta={abertas.has('template')}
      >
        <Segmentado
          valor={g.moldura.ativo ? 'cor' : 'tpl'}
          mudar={(v) => mudar('moldura', { ...g.moldura, ativo: v === 'cor' })}
          opcoes={[
            { valor: 'tpl', rotulo: 'Imagem de template' },
            { valor: 'cor', rotulo: 'Fundo de cor' },
          ]}
        />
        {!g.moldura.ativo ? (
          <button type="button" className={s.templateCard} onClick={p.escolherTemplate}>
            <span className={s.templateMini} style={p.template ? { backgroundImage: `url(${p.template.url})` } : undefined}>
              {!p.template && <Icone nome="imagem" />}
            </span>
            <span className={s.templateInfo}>
              <span className={s.templateNome}>{p.template ? p.template.nome : 'Escolher template'}</span>
              <span className={s.dica}>
                {p.template ? `${p.template.imagem.naturalWidth}×${p.template.imagem.naturalHeight} · clique para trocar` : 'PNG ou JPG, ex.: 1080×1920'}
              </span>
            </span>
          </button>
        ) : (
          <>
            <Segmentado
              valor={FORMATOS_MOLDURA.findIndex((f) => f.largura === g.moldura.largura && f.altura === g.moldura.altura)}
              mudar={(i) => {
                const f = FORMATOS_MOLDURA[i];
                if (f) mudar('moldura', { ...g.moldura, largura: f.largura, altura: f.altura });
              }}
              opcoes={FORMATOS_MOLDURA.map((f, i) => ({ valor: i, rotulo: f.nome.split(' ')[0], titulo: f.nome }))}
            />
            <Campo rotulo="Cor do fundo">
              <Cores valor={g.moldura.cor} mudar={(v) => mudar('moldura', { ...g.moldura, cor: v })} />
            </Campo>
          </>
        )}
        {!g.moldura.ativo && (
          <>
            <Slider
              rotulo="Espaço no topo"
              min={0}
              max={Math.round(canvasH * 0.6)}
              valor={g.pixelsParaDescer}
              formatar={(v) => `${v}px`}
              padrao={60}
              mudar={(v) => mudar('pixelsParaDescer', v)}
            />
            <Campo rotulo="Posição do vídeo">
              <Segmentado
                valor={g.alinhamentoVertical}
                mudar={(v) => mudar('alinhamentoVertical', v)}
                opcoes={[
                  { valor: 'topo', rotulo: 'No topo' },
                  { valor: 'centro', rotulo: 'Centralizado' },
                ]}
              />
            </Campo>
            <Opcao
              rotulo="Fundo colorido atrás do vídeo"
              descricao="Cobre o template abaixo do espaço do topo"
              valor={g.preencherArea}
              mudar={(v) => mudar('preencherArea', v)}
            />
            {g.preencherArea && <Cores valor={g.corBorda} mudar={(v) => mudar('corBorda', v)} />}
          </>
        )}
        <Opcao rotulo="Sem bordas" descricao="Amplia o vídeo para preencher a área" valor={g.semBordas} mudar={(v) => mudar('semBordas', v)} />
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
          mudar={(v) => mudar('deteccao', { modo: v })}
          opcoes={[
            { valor: 'auto', rotulo: 'Automático' },
            { valor: 'margem', rotulo: 'Margem 5%' },
            { valor: 'nenhuma', rotulo: 'Desligado' },
          ]}
        />
        <span className={s.dica}>
          Se o vídeo já vier dentro de outro template, detectamos onde o vídeo está e só essa parte entra no seu template. Use
          "Ver original" no preview para conferir.
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
        resumo={g.textoAtivo ? `${et.fonte} · ${et.tamanho}px` : 'Desligado'}
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

        <div className={s.subtitulo}>Estilo</div>
        <Fonte valor={et.fonte} mudar={(v) => mudarTexto({ fonte: v })} />
        <Slider rotulo="Tamanho" min={12} max={160} valor={et.tamanho} formatar={(v) => `${v}px`} padrao={40} mudar={(v) => mudarTexto({ tamanho: v })} />
        <Cores valor={et.cor} mudar={(v) => mudarTexto({ cor: v })} />
        <div className={s.linha}>
          <div style={{ flex: 1 }}>
            <Segmentado
              valor={et.alinhamento}
              mudar={(v) => mudarTexto({ alinhamento: v })}
              opcoes={[
                { valor: 'left', rotulo: <Icone nome="alinharE" tamanho={15} />, titulo: 'Esquerda' },
                { valor: 'center', rotulo: <Icone nome="alinharC" tamanho={15} />, titulo: 'Centro' },
                { valor: 'right', rotulo: <Icone nome="alinharD" tamanho={15} />, titulo: 'Direita' },
              ]}
            />
          </div>
          <div className={s.segmentado}>
            <button type="button" title="Negrito" className={`${s.seg} ${et.negrito ? s.segAtivo : ''}`} onClick={() => mudarTexto({ negrito: !et.negrito })}>
              <b>B</b>
            </button>
            <button type="button" title="Itálico" className={`${s.seg} ${et.italico ? s.segAtivo : ''}`} onClick={() => mudarTexto({ italico: !et.italico })}>
              <i style={{ fontFamily: 'Georgia, serif' }}>I</i>
            </button>
          </div>
        </div>
        <Opcao rotulo="Contorno" valor={et.contorno.ativo} mudar={(v) => mudarTexto({ contorno: { ...et.contorno, ativo: v } })} />
        {et.contorno.ativo && (
          <>
            <Cores valor={et.contorno.cor} mudar={(v) => mudarTexto({ contorno: { ...et.contorno, cor: v } })} />
            <Slider rotulo="Espessura" min={1} max={12} valor={et.contorno.largura} mudar={(v) => mudarTexto({ contorno: { ...et.contorno, largura: v } })} />
          </>
        )}
        <Opcao rotulo="Sombra" valor={et.sombra.ativo} mudar={(v) => mudarTexto({ sombra: { ...et.sombra, ativo: v } })} />
        {et.sombra.ativo && (
          <>
            <Cores valor={et.sombra.cor} mudar={(v) => mudarTexto({ sombra: { ...et.sombra, cor: v } })} />
            <div className={s.grade2}>
              <Slider rotulo="Opacidade" min={0} max={100} valor={et.sombra.opacidade} formatar={(v) => `${v}%`} mudar={(v) => mudarTexto({ sombra: { ...et.sombra, opacidade: v } })} />
              <Slider rotulo="Distância" min={0} max={30} valor={et.sombra.distancia} mudar={(v) => mudarTexto({ sombra: { ...et.sombra, distancia: v } })} />
              <Slider rotulo="Desfoque" min={0} max={30} valor={et.sombra.blur} mudar={(v) => mudarTexto({ sombra: { ...et.sombra, blur: v } })} />
            </div>
          </>
        )}
        <Opcao rotulo="Fundo atrás do texto" valor={et.fundo.ativo} mudar={(v) => mudarTexto({ fundo: { ...et.fundo, ativo: v } })} />
        {et.fundo.ativo && <Cores valor={et.fundo.cor} mudar={(v) => mudarTexto({ fundo: { ...et.fundo, cor: v } })} />}

        <div className={s.subtitulo}>Posição da caixa (%)</div>
        <div className={s.grade2}>
          <Slider rotulo="Horizontal" min={0} max={100} valor={et.posicao.x} formatar={(v) => `${v}%`} mudar={(v) => mudarTexto({ posicao: { ...et.posicao, x: v } })} />
          <Slider rotulo="Vertical" min={0} max={100} valor={et.posicao.y} formatar={(v) => `${v}%`} mudar={(v) => mudarTexto({ posicao: { ...et.posicao, y: v } })} />
          <Slider rotulo="Largura" min={5} max={100} valor={et.posicao.w} formatar={(v) => `${v}%`} mudar={(v) => mudarTexto({ posicao: { ...et.posicao, w: v } })} />
          <Slider rotulo="Altura" min={2} max={100} valor={et.posicao.h} formatar={(v) => `${v}%`} mudar={(v) => mudarTexto({ posicao: { ...et.posicao, h: v } })} />
        </div>
        <Slider rotulo="Opacidade" min={0} max={100} valor={et.opacidade} formatar={(v) => `${v}%`} padrao={100} mudar={(v) => mudarTexto({ opacidade: v })} />
      </Secao>

      {/* ---------------- MARCA D'ÁGUA ---------------- */}
      <Secao
        {...comum}
        id="marca"
        icone="gota"
        titulo="Marca d'água"
        resumo={g.marcaAtiva ? g.marca.texto || 'Digite o texto' : 'Desligada'}
        ligado={g.marcaAtiva}
        mudarLigado={ligar('marca', () => mudar('marcaAtiva', !g.marcaAtiva))}
        aberta={abertas.has('marca')}
      >
        <input
          className={s.input}
          placeholder="@seuperfil"
          value={g.marca.texto}
          onChange={(e) => p.mudarGlobal((x) => ({ ...x, marcaAtiva: true, marca: { ...x.marca, texto: e.target.value } }))}
        />
        <Fonte valor={g.marca.fonte} mudar={(v) => mudar('marca', { ...g.marca, fonte: v })} />
        <Cores valor={g.marca.cor} mudar={(v) => mudar('marca', { ...g.marca, cor: v })} />
        <div className={s.grade2}>
          <Slider rotulo="Tamanho" min={10} max={150} valor={g.marca.tamanho} padrao={36} mudar={(v) => mudar('marca', { ...g.marca, tamanho: v })} />
          <Slider rotulo="Opacidade" min={0} max={100} valor={g.marca.opacidade} formatar={(v) => `${v}%`} padrao={100} mudar={(v) => mudar('marca', { ...g.marca, opacidade: v })} />
          <Slider rotulo="Horizontal" min={0} max={canvasW} valor={g.marca.posX} formatar={(v) => `${v}px`} mudar={(v) => mudar('marca', { ...g.marca, posX: v })} />
          <Slider rotulo="Vertical" min={0} max={canvasH} valor={g.marca.posY} formatar={(v) => `${v}px`} mudar={(v) => mudar('marca', { ...g.marca, posY: v })} />
        </div>
        <Opcao rotulo="Fundo atrás da marca" valor={g.marca.fundoAtivo} mudar={(v) => mudar('marca', { ...g.marca, fundoAtivo: v })} />
        {g.marca.fundoAtivo && <Cores valor={g.marca.corFundo} mudar={(v) => mudar('marca', { ...g.marca, corFundo: v })} />}
      </Secao>

      {/* ---------------- MÚSICA ---------------- */}
      <Secao
        {...comum}
        id="musica"
        icone="musica"
        titulo="Música de fundo"
        resumo={g.musica.ativo ? (musicaSel?.nome ?? 'Escolha uma música') : 'Desligada'}
        ligado={g.musica.ativo}
        mudarLigado={ligar('musica', () => mudar('musica', { ...g.musica, ativo: !g.musica.ativo }))}
        aberta={abertas.has('musica')}
      >
        <div className={s.lista}>
          {p.musicas.map((m) => (
            <div
              key={m.id}
              className={`${s.musicaItem} ${m.id === g.musica.musicaId ? s.musicaAtiva : ''}`}
              onClick={() => p.mudarGlobal((x) => ({ ...x, musica: { ...x.musica, ativo: true, musicaId: m.id, inicio: 0 } }))}
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
            <div className={s.grade2}>
              <Slider rotulo="Volume música" min={0} max={200} valor={g.musica.volumeMusica} formatar={(v) => `${v}%`} padrao={30} mudar={(v) => mudar('musica', { ...g.musica, volumeMusica: v })} />
              <Slider rotulo="Volume vídeo" min={0} max={200} valor={g.musica.volumeVideo} formatar={(v) => `${v}%`} padrao={100} mudar={(v) => mudar('musica', { ...g.musica, volumeVideo: v })} />
            </div>
            <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={ouvir}>
              <Icone nome={tocando ? 'parar' : 'play'} tamanho={13} /> {tocando ? 'Parar' : 'Ouvir 10s'}
            </button>
          </>
        )}
        <Opcao
          rotulo="Tirar o áudio original"
          descricao="Fica só a música"
          valor={g.musica.mutarOriginal}
          mudar={(v) => mudar('musica', { ...g.musica, mutarOriginal: v })}
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
