import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = (body.url || '').trim()

    if (!url) {
      return NextResponse.json({ error: 'URL necessária' }, { status: 400 })
    }

    // 1. Tenta obter do backend Fly se estiver disponível
    try {
      const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const flyRes = await fetch(`${flyUrl}/api/sources/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      }).catch(() => null)

      clearTimeout(timeoutId)

      if (flyRes && flyRes.ok) {
        const data = await flyRes.json()
        return NextResponse.json(data)
      }
    } catch {
      // continua para fallback oembed
    }

    // 2. Extração via oEmbed do YouTube server-side (rápido, oficial, sem dependências)
    try {
      const oeRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      if (oeRes.ok) {
        const oe = await oeRes.json()
        return NextResponse.json({
          title: oe.title,
          thumbnail: oe.thumbnail_url || '',
          duration: 0,
          uploader: oe.author_name || '',
          platform: 'youtube',
          formats: [
            { id: '1080p', label: '1080p (Alta Qualidade)', height: 1080 },
            { id: '720p', label: '720p (Recomendado)', height: 720 },
          ],
        })
      }
    } catch {
      // continua
    }

    // 3. Fallback genérico
    return NextResponse.json({
      title: 'Vídeo importado',
      thumbnail: '',
      duration: 0,
      uploader: 'YouTube',
      platform: 'youtube',
      formats: [
        { id: '720p', label: '720p (Padrão)', height: 720 },
      ],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
