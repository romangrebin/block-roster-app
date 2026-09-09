import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { promoteResidentToSteward, resolveActiveSteward } from '@/lib/application'

/** An active steward promotes an approved resident of their own community to co-steward. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 })

  const residence = await repo.residences.getById(resident.residenceId)
  if (!residence) return NextResponse.json({ error: 'Residence not found' }, { status: 404 })

  const steward = await resolveActiveSteward(residence.blockId, user.id)
  if (!steward) return NextResponse.json({ error: 'Not a steward of this community' }, { status: 403 })

  try {
    const promoted = await promoteResidentToSteward(residentId, steward.id)
    return NextResponse.json({ steward: promoted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to promote resident'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
