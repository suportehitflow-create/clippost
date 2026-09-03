import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Upload, Scissors, Clock, CheckCircle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const stats = {
    total: projects?.length ?? 0,
    processing: projects?.filter(p => p.status === 'processing').length ?? 0,
    done: projects?.filter(p => p.status === 'done').length ?? 0,
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--muted)' }}>Seus projetos de clipes</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total de projetos', value: stats.total, icon: <Scissors size={18} /> },
          { label: 'Processando', value: stats.processing, icon: <Clock size={18} /> },
          { label: 'Concluídos', value: stats.done, icon: <CheckCircle size={18} /> },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>{s.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{s.value}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Projects list */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem' }}>Projetos recentes</h2>
          <Link href="/upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
            <Upload size={14} /> Novo projeto
          </Link>
        </div>
        {!projects || projects.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
            <Scissors size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Nenhum projeto ainda</p>
            <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Importe um vídeo para gerar seus primeiros clipes virais</p>
            <Link href="/upload" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
              Importar vídeo
            </Link>
          </div>
        ) : (
          <div>
            {projects.map((p) => (
              <Link key={p.id} href={`/project/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--card-border)', textDecoration: 'none', color: 'var(--foreground)' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{p.title ?? 'Sem título'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '999px', background: p.status === 'done' ? 'rgba(16,185,129,0.15)' : p.status === 'processing' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)', color: p.status === 'done' ? 'var(--success)' : p.status === 'processing' ? 'var(--warning)' : 'var(--muted)', fontWeight: 600 }}>
                  {p.status === 'done' ? 'Pronto' : p.status === 'processing' ? 'Processando' : p.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
