'use client';

import { Campo, Cores, Opcao, Segmentado, Slider } from './campos';
import s from './editor-massa.module.css';

// Edição rápida do template Clipost sem sair do editor em massa.
// Mexe no mesmo layout_config do editor de Templates (brand kit); o preview atualiza na hora
// e, ao concluir, o template é salvo na sua conta.

const FONTES_TEMPLATE = [
  { nome: 'Instagram Sans', familia: "'Instagram Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif" },
  { nome: 'SF Pro Rounded', familia: "'SF Pro Rounded', system-ui, -apple-system, sans-serif" },
  { nome: 'SF Pro Bold', familia: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" },
  { nome: 'Anton / Impact', familia: "Impact, 'Anton', sans-serif" },
  { nome: 'Montserrat', familia: 'Montserrat, sans-serif' },
];

export default function EditarTemplate(p: {
  config: Record<string, any>;
  mudar: (parcial: Record<string, any>) => void;
  salvando: boolean;
  concluir: () => void;
}) {
  const c = p.config;
  const fundo: string = c.templateBg === 'white' ? 'white' : c.templateBg === 'gray' || c.templateBg === 'zinc' ? 'gray' : 'dark';
  const corTitulo = String(c.titleColor || '#ffffff');
  const fonteAtual = FONTES_TEMPLATE.find((f) => f.familia === c.fontFamily)?.familia ?? FONTES_TEMPLATE[0].familia;

  const trocarFundo = (novo: string) => {
    const parcial: Record<string, any> = { templateBg: novo, customBgImage: null };
    // Igual ao editor de Templates: título branco no fundo branco some → vira preto (e vice-versa)
    if (novo === 'white' && corTitulo.toLowerCase() === '#ffffff') parcial.titleColor = '#000000';
    if (novo !== 'white' && corTitulo.toLowerCase() === '#000000') parcial.titleColor = '#ffffff';
    p.mudar(parcial);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Editar template">
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#111114] border border-white/[0.1] rounded-2xl p-5 flex flex-col gap-3.5 text-left shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Editar template</h2>
            <p className="text-xs text-zinc-400 mt-1">As mudanças aparecem no preview na hora e ficam salvas no seu template.</p>
          </div>
          <button type="button" onClick={p.concluir} className="text-zinc-500 hover:text-white text-lg leading-none px-1" aria-label="Fechar">
            ×
          </button>
        </div>

        <Campo rotulo="Fundo">
          <Segmentado
            valor={c.customBgImage ? 'imagem' : fundo}
            mudar={trocarFundo}
            opcoes={[
              { valor: 'dark', rotulo: 'Preto' },
              { valor: 'white', rotulo: 'Branco' },
              { valor: 'gray', rotulo: 'Cinza' },
              ...(c.customBgImage ? [{ valor: 'imagem', rotulo: 'Imagem' }] : []),
            ]}
          />
        </Campo>

        <div className={s.subtitulo}>Perfil</div>
        <input
          id="tpl-nome"
          className={s.input}
          placeholder="Nome da página"
          value={c.brandName ?? ''}
          onChange={(e) => p.mudar({ brandName: e.target.value })}
        />
        <input
          id="tpl-arroba"
          className={s.input}
          placeholder="@seuperfil"
          value={c.brandHandle ?? ''}
          onChange={(e) => p.mudar({ brandHandle: e.target.value })}
        />
        <Opcao rotulo="Selo de verificado" valor={c.showVerifiedBadge !== false} mudar={(v) => p.mudar({ showVerifiedBadge: v })} />

        <div className={s.subtitulo}>Título (o texto de cada vídeo)</div>
        <Campo rotulo="Fonte">
          <select id="tpl-fonte" className={s.select} value={fonteAtual} onChange={(e) => p.mudar({ fontFamily: e.target.value })}>
            {FONTES_TEMPLATE.map((f) => (
              <option key={f.nome} value={f.familia}>
                {f.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Cores valor={corTitulo} mudar={(v) => p.mudar({ titleColor: v })} />
        <Campo rotulo="Contorno">
          <Segmentado
            valor={c.titleStroke || 'none'}
            mudar={(v) => p.mudar({ titleStroke: v })}
            opcoes={[
              { valor: 'none', rotulo: 'Sem' },
              { valor: 'thin', rotulo: 'Fino' },
              { valor: 'medium', rotulo: 'Médio' },
              { valor: 'thick', rotulo: 'Grosso' },
            ]}
          />
        </Campo>
        {c.titleStroke && c.titleStroke !== 'none' && <Cores valor={String(c.titleStrokeColor || '#000000')} mudar={(v) => p.mudar({ titleStrokeColor: v })} />}
        <Opcao rotulo="Tudo em maiúsculas" valor={c.titleCapsLock !== false} mudar={(v) => p.mudar({ titleCapsLock: v })} />

        <div className={s.subtitulo}>Vídeo</div>
        <Opcao rotulo="Cantos arredondados" valor={!!c.videoRounded} mudar={(v) => p.mudar({ videoRounded: v })} />

        <div className={s.subtitulo}>Marca d'água</div>
        <Opcao rotulo="Mostrar marca d'água" valor={c.showWatermark !== false} mudar={(v) => p.mudar({ showWatermark: v })} />
        {c.showWatermark !== false && (
          <>
            {c.watermarkType !== 'image' && (
              <input
                id="tpl-marca"
                className={s.input}
                placeholder={c.brandHandle || '@seuperfil'}
                value={c.watermarkText ?? ''}
                onChange={(e) => p.mudar({ watermarkText: e.target.value })}
              />
            )}
            <Campo rotulo="Posição">
              <Segmentado
                valor={c.watermarkPosition || 'bottom_center'}
                mudar={(v) => p.mudar({ watermarkPosition: v })}
                opcoes={[
                  { valor: 'top_left', rotulo: 'Topo esq.' },
                  { valor: 'top_right', rotulo: 'Topo dir.' },
                  { valor: 'center', rotulo: 'Centro' },
                  { valor: 'bottom_center', rotulo: 'Embaixo' },
                ]}
              />
            </Campo>
            <Slider
              rotulo="Opacidade"
              min={10}
              max={100}
              valor={Math.round(Number(c.watermarkOpacity ?? 45) <= 1 ? Number(c.watermarkOpacity) * 100 : Number(c.watermarkOpacity ?? 45))}
              formatar={(v) => `${v}%`}
              padrao={45}
              mudar={(v) => p.mudar({ watermarkOpacity: v })}
            />
          </>
        )}

        <div className="flex gap-2 pt-1">
          <a href="/templates" className={`${s.btn} ${s.btnFantasma}`} style={{ flex: 1, justifyContent: 'center' }}>
            Editor completo
          </a>
          <button type="button" className={`${s.btn} ${s.btnPrimario}`} style={{ flex: 1 }} onClick={p.concluir} disabled={p.salvando}>
            {p.salvando ? 'Salvando…' : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
