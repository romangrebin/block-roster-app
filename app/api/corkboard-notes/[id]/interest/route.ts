import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveCorkboardNoteAccess } from '@/lib/application'

/** A neighbor (not the author) raises or lowers their hand on a note. */
async function resolveInterestedNeighbor(request: NextRequest, noteId: string) {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }

  const access = await resolveCorkboardNoteAccess(noteId, user.id)
  if ('error' in access) return { error: NextResponse.json({ error: access.error }, { status: access.status }) }
  if (!access.viewer) return { error: NextResponse.json({ error: 'Only residents can mark interest' }, { status: 403 }) }
  if (access.isAuthor) return { error: NextResponse.json({ error: "That's your own note" }, { status: 400 }) }
  return { residentId: access.viewer.id }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: noteId } = await params
  const result = await resolveInterestedNeighbor(request, noteId)
  if ('error' in result) return result.error

  await getRepository().corkboardInterests.add(noteId, result.residentId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: noteId } = await params
  const result = await resolveInterestedNeighbor(request, noteId)
  if ('error' in result) return result.error

  await getRepository().corkboardInterests.remove(noteId, result.residentId)
  return NextResponse.json({ ok: true })
}
