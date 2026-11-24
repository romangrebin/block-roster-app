import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveApprovedResident } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { CORKBOARD_COLUMN_COUNT, type CorkboardNote } from '@/lib/types'

/** An approved resident pins a note to their community's Corkboard, as themselves. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const [block, resident] = await Promise.all([repo.blocks.getById(blockId), resolveApprovedResident(blockId, user.id)])
  if (!block?.corkboardEnabled) return NextResponse.json({ error: 'The Corkboard is turned off here' }, { status: 403 })
  if (!resident) return NextResponse.json({ error: 'Not an approved resident of this community' }, { status: 403 })

  const text = cappedText((await request.json()).text, MAX_TEXT.corkboardNote)
  if (!text) return NextResponse.json({ error: 'A note needs some text' }, { status: 400 })

  const existingNotes = await repo.corkboardNotes.listByBlock(blockId)
  const note = await repo.corkboardNotes.create(resident.id, text, leastFilledColumn(existingNotes))
  return NextResponse.json({ note }, { status: 201 })
}

/** The column holding the fewest notes, leftmost on a tie. A new note goes on top of it. */
function leastFilledColumn(notes: CorkboardNote[]): number {
  const noteCounts = Array.from({ length: CORKBOARD_COLUMN_COUNT }, (_, column) =>
    notes.filter((note) => note.boardColumn === column).length
  )
  return noteCounts.indexOf(Math.min(...noteCounts))
}
