'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react'

// Opção "direto no site": API oficial da Meta (Business Discovery), a mesma do Agendador.
// Lê os Reels de perfis PROFISSIONAIS (Business/Creator) pelo servidor, sem extensão e sem cookies.

export interface StatusOficial {
  configurado: boolean
  origem?: 'ambiente' | 'site' | 'conta'
  usuario?: string | null
}

export function useInstagramOficial() {
  const [status, setStatus] = useState<StatusOficial | null>(null)
  const recarregar = useCallback(() => {
    fetch('/api/social/instagram-oficial', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { configurado: false }))
      .then(setStatus)
      .catch(() => setStatus({ configurado: false }))
  }, [])
  useEffect(() => recarregar(), [recarregar])
  return { status, recarregar }
}

export function ModalInstagramOficial({ status, fechar, aoSalvar }: { status: StatusOficial | null; fechar: () => void; aoSalvar: () => void }) {
  const [token, setToken] = useState('')
  const [igId, setIgId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const r = await fetch('/api/social/instagram-oficial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), ig_id: igId.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Não foi possível salvar.')
      setToken('')
      aoSalvar()
      fechar()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function desligar() {
    if (!window.confirm('Remover a conexão com a API oficial?')) return
    await fetch('/api/social/instagram-oficial', { method: 'DELETE' }).catch(() => null)
    aoSalvar()
    fechar()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="API oficial do Instagram">
      <div className="w-full max-w-lg bg-[#111114] border border-white/[0.1] rounded-3xl p-6 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-white" /></span>
            <div>
              <h3 className="text-sm font-semibold text-white">Direto no site: API oficial da Meta</h3>
              <p className="text-xs text-zinc-400">Sem extensão e sem cookies. Funciona com perfis profissionais (Business ou Creator).</p>
            </div>
          </div>
          <button type="button" onClick={fechar} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>

        {status?.configurado && (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Conectado{status.usuario ? ` via @${status.usuario}` : ''}
              {status.origem === 'conta' ? ' (sua conta conectada pela Meta)' : status.origem === 'ambiente' ? ' (configurado no servidor)' : ''}
            </span>
            {status.origem === 'site' && <button type="button" onClick={desligar} className="text-[11px] underline">Remover</button>}
          </div>
        )}

        <ol className="space-y-2.5 text-xs text-zinc-300 list-decimal pl-4">
          <li>Tenha uma conta do Instagram <b>profissional</b> (Business ou Creator) ligada a uma <b>Página do Facebook</b>. Pode ser uma conta sua qualquer — ela só é usada para consultar.</li>
          <li>Em <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a>, crie um app do tipo <b>Business</b> e adicione o produto <b>Instagram Graph API</b>.</li>
          <li>No <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="underline">Graph API Explorer</a>, gere um token com <code className="px-1 rounded bg-white/[0.08]">instagram_basic</code>, <code className="px-1 rounded bg-white/[0.08]">pages_show_list</code> e <code className="px-1 rounded bg-white/[0.08]">business_management</code>, e troque por um de longa duração.</li>
          <li>Na mesma ferramenta, rode <code className="px-1 rounded bg-white/[0.08]">me/accounts?fields=instagram_business_account</code> e copie o ID da conta Instagram Business.</li>
        </ol>

        <div className="space-y-2.5">
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">Token de acesso (longa duração)</span>
            <input id="ig-oficial-token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="EAAB…"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white font-mono" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">ID da conta Instagram Business</span>
            <input id="ig-oficial-id" inputMode="numeric" value={igId} onChange={e => setIgId(e.target.value.replace(/\D/g, ''))} placeholder="17841400000000000"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white font-mono" />
          </label>
          {erro && <p className="text-xs text-red-300">{erro}</p>}
          <button type="button" onClick={salvar} disabled={salvando || !token.trim() || !igId.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Testar e salvar
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          O token fica guardado só no servidor, num armazenamento privado. A Meta não informa as views de perfis de terceiros: nessa opção, “mais vistos” usa as curtidas.
          Perfis pessoais (não profissionais) só pela extensão.
        </p>
      </div>
    </div>
  )
}
