import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward } from '@/lib/application'
import { validatePolygonGeometry, MAX_PARCEL_AREA_KM2 } from '@/lib/geometryValidation'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'
import type { ResidenceInput } from '@/lib/types'

/** Steward-only: rename a residence or set its map shape (see components/DrawableMap.tsx). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residenceId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const residence = await repo.residences.getById(residenceId)
  if (!residence) return NextResponse.json({ error: 'Residence not found' }, { status: 404 })

  const steward = await resolveActiveSteward(residence.blockId, user.id)
  if (!steward) return NextResponse.json({ error: 'Not a steward of this community' }, { status: 403 })

  const body = await request.json()
  const patch: Partial<ResidenceInput> = {}
  if (typeof body.label === 'string') {
    const label = cappedText(body.label, MAX_TEXT.label)
    if (!label) return NextResponse.json({ error: 'Label cannot be empty' }, { status: 400 })
    patch.label = label
  }
  if (body.shape !== undefined) {
    // Guards against a residence's shape accidentally being drawn far larger than a real
    // address/parcel (e.g. tracing most of the community by mistake) — the same failsafe
    // already applied to the community's own boundary, one size class down.
    const validation = validatePolygonGeometry(body.shape, MAX_PARCEL_AREA_KM2)
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
    patch.shape = body.shape
  }

  try {
    const updated = await repo.residences.update(residenceId, patch)
    return NextResponse.json({ residence: updated })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update residence') }, { status: 400 })
  }
}

/** Steward-only: removes a residence and (via FK cascade) every resident/contact under it. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residenceId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const residence = await repo.residences.getById(residenceId)
  if (!residence) return NextResponse.json({ error: 'Residence not found' }, { status: 404 })

  const steward = await resolveActiveSteward(residence.blockId, user.id)
  if (!steward) return NextResponse.json({ error: 'Not a steward of this community' }, { status: 403 })

  await repo.residences.delete(residenceId)
  return NextResponse.json({ ok: true })
}
