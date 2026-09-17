import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const flyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://clippost-backend.fly.dev'

    const res = await fetch(`${flyUrl}/api/billing/portal/${userId}`)
    if (!res.ok) {
      return NextResponse.json({ url: '/billing' })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ url: '/billing' })
  }
}
