import { NextRequest } from 'next/server'
import { GET as metaGet } from '@/app/api/auth/meta/callback/route'

export async function GET(req: NextRequest) {
  return metaGet(req)
}
