'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2 } from 'lucide-react'
import { conectarRede, type Rede } from '@/lib/conectarRedes'

// Tela do Clipost para conectar as redes de um perfil: cada botão abre direto o login da rede.
export interface ContaConectada { platform: string; username: string | null }

const REDES: { id: Rede; nome: string; sigla: string; cor: string; dica: string }[] = [
  { id: 'instagram', nome: 'Instagram', sigla: 'IG', cor: 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600', dica: 'Conta profissional ou de criador' },
  { id: 'facebook', nome: 'Facebook', sigla: 'FB', cor: 'bg-[#1877f2]', dica: 'Página do Facebook' },
  { id: 'tiktok', nome: 'TikTok', sigla: 'TT', cor: 'bg-black border border-white/20', dica: 'Qualquer conta' },
  { id: 'youtube', nome: 'YouTube', sigla: 'YT', cor: 'bg-[#ff0033]', dica: 'Canal do YouTube (Shorts)' },
]
const plataforma = (p: string) => (p === 'youtube_shorts' ? 'youtube' : p)

export default function ModalConectarRedes({ perfilId, perfilNome, contas, fechar, aoConectar }: {
  perfilId: string
  perfilNome?: string
  contas: ContaConectada[]
  fechar: () => void
  aoConectar: () => void
}) {
  const [abrindo, setAbrindo] = useState<Rede | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function conectar(rede: Rede, nome: string) {
    setAviso(null)
    setAbrindo(rede)
    const r = await conectarRede(perfilId, rede)
    setAbrindo(null)
    if (r.status === 'success') {
      setAviso({ tipo: 'ok', texto: `${nome} conectado.` })
      aoConectar()
    } else if (r.status === 'error') setAviso({ tipo: 'erro', texto: r.erro || 'Não deu para conectar.' })
  }

  // no body: o cabeçalho tem desfoque de fundo, que prenderia a janela dentro dele
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Conectar redes" onClick={fechar}>
      <div className="w-full max-w-md bg-[#111114] border border-white/[0.1] rounded-3xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Conectar redes</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{perfilNome ? `Perfil ${perfilNome}. ` : ''}Escolha a rede e entre com a sua conta.</p>
          </div>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>

        <ul className="space-y-2">
          {REDES.map(r => {
            const conectadas = contas.filter(c => plataforma(c.platform) === r.id)
            return (
              <li key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <span className={`w-9 h-9 rounded-xl ${r.cor} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>{r.sigla}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white block">{r.nome}</span>
                  <span className="text-[11px] text-zinc-500 block truncate">
                    {conectadas.length ? conectadas.map(c => (c.username ? `@${c.username.replace(/^@/, '')}` : 'Conectada')).join(' · ') : r.dica}
                  </span>
                </div>
                {conectadas.length > 0 && abrindo !== r.id && <Check className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Conectada" />}
                <button type="button" onClick={() => conectar(r.id, r.nome)} disabled={!!abrindo}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 shrink-0 flex items-center gap-1.5">
                  {abrindo === r.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conectando</> : conectadas.length ? 'Outra conta' : 'Conectar'}
                </button>
              </li>
            )
          })}
        </ul>

        {aviso && <p role="status" className={`text-xs ${aviso.tipo === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{aviso.texto}</p>}
        <p className="text-[11px] text-zinc-500">O login acontece na própria rede. O Clipost só recebe a permissão para publicar os seus cortes.</p>
      </div>
    </div>,
    document.body,
  )
}
