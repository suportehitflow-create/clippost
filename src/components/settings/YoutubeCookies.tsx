'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// Quando o YouTube bloqueia o servidor ("confirme que você não é um robô"), o download volta a
// funcionar com os cookies de uma conta do YouTube. A pessoa cola o cookies.txt aqui (fica privado).
export default function YoutubeCookies() {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    setEstado(null)
    const r = await fetch('/api/social/youtube-cookies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: texto }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setSalvando(false)
    if (r?.ok) {
      setTexto('')
      setEstado({ tipo: 'ok', msg: 'Pronto. Os próximos vídeos do YouTube já baixam com essa conta.' })
    } else setEstado({ tipo: 'erro', msg: d.detail || d.error || 'Não foi possível salvar.' })
  }

  return (
    <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Download do YouTube</h2>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          Se o YouTube pedir para confirmar que não é robô, cole aqui o arquivo <b>cookies.txt</b> de uma conta do YouTube
          (de preferência uma conta secundária). Exporte numa janela anônima com a extensão “Get cookies.txt LOCALLY” e
          feche a janela depois — assim os cookies duram mais.
        </p>
      </div>
      <textarea
        id="youtube-cookies"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={4}
        placeholder="# Netscape HTTP Cookie File …"
        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-xs font-mono text-zinc-200 placeholder-zinc-600"
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={salvar} disabled={!texto.trim() || salvando}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white disabled:opacity-50 flex items-center gap-1.5">
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
        </button>
        {estado && (
          <span className={`text-xs flex items-center gap-1.5 ${estado.tipo === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {estado.tipo === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {estado.msg}
          </span>
        )}
      </div>
    </section>
  )
}
