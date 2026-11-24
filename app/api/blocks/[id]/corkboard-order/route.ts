import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward, resolveApprovedResident } from '@/lib/application'
import { CORKBOARD_COLUMN_COUNT } from '@/lib/types'

/**
 * Rearranges the Corkboard. Like a real board, any resident or steward can move any note.
 * Takes `columns`: for each of the board's columns, its note ids top to bottom. Ids from other
 * communities, and repeats, are ignored.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const [block, resident, steward] = await Promise.all([
    repo.blocks.getById(blockId),
    resolveApprovedResident(blockId, user.id),
    resolveActiveSteward(blockId, user.id),
  ])
  if (!block?.corkboardEnabled) return NextResponse.json({ error: 'The Corkboard is turned off here' }, { status: 403 })
  if (!resident && !steward) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { columns } = await request.json()
  const isValidLayout =
    Array.isArray(columns) &&
    columns.length === CORKBOARD_COLUMN_COUNT &&
    columns.every((column) => Array.isArray(column) && column.every((id) => typeof id === 'string'))
  if (!isValidLayout) return NextResponse.json({ error: 'Invalid board layout' }, { status: 400 })

  const unplacedIds = new Set((await repo.corkboardNotes.listByBlock(blockId)).map((note) => note.id))
  const layout = (columns as string[][]).map((column) =>
    column.filter((id) => unplacedIds.delete(id))
  )
  await repo.corkboardNotes.setLayout(layout)
  return NextResponse.json({ ok: true })
}
