'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Download, Puzzle, X } from 'lucide-react'

// ExtensÃ£o do Clipost para o Instagram (pasta extensao/ do repositÃ³rio; zip em public/extensao).
// Ela lista os Reels com a sessÃ£o do navegador e entrega aqui via window.postMessage.

export interface ItemExtensao {
  url: string
  permalink: string
  title: string
  thumbnail: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  timestamp: number | null
}

export interface ListaExtensao {
  perfil: string
  usuario: string
  itens: ItemExtensao[]
  criadoEm: number
}

export const ZIP_EXTENSAO = '/extensao/clipost-instagram.zip'
/** VersÃ£o da pasta extensao/ (manifest.json): a extensÃ£o instalada mais velha se recarrega sozinha (1.3.1+) */
export const VERSAO_EXTENSAO = '1.6.0'

/** A extensÃ£o (1.4.0+) baixa o vÃ­deo do YouTube pelo navegador (IP de quem usa) e sobe nos links dados */
export function baixarYouTubePelaExtensao(
  videoId: string,
  destinos: { video: string; audio: string },
  timeoutMs = 20 * 60 * 1000,
): Promise<{ titulo: string; duracao: number | null; audioSeparado: boolean }> {
  return new Promise((resolve, reject) => {
    const origem = window.location.origin
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const t = setTimeout(() => { window.removeEventListener('message', aoMensagem); reject(new Error('a extensÃ£o nÃ£o respondeu')) }, timeoutMs)
    function aoMensagem(e: MessageEvent) {
      if (e.source !== window || e.origin !== origem || e.data?.tipo !== 'CLIPOST_EXTENSAO_YOUTUBE_OK' || e.data.id !== id) return
      clearTimeout(t)
      window.removeEventListener('message', aoMensagem)
      if (e.data.ok) resolve(e.data)
      else reject(new Error(e.data.erro || 'falhou'))
    }
    window.addEventListener('message', aoMensagem)
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_YOUTUBE', id, videoId, destinos }, origem)
  })
}

/** Detecta a extensÃ£o e recebe a lista que ela montou no Instagram */
export function useExtensaoClipost() {
  const [instalada, setInstalada] = useState<boolean | null>(null)
  const [lista, setLista] = useState<ListaExtensao | null>(null)

  useEffect(() => {
    const origem = window.location.origin
    const aoMensagem = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== origem) return
      if (e.data?.tipo === 'CLIPOST_EXTENSAO_PONG') {
        setInstalada(true)
        // extensÃ£o carregada da pasta e mais velha que a do site: pede para ela se recarregar (1x por sessÃ£o)
        const numero = (v: string) => v.split('.').map(Number).reduce((a, n) => a * 1000 + (n || 0), 0)
        try {
          if (numero(String(e.data.versao || '0')) < numero(VERSAO_EXTENSAO) && sessionStorage.getItem('clipost:ext-recarregada') !== VERSAO_EXTENSAO) {
            sessionStorage.setItem('clipost:ext-recarregada', VERSAO_EXTENSAO)
            window.postMessage({ tipo: 'CLIPOST_EXTENSAO_RECARREGAR' }, origem)
            // a pÃ¡gina fica ligada Ã  versÃ£o velha ("Extension context invalidated"): recarrega sozinha
            setTimeout(() => window.location.reload(), 1500)
          }
        } catch {}
        window.postMessage({ tipo: 'CLIPOST_EXTENSAO_PEGAR' }, origem)
      } else if (e.data?.tipo === 'CLIPOST_EXTENSAO_LISTA' && e.data.dados?.itens?.length) {
        setLista(e.data.dados)
      }
    }
    window.addEventListener('message', aoMensagem)
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_PING' }, origem)
    // o script da extensÃ£o entra no comeÃ§o da pÃ¡gina; se nÃ£o responder logo, nÃ£o estÃ¡ instalada
    const t = setTimeout(() => setInstalada(v => v ?? false), 1500)
    return () => {
      window.removeEventListener('message', aoMensagem)
      clearTimeout(t)
    }
  }, [])

  /** Avisa a extensÃ£o que a lista foi usada (ela apaga a cÃ³pia dela) */
  const consumir = useCallback(() => {
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_RECEBIDO' }, window.location.origin)
    setLista(null)
  }, [])

  return { instalada, lista, consumir }
}

export interface ItemBusca extends ItemExtensao {
  tipo: 'reel' | 'post' | 'carrossel'
  video: boolean
  duration: number | null
}
export interface ResultadoBusca {
  perfil: { usuario: string; nome: string | null; foto: string | null; seguidores: number | null; total_posts: number | null }
  itens: ItemBusca[]
}

