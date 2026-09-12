import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { demoteSteward } from '@/lib/application'

/** An active steward demotes another steward (or themselves) back to a regular resident. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: stewardId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const result = await demoteSteward(stewardId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ steward: result.steward })
}
