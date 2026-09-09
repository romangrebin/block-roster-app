import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward } from '@/lib/application'

// Bulk-creates residences from a plain label list — parcel-import and floor-plan modes are
// deferred, this is the only path for now.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const steward = await resolveActiveSteward(blockId, user.id)
  if (!steward) return NextResponse.json({ error: 'Not a steward of this community' }, { status: 403 })

  const body = await request.json()
  const rawLabels: unknown[] = Array.isArray(body.labels) ? body.labels : []
  const labels = rawLabels
    .map((label) => (typeof label === 'string' ? label.trim() : ''))
    .filter((label) => label.length > 0)
  if (labels.length === 0) {
    return NextResponse.json({ error: 'At least one residence label is required' }, { status: 400 })
  }

  const repo = getRepository()
  try {
    // Sequential, not Promise.all — on a duplicate-label failure this stops cleanly instead of
    // racing inserts with unpredictable partial-success ordering.
    const residences = []
    for (const label of labels) {
      residences.push(await repo.residences.create({ blockId, label }))
    }
    return NextResponse.json({ residences }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add residences'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