/** Pede Ã  extensÃ£o (1.2.0+) para buscar o perfil do Instagram com a sessÃ£o do navegador â€” sem clique */
export function buscarPelaExtensao(usuario: string, limite: number, timeoutMs = 240000, rede: 'instagram' | 'facebook' = 'instagram'): Promise<ResultadoBusca> {
  return new Promise((resolve, reject) => {
    const origem = window.location.origin
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const t = setTimeout(() => { window.removeEventListener('message', aoMensagem); reject(new Error('A extensÃ£o nÃ£o respondeu. Atualize-a para a versÃ£o 1.2 (baixe o .zip de novo).')) }, timeoutMs)
    function aoMensagem(e: MessageEvent) {
      if (e.source !== window || e.origin !== origem || e.data?.tipo !== 'CLIPOST_EXTENSAO_RESULTADO' || e.data.id !== id) return
      clearTimeout(t)
      window.removeEventListener('message', aoMensagem)
      if (e.data.ok) resolve(e.data.dados)
      else reject(new Error(e.data.erro || 'a extensÃ£o nÃ£o conseguiu ler o perfil'))
    }
    window.addEventListener('message', aoMensagem)
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_BUSCAR', id, usuario: usuario.replace(/^@/, ''), limite, rede }, origem)
  })
}

/** Link da extensÃ£o na Chrome Web Store (NEXT_PUBLIC_EXTENSAO_URL na Vercel, quando publicada) */
export const LOJA_EXTENSAO = (process.env.NEXT_PUBLIC_EXTENSAO_URL || '').trim()

export function ModalExtensao({ fechar, instalada, motivo }: { fechar: () => void; instalada: boolean | null; motivo?: string }) {
  const passo = (n: number, conteudo: React.ReactNode) => (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-[11px] font-bold flex items-center justify-center shrink-0">{n}</span>
      <div className="text-xs text-zinc-300 leading-relaxed pt-0.5 space-y-2">{conteudo}</div>
    </li>
  )
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="ExtensÃ£o do Clipost" onClick={fechar}>
      <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-6 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30"><Puzzle className="w-5 h-5 text-white" /></span>
            <div>
              <h3 className="text-sm font-semibold text-white">{instalada ? 'ExtensÃ£o do Clipost ativa' : 'Instale a extensÃ£o do Clipost'}</h3>
              <p className="text-xs text-zinc-400">{motivo || 'Com ela, o Instagram Ã© lido pelo seu navegador â€” tudo automÃ¡tico, sem bloqueio.'}</p>
            </div>
          </div>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>

        {instalada ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Pronto. Digite o @ e clique em Buscar posts â€” ela faz o resto sozinha.
          </div>
        ) : LOJA_EXTENSAO ? (
          <div className="space-y-3">
            <a href={LOJA_EXTENSAO} target="_blank" rel="noreferrer"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30">
              <Puzzle className="w-4 h-4" /> Adicionar ao Chrome
            </a>
            <p className="text-[11px] text-zinc-500 text-center">Abre a Chrome Web Store: clique em â€œUsar no Chromeâ€ e volte aqui. Deixe o Instagram logado neste navegador.</p>
          </div>
        ) : (
          <ol className="space-y-3.5">
            {passo(1, <>
              <span>Baixe a extensÃ£o:</span>
              <a href={ZIP_EXTENSAO} download className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-bold">
                <Download className="w-3.5 h-3.5" /> Baixar extensÃ£o
              </a>
              <span className="block text-zinc-500">Depois, clique com o botÃ£o direito no arquivo baixado â†’ <b>Extrair tudo</b>.</span>
            </>)}
            {passo(2, <>Abra <b>chrome://extensions</b> numa nova aba, ligue <b>Modo do desenvolvedor</b> (canto de cima, Ã  direita) e clique em <b>Carregar sem compactaÃ§Ã£o</b> â†’ escolha a pasta extraÃ­da.</>)}
            {passo(3, <>Volte aqui, recarregue a pÃ¡gina e busque o @. Deixe o Instagram logado neste navegador.</>)}
          </ol>
        )}
        <p className="text-[11px] text-zinc-500">A extensÃ£o sÃ³ lÃª perfis pÃºblicos (ou que vocÃª segue) com a sua sessÃ£o do Instagram e manda os links dos vÃ­deos para o Clipost. NÃ£o envia senha nem cookies.</p>
      </div>
    </div>
  )
}