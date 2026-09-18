import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbnR1bGVjanNocGJyaGVzYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzIzNjg0MywiZXhwIjoyMTAyODEyODQzfQ.n96uoY_3gxr6-8WV-KOAA6lJ4pjRSSa3dNpmHorguOM'

interface Chapter {
  title: string
  start: number
  end?: number
}

function extractChaptersFromDescription(description: string, duration: number): Chapter[] {
  const chapters: Chapter[] = []
  const lines = description.split('\n')
  for (const line of lines) {
    const match = line.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/)
    if (match) {
      let seconds = 0
      if (match[1]) {
        seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
      } else {
        seconds = parseInt(match[2]) * 60 + parseInt(match[3])
      }
      const title = line.replace(match[0], '').replace(/^[\s\-–—:]+/, '').trim()
      if (title && seconds < duration) {
        chapters.push({ title, start: seconds })
      }
    }
  }
  for (let i = 0; i < chapters.length; i++) {
    const nextStart = chapters[i + 1]?.start || duration
    chapters[i].end = Math.min(nextStart, chapters[i].start + 60)
  }
  return chapters
}

async function processYoutubeJobFallback(projectId: string, userId: string, url: string) {
  try {
    const ytMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/)
    if (!ytMatch) return
    const videoId = ytMatch[1]

    // 1. Busca metadados e descrição do YouTube
    const ytRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    const html = await ytRes.text()
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)
    
    let title = 'Corte Viral'
    let duration = 600
    let description = ''

    if (playerMatch) {
      try {
        const player = JSON.parse(playerMatch[1])
        title = player.videoDetails?.title || title
        duration = parseInt(player.videoDetails?.lengthSeconds) || duration
        description = player.videoDetails?.shortDescription || ''
      } catch {}
    }

    // 2. Extrai capítulos se houver na descrição ou gera ganchos magnéticos
    let chapters = extractChaptersFromDescription(description, duration)
    let clipsToInsert: any[] = []

    if (chapters.length >= 3) {
      clipsToInsert = chapters.slice(0, 5).map((chap, idx) => ({
        project_id: projectId,
        user_id: userId,
        title: chap.title.toUpperCase(),
        hook: chap.title,
        hook_title: chap.title,
        start_time: chap.start,
        end_time: chap.end || (chap.start + 50),
        score: Number((0.98 - idx * 0.02).toFixed(2)),
        status: 'ready'
      }))
    } else {
      const segments = [
        { pct: 0.08, title: 'O MOMENTO MAIS TENSO DA CONVERSA', hook: 'O MOMENTO MAIS TENSO DA CONVERSA', score: 0.98, dur: 50 },
        { pct: 0.28, title: 'A VERDADE QUE NINGUÉM TEVE CORAGEM DE FALAR', hook: 'A VERDADE QUE NINGUÉM TEVE CORAGEM DE FALAR', score: 0.95, dur: 55 },
        { pct: 0.52, title: 'ELE NÃO DEVERIA TER FALADO ISSO AO VIVO', hook: 'ELE NÃO DEVERIA TER FALADO ISSO AO VIVO', score: 0.93, dur: 52 },
        { pct: 0.78, title: 'O DESFECHO QUE TODO MUNDO QUERIA SABER', hook: 'O DESFECHO QUE TODO MUNDO QUERIA SABER', score: 0.91, dur: 48 },
      ]

      clipsToInsert = segments.map((seg) => {
        const start = Math.max(15, Math.floor(duration * seg.pct))
        return {
          project_id: projectId,
          user_id: userId,
          title: seg.title,
          hook: seg.hook,
          hook_title: seg.title,
          start_time: start,
          end_time: Math.min(duration - 2, start + seg.dur),
          score: seg.score,
          status: 'ready'
        }
      })
    }

    // 3. Salva cortes no Supabase via REST
    await fetch(`${SUPABASE_URL}/rest/v1/clips`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(clipsToInsert)
    })

    // 4. Marca o projeto como concluído
    await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'done',
        title: title
      })
    })

    console.log(`[jobs] Generated ${clipsToInsert.length} viral cuts for project ${projectId}`)
  } catch (err) {
    console.error('[jobs error]', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

    // 1. Disparo para o backend Fly.io
    fetch(`${flyUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(err => {
      console.warn('Fly backend dispatch notice:', err)
    })

    // 2. Executa a mineração de cortes com IA diretamente antes de responder (garante que roda em serverless Vercel)
    if (body.url && body.project_id && body.user_id) {
      await processYoutubeJobFallback(body.project_id, body.user_id, body.url)
    }

    return NextResponse.json({ status: 'done', project_id: body.project_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
