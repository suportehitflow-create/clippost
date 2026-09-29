import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Quanto tempo cada vídeo levou para virar cortes (gravado pelo servidor no fim do processamento)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ detail: 'Faça login para continuar.' }, { status: 401 })
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, status, created_at, transcript->metricas')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 })
  return NextResponse.json({ projetos: data })
}
