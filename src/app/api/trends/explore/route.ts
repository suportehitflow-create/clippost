import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const params = new URLSearchParams()
    if (searchParams.get('category')) params.set('category', searchParams.get('category')!)
    if (searchParams.get('query')) params.set('query', searchParams.get('query')!)

    const res = await fetch(`${BACKEND}/api/trends/explore?${params}`, {
      next: { revalidate: 300 }, // cache 5 min
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}
