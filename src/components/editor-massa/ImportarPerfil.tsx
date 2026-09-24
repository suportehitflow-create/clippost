'use client';

import { useEffect, useRef, useState } from 'react';

type SortBy = 'views' | 'likes' | 'engagement' | 'date';

interface ItemLote {
  url: string;
  title: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  file_url?: string | null;
  error?: string | null;
}

const QUANTIDADES = [
  { v: 10, l: '10' },
  { v: 20, l: '20' },
  { v: 30, l: '30' },
  { v: 50, l: '50' },
  { v: 0, l: 'Todos' },
];

const ORDENS: Array<{ v: SortBy; l: string }> = [
  { v: 'views', l: 'Visualizações' },
  { v: 'likes', l: 'Curtidas' },
  { v: 'engagement', l: 'Engajamento' },
  { v: 'date', l: 'Mais recentes' },
];

const pill = (ativo: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
    ativo
      ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white border-transparent'
      : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
  }`;

// Baixa os vídeos de um perfil pelo backend do Clipost e joga cada um na grade do editor
// como se tivesse sido enviado do computador (upload, detecção do template antigo etc.).
export default function ImportarPerfil({
  fechar,
  aoArquivos,
}: {
  fechar: () => void;
  aoArquivos: (arquivos: File[]) => void;
}) {
  const [perfil, setPerfil] = useState('');
  const [quantidade, setQuantidade] = useState(10);
  const [ordem, setOrdem] = useState<SortBy>('views');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [importados, setImportados] = useState(0);
  const [erro, setErro] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const jaImportados = useRef(new Set<number>());
  // A função do editor muda a cada vídeo adicionado; a ref evita reiniciar a consulta
  const aoArquivosRef = useRef(aoArquivos);
  aoArquivosRef.current = aoArquivos;

  async function iniciar() {
    setErro('');
    if (!perfil.trim()) return setErro('Cole o link do perfil.');
    setIniciando(true);
    try {
      const res = await fetch('/api/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'profile',
          profile_url: perfil.trim(),
          limit: quantidade,
          sort_by: ordem,
          options: { download_only: true },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.batch_id) throw new Error(data.error || 'Não foi possível buscar o perfil.');
      jaImportados.current = new Set();
      setLoteId(data.batch_id);
      setStatus('listing');
    } catch (e: any) {
      setErro(e.message || 'Falha ao buscar o perfil.');
    } finally {
      setIniciando(false);
    }
  }

  useEffect(() => {
    if (!loteId) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function importarProntos(lista: ItemLote[]) {
      for (let i = 0; i < lista.length; i++) {
        const it = lista[i];
        if (it.status !== 'done' || !it.file_url || jaImportados.current.has(i)) continue;
        jaImportados.current.add(i);
        try {
          const blob = await (await fetch(it.file_url)).blob();
          const nomeBase = (it.title || `video ${i + 1}`).replace(/[\\/:*?"<>|#\n\r]+/g, ' ').trim().slice(0, 60) || `video ${i + 1}`;
          aoArquivosRef.current([new File([blob], `${String(i + 1).padStart(2, '0')} - ${nomeBase}.mp4`, { type: 'video/mp4' })]);
          setImportados((n) => n + 1);
        } catch {
          jaImportados.current.delete(i);
        }
      }
    }

    async function consultar() {
      try {
        const res = await fetch(`/api/bulk/${loteId}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!ativo) return;
        if (!res.ok) {
          setErro(data.error || 'Não foi possível acompanhar a importação.');
          return;
        }
        setStatus(data.status);
        setItens(data.items || []);
        if (data.status === 'failed' && data.error) setErro(data.error);
        await importarProntos(data.items || []);
        if (data.status === 'done' || data.status === 'failed') return;
      } catch {}
      if (ativo) timer = setTimeout(consultar, 3000);
    }
    consultar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, [loteId]);

  const falhas = itens.filter((i) => i.status === 'failed').length;
  const terminou = status === 'done' || status === 'failed';

  return (
    // Depois de começar vira um cartão no canto, para continuar editando enquanto os vídeos chegam
    <div
      className={loteId ? 'fixed bottom-28 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]' : 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'}
      role="dialog"
      aria-modal={!loteId}
      aria-label="Importar vídeos de um perfil"
    >
      <div className="w-full max-w-md bg-[#111114] border border-white/[0.1] rounded-2xl p-5 space-y-4 text-left shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Importar vídeos de um perfil</h2>
            <p className="text-xs text-zinc-400 mt-1">Instagram, TikTok, Facebook ou YouTube. Os vídeos entram na grade para você editar.</p>
          </div>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white text-lg leading-none px-1" aria-label="Fechar">
            ×
          </button>
        </div>

        {!loteId ? (
          <>
            <input
              id="importar-perfil-link"
              type="text"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              placeholder="instagram.com/perfil, tiktok.com/@perfil…"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
            />
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400">Quantos vídeos</span>
              <div className="flex flex-wrap gap-1.5">
                {QUANTIDADES.map((q) => (
                  <button key={q.v} type="button" className={pill(quantidade === q.v)} onClick={() => setQuantidade(q.v)}>
                    {q.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400">Ordenar por</span>
              <div className="flex flex-wrap gap-1.5">
                {ORDENS.map((o) => (
                  <button key={o.v} type="button" className={pill(ordem === o.v)} onClick={() => setOrdem(o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <button
              type="button"
              onClick={iniciar}
              disabled={iniciando}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {iniciando ? 'Buscando…' : 'Buscar e importar'}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white">
              {status === 'listing' || !itens.length
                ? 'Buscando os vídeos do perfil…'
                : `${importados} de ${itens.length} vídeos na grade${falhas ? ` · ${falhas} não baixaram` : ''}`}
            </p>
            {itens.length > 0 && (
              <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 transition-all duration-700"
                  style={{ width: `${Math.round(((importados + falhas) / itens.length) * 100)}%` }}
                />
              </div>
            )}
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <p className="text-[11px] text-zinc-500">
              {terminou ? 'Importação concluída.' : 'Pode continuar editando: os vídeos aparecem na grade conforme ficam prontos. Fechar esta janela interrompe a importação.'}
            </p>
            <button type="button" onClick={fechar} className="w-full py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-semibold text-white">
              {terminou ? 'Fechar' : 'Parar e fechar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
