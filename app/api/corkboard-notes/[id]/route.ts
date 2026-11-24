import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveCorkboardNoteAccess } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'

/** Only the author can reword their note. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { id: noteId } = await params
  const access = await resolveCorkboardNoteAccess(noteId, user.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.isAuthor) return NextResponse.json({ error: 'Only the author can edit this note' }, { status: 403 })
  if (access.note.imagePath) return NextResponse.json({ error: 'A photo note has no text to edit' }, { status: 400 })

  const text = cappedText((await request.json()).text, MAX_TEXT.corkboardNote)
  if (!text) return NextResponse.json({ error: 'A note needs some text' }, { status: 400 })

  const note = await getRepository().corkboardNotes.updateText(noteId, text)
  return NextResponse.json({ note })
}

/** The author takes their note down, or a steward removes any note. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { id: noteId } = await params
  const access = await resolveCorkboardNoteAccess(noteId, user.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.isAuthor && !access.isSteward) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const repo = getRepository()
  await repo.corkboardNotes.delete(noteId)
  if (access.note.imagePath) await repo.corkboardPhotos.remove(access.note.imagePath)
  return NextResponse.json({ ok: true })
}
