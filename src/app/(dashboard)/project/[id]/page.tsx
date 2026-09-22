import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ProjectClient from './ProjectClient'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  })

  // 1. Tenta buscar o projeto do usuário autenticado
  if (user) {
    const { data: userProj } = await admin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProj) {
      const { data: clips } = await admin
        .from('clips')
        .select('*')
        .eq('project_id', id)
        .order('score', { ascending: false })

      return <ProjectClient project={userProj} clips={clips ?? []} />
    }
  }

  // 2. Fallback resiliente: busca o projeto por ID para visualização
  const { data: project } = await admin
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!project) notFound()

  const { data: clips } = await admin
    .from('clips')
    .select('*')
    .eq('project_id', id)
    .order('score', { ascending: false })

  return <ProjectClient project={project} clips={clips ?? []} />
}
