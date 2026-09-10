import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward } from '@/lib/application'

/**
 * Steward-only: removes a pending resident (and their contact methods, via FK cascade) —
 * cleans up an abandoned or mistaken registration attempt. Deliberately pending-only — an
 * approved resident has real history and should go through "Move out" instead, which preserves
 * a record rather than deleting it outright.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (resident.status !== 'pending') {
    return NextResponse.json({ error: 'Only a pending registration can be removed this way' }, { status: 400 })
  }

  await repo.residents.delete(residentId)
  return NextResponse.json({ ok: true })
}
