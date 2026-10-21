import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { deleteExpeditionRun } from '@/lib/application'

// Steward-only: removes one run from the Bodie demo's Past expeditions list.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const result = await deleteExpeditionRun(runId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
