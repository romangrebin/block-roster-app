import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveStewardForResident } from '@/lib/application'

/**
 * Steward-only: permanently deletes a resident — and their contact methods and lending-library
 * items, via FK cascade. Offered for a pending registration (cleans up an abandoned or mistaken
 * signup) or someone already moved out. An approved resident has to go through "Move out" first
 * — deleting active history outright isn't offered.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const result = await resolveStewardForResident(residentId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  if (result.resident.status !== 'pending' && result.resident.status !== 'moved_out') {
    return NextResponse.json(
      { error: 'Only a pending registration or a moved-out resident can be removed this way' },
      { status: 400 }
    )
  }

  const repo = getRepository()
  await repo.residents.delete(residentId)
  return NextResponse.json({ ok: true })
}
