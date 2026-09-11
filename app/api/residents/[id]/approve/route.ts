import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { approveResident, resolveStewardForResident } from '@/lib/application'

/** Steward approves a pending resident of their own community. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const result = await resolveStewardForResident(residentId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const approved = await approveResident(residentId, result.steward.id)
  return NextResponse.json({ resident: approved })
}
