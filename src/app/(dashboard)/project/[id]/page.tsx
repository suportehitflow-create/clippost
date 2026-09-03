import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProjectClient from './ProjectClient'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!project) notFound()

  const { data: clips } = await supabase
    .from('clips')
    .select('*')
    .eq('project_id', id)
    .order('score', { ascending: false })

  return <ProjectClient project={project} clips={clips ?? []} />
}
