'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Download, Puzzle, X } from 'lucide-react'

// Extensão do Clipost para o Instagram (pasta extensao/ do repositório; zip em public/extensao).
// Ela lista os Reels com a sessão do navegador e entrega aqui via window.postMessage.

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

/** Detecta a extensão e recebe a lista que ela montou no Instagram */
export function useExtensaoClipost() {
  const [instalada, setInstalada] = useState<boolean | null>(null)
  const [lista, setLista] = useState<ListaExtensao | null>(null)

  useEffect(() => {
    const origem = window.location.origin
    const aoMensagem = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== origem) return
      if (e.data?.tipo === 'CLIPOST_EXTENSAO_PONG') {
        setInstalada(true)
        window.postMessage({ tipo: 'CLIPOST_EXTENSAO_PEGAR' }, origem)
      } else if (e.data?.tipo === 'CLIPOST_EXTENSAO_LISTA' && e.data.dados?.itens?.length) {
        setLista(e.data.dados)
      }
    }
    window.addEventListener('message', aoMensagem)
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_PING' }, origem)
    // o script da extensão entra no começo da página; se não responder logo, não está instalada
    const t = setTimeout(() => setInstalada(v => v ?? false), 1500)
    return () => {
      window.removeEventListener('message', aoMensagem)
      clearTimeout(t)
    }
  }, [])

  /** Avisa a extensão que a lista foi usada (ela apaga a cópia dela) */
  const consumir = useCallback(() => {
    window.postMessage({ tipo: 'CLIPOST_EXTENSAO_RECEBIDO' }, window.location.origin)
    setLista(null)
  }, [])

  return { instalada, lista, consumir }
}

export function ModalExtensao({ fechar, instalada }: { fechar: () => void; instalada: boolean | null }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Extensão do Instagram">
      <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-6 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center"><Puzzle className="w-5 h-5 text-white" /></span>
            <div>
              <h3 className="text-sm font-semibold text-white">Extensão do Clipost para o Instagram</h3>
              <p className="text-xs text-zinc-400">Baixa os Reels de qualquer perfil usando o seu login do navegador — sem cookies, sem erro 429.</p>
            </div>
          </div>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>

        {instalada ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4" /> Extensão instalada. Abra um perfil no Instagram e clique em “Enviar para o Clipost”.
          </div>
        ) : (
          <ol className="space-y-3 text-xs text-zinc-300">
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-white/[0.08] text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
              <div className="space-y-2">
                <span>Baixe a extensão e descompacte o arquivo numa pasta.</span>
                <a href={ZIP_EXTENSAO} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-semibold">
                  <Download className="w-3.5 h-3.5" /> Baixar extensão (.zip)
                </a>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-white/[0.08] text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <span>
                No Chrome (ou Edge, Brave, Opera), abra <code className="px-1 rounded bg-white/[0.08]">chrome://extensions</code>, ligue o
                <b> Modo do desenvolvedor</b> (canto superior direito) e clique em <b>Carregar sem compactação</b>. Escolha a pasta descompactada.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-white/[0.08] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
              <span>
                Entre no Instagram (use uma conta secundária se preferir), abra o perfil que você quer e clique em <b>Enviar para o Clipost</b>,
                no canto inferior direito. Escolha quantos vídeos e a ordem — o Clipost abre com a lista pronta.
              </span>
            </li>
          </ol>
        )}
        <p className="text-[11px] text-zinc-500">
          A extensão só lê os Reels públicos (ou de perfis que você segue) e manda os links dos vídeos para o Clipost. Ela não guarda nem envia sua senha ou seus cookies.
          Só republique conteúdo que você tem direito de usar.
        </p>
      </div>
    </div>
  )
}
