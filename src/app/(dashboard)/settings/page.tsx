'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  User,
  Shield,
  Sliders,
  Sparkles,
  LogOut,
  Check,
  CreditCard,
  Bell,
  Cpu
} from 'lucide-react'
import LiquidToggle from '@/components/ui/LiquidToggle'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [plan, setPlan] = useState<string>('Pro Creator')
  const [autoSubtitles, setAutoSubtitles] = useState<boolean>(true)
  const [aiTracking, setAiTracking] = useState<boolean>(true)
  const [soundEffects, setSoundEffects] = useState<boolean>(false)
  const [savedNotice, setSavedNotice] = useState<boolean>(false)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || 'usuario@clippost.app')
        setUserId(user.id)
      } else {
        const demoEmail = localStorage.getItem('clippost_demo_user_email') || 'criador@clippost.app'
        setUserEmail(demoEmail)
        setUserId(localStorage.getItem('clippost_demo_user_id') || 'demo-user-123')
      }
    }
    loadUser()
  }, [])

  async function signOut() {
    if (!confirm('Deseja realmente encerrar sua sessão?')) return
    document.cookie = 'clippost_demo_auth=; path=/; max-age=0'
    localStorage.removeItem('clippost_demo_auth')
    localStorage.removeItem('clippost_demo_user_id')
    localStorage.removeItem('clippost_demo_user_email')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleSavePreferences() {
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2500)
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Ajustes da Conta</h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Gerencie sua conta, preferências do estúdio de inteligência artificial e preferências de sessão.
          </p>
        </div>
        {savedNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Salvo com sucesso</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* SEÇÃO 1: CONTA & IDENTIFICAÇÃO */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Perfil & Assinatura</h2>
              <p className="text-[11px] text-zinc-400 leading-normal">Seus dados de autenticação e acesso.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">E-mail Cadastrado</span>
              <p className="text-xs font-semibold text-zinc-200 truncate">{userEmail}</p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Plano Atual</span>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-indigo-400">{plan}</p>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/30">
                  Ativo
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 2: PREFERÊNCIAS DE IA & ESTÚDIO */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Automações de IA</h2>
              <p className="text-[11px] text-zinc-400 leading-normal">Configure os módulos automáticos do pipeline de vídeo.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2 divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between pt-3 first:pt-0">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-zinc-200 block">Enquadramento IA 100% Automático</span>
                <span className="text-[11px] text-zinc-500 leading-normal block">
                  Identifica e centraliza rostos e palestrantes automaticamente sem necessidade de ajustes manuais.
                </span>
              </div>
              <LiquidToggle checked={aiTracking} onChange={setAiTracking} activeColor="indigo" />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-zinc-200 block">Legendas Sincronizadas por Padrão</span>
                <span className="text-[11px] text-zinc-500 leading-normal block">
                  Gera transcrição temporal automática palavra por palavra em novos cortes.
                </span>
              </div>
              <LiquidToggle checked={autoSubtitles} onChange={setAutoSubtitles} activeColor="indigo" />
            </div>
          </div>
        </section>

        {/* SEÇÃO 3: SESSÃO & SEGURANÇA */}
        <section className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Sessão & Desconexão</h2>
              <p className="text-[11px] text-zinc-400 leading-normal">Encerre sua sessão com segurança neste dispositivo.</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Deseja sair da sua conta? Você precisará entrar novamente para acessar seus projetos.
            </p>
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ml-4"
            >
              <LogOut className="w-4 h-4" />
              <span>Encerrar Sessão</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
