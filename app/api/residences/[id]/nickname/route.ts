import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'

/**
 * A resident's friendlier name for their own residence — separate from the steward-owned,
 * address-based label. Authorized for a steward, or any *approved* resident of that residence
 * (checked via a verified contact method's userId, same ownership pattern as the blurb route) —
 * deliberately not restricted to just one resident when a residence has several (roommates).
 * Matches what the UI exposes: the editor only renders for a steward or an approved resident.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residenceId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const residence = await repo.residences.getById(residenceId)
  if (!residence) return NextResponse.json({ error: 'Residence not found' }, { status: 404 })

  const steward = await resolveActiveSteward(residence.blockId, user.id)
  if (!steward) {
    const residents = await repo.residents.listByResidence(residenceId)
    let owns = false
    for (const resident of residents) {
      if (resident.status !== 'approved') continue
      const contacts = await repo.contactMethods.listByResident(resident.id)
      if (contacts.some((c) => c.userId === user.id)) {
        owns = true
        break
      }
    }
    if (!owns) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()
  const nickname = cappedText(body.nickname, MAX_TEXT.nickname) || null

  try {
    const updated = await repo.residences.update(residenceId, { nickname })
    // stewardNotes is steward-eyes-only — this route also allows an approved resident (not a
    // steward) through, so strip it before it goes back over the wire to them.
    const responseResidence = steward ? updated : { ...updated, stewardNotes: null }
    return NextResponse.json({ residence: responseResidence })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update nickname') }, { status: 400 })
  }
}
