import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { promoteResidentToSteward, resolveStewardForResident } from '@/lib/application'

/** An active steward promotes an approved resident of their own community to co-steward. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const result = await resolveStewardForResident(residentId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  try {
    const promoted = await promoteResidentToSteward(residentId, result.steward.id)
    return NextResponse.json({ steward: promoted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to promote resident'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
