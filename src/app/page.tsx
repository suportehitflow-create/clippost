import Link from 'next/link'
import { Scissors, Zap, Calendar, Download, ArrowRight, Check } from 'lucide-react'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 0, background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem' }}>
          <Scissors size={22} color="var(--accent)" />
          <span>Clip<span style={{ color: 'var(--accent)' }}>Post</span></span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/login" style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>Entrar</Link>
          <Link href="/signup" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Começar grátis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 2rem 4rem', maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '999px', padding: '0.35rem 1rem', fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '2rem' }}>
          <Zap size={13} />
          Powered by AI — sem conta, sem marca d'água no free
        </div>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
          Transforme qualquer vídeo em<br />
          <span style={{ color: 'var(--accent)' }}>clipes virais</span> em minutos
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--muted)', maxWidth: '560px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          Cole um link do YouTube ou faça upload de um vídeo. A IA detecta os melhores momentos, recorta em 9:16 com legendas e você agenda direto para TikTok, Reels e Shorts.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '0.75rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1rem', boxShadow: '0 0 24px var(--accent-glow)' }}>
            Testar grátis <ArrowRight size={18} />
          </Link>
          <Link href="#como-funciona" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '0.75rem', border: '1px solid var(--card-border)', color: 'var(--foreground)', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>
            Ver como funciona
          </Link>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '3rem' }}>Como funciona</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {[
            { icon: <Download size={24} />, step: '01', title: 'Importe o vídeo', desc: 'Cole um link do YouTube ou faça upload direto. Suportamos MP4, MOV e mais.' },
            { icon: <Zap size={24} />, step: '02', title: 'IA analisa', desc: 'Detectamos automaticamente os momentos mais engajantes, ganchos virais e speakers.' },
            { icon: <Scissors size={24} />, step: '03', title: 'Clipes prontos', desc: 'Recorte automático em 9:16, legendas sincronizadas e rosto centralizado.' },
            { icon: <Calendar size={24} />, step: '04', title: 'Agende e publique', desc: 'Poste imediatamente ou agende para TikTok, Instagram Reels e YouTube Shorts.' },
          ].map((item) => (
            <div key={item.step} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '1rem' }}>{item.icon}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>{item.step}</div>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.05rem' }}>{item.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section style={{ padding: '4rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '3rem' }}>Planos simples</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {[
            { name: 'Free', price: 'R$0', period: '/mês', features: ['5 clipes/mês', 'Vídeos até 30 min', 'Download com marca d\'água', 'Legendas automáticas'], highlight: false },
            { name: 'Pro', price: 'R$29', period: '/mês', features: ['100 clipes/mês', 'Vídeos até 2h', 'Sem marca d\'água', 'Agendamento em redes sociais', 'Suporte prioritário'], highlight: true },
            { name: 'Business', price: 'R$79', period: '/mês', features: ['Clipes ilimitados', 'Vídeos ilimitados', 'Sem marca d\'água', 'Agendamento ilimitado', 'API access', 'Suporte dedicado'], highlight: false },
          ].map((plan) => (
            <div key={plan.name} style={{ background: plan.highlight ? 'var(--accent)' : 'var(--card)', border: `1px solid ${plan.highlight ? 'transparent' : 'var(--card-border)'}`, borderRadius: '1rem', padding: '2rem', boxShadow: plan.highlight ? '0 0 32px var(--accent-glow)' : 'none' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--muted)', fontSize: '0.9rem' }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'var(--foreground)' }}>
                    <Check size={14} /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" style={{ display: 'block', textAlign: 'center', padding: '0.75rem', borderRadius: '0.5rem', background: plan.highlight ? 'rgba(255,255,255,0.15)' : 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                {plan.name === 'Free' ? 'Começar grátis' : `Assinar ${plan.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem', borderTop: '1px solid var(--card-border)' }}>
        © 2025 ClipPost. Todos os direitos reservados.
      </footer>
    </main>
  )
}
