import { NextRequest } from 'next/server'
import { POST as socialPost } from '@/app/api/social/connect/route'

export async function POST(req: NextRequest) {
  return socialPost(req)
}
