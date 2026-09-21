import { NextRequest, NextResponse } from 'next/server'
import { evaluateWithJev } from '@/lib/jev'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, hook, transcriptSnippet, duration } = body

    const result = await evaluateWithJev({
      title: title || '',
      hook: hook || null,
      transcriptSnippet: transcriptSnippet || '',
      duration: duration || 30
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar com Jev' },
      { status: 500 }
    )
  }
}
