import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { recordExpeditionRun } from '@/lib/application'

// A Bodie demo player finished an Expedition run.
export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const body = await request.json()
  const result = await recordExpeditionRun(user.id, body.party, body.items)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
