import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveStewardForResident } from '@/lib/application'

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

  const result = await resolveStewardForResident(residentId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  if (result.resident.status !== 'pending') {
    return NextResponse.json({ error: 'Only a pending registration can be removed this way' }, { status: 400 })
  }

  const repo = getRepository()
  await repo.residents.delete(residentId)
  return NextResponse.json({ ok: true })
}
