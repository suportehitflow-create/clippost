import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto não fornecido.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Se a chave service role estiver configurada no ambiente, use adminClient para ignorar RLS e foreign keys
    let db = supabase
    const hasAdminKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder'
    )

    if (hasAdminKey) {
      try {
        db = await createAdminClient()
      } catch (err) {
        console.warn('Falha ao instanciar createAdminClient, usando client comum:', err)
      }
    }

    // 1. Valida se o projeto existe e pertence ao usuário
    const { data: project } = await db
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .maybeSingle()

    if (project && project.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado. Este projeto não pertence à sua conta.' }, { status: 403 })
    }

    // 2. Busca e remove clipes associados e posts agendados
    const { data: clips } = await db
      .from('clips')
      .select('id, storage_path')
      .eq('project_id', projectId)

    if (clips && clips.length > 0) {
      const clipIds = clips.map(c => c.id)

      // Remove posts agendados
      try {
        await db
          .from('scheduled_posts')
          .delete()
          .in('clip_id', clipIds)
      } catch {}

      // Remove os clipes
      try {
        await db
          .from('clips')
          .delete()
          .eq('project_id', projectId)
      } catch {}

      // Remove os vídeos do Supabase Storage
      const storagePaths = clips.map(c => c.storage_path).filter(Boolean) as string[]
      if (storagePaths.length > 0) {
        try {
          await db.storage.from('videos').remove(storagePaths)
        } catch {}
      }
    }

    // 3. Remove arquivos originais da pasta do projeto no storage
    try {
      const folder = `${user.id}/${projectId}`
      const { data: files } = await db.storage.from('videos').list(folder)
      if (files && files.length > 0) {
        await db.storage.from('videos').remove(files.map(f => `${folder}/${f.name}`))
      }
    } catch {}

    // 4. Remove o projeto em definitivo
    const { error: delErr } = await db
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (delErr) {
      // Fallback via client autenticado se o admin falhou
      const { error: fallbackDelErr } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (fallbackDelErr) {
        throw new Error(delErr.message || fallbackDelErr.message)
      }
    }

    return NextResponse.json({ success: true, id: projectId })
  } catch (e: any) {
    console.error('Erro ao deletar projeto /api/projects/[id]:', e)
    return NextResponse.json(
      { error: e.message || 'Falha interna ao excluir projeto.' },
      { status: 500 }
    )
  }
}
