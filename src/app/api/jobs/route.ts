import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

    // Envia ao backend real (Fly.io) que faz: download, transcrição, IA, FFmpeg
    // Fire-and-forget: o pipeline leva minutos, o frontend faz polling via /api/jobs/{project_id}
    fetch(`${flyUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(err => {
      console.warn('[jobs] backend Fly.io indisponivel:', err)
    })

    return NextResponse.json({ status: 'processing', project_id: body.project_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}