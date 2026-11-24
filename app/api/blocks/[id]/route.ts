import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { resolveActiveSteward, deleteCommunityBeforeNeighborsJoin } from '@/lib/application'
import { getRepository } from '@/lib/db'
import { validateBlockCode, blockCodeErrorMessage } from '@/lib/blockCode'
import { cappedText, MAX_TEXT, parseSignupPromptKeys } from '@/lib/validation'
import { validatePolygonGeometry, MAX_BLOCK_AREA_KM2 } from '@/lib/geometryValidation'
import { clientErrorMessage } from '@/lib/apiError'
import type { BlockInput } from '@/lib/types'

// Steward-only: edits the community's name, code, boundary, public blurb, private notes and
// settings, or deletes it before any neighbor has joined. Creating one is app/api/blocks/route.ts.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { id: blockId } = await params
  const steward = await resolveActiveSteward(blockId, user.id)
  if (!steward) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  const patch: Partial<BlockInput> = {}

  if (typeof body.name === 'string') {
    const name = cappedText(body.name, MAX_TEXT.name)
    if (!name) return NextResponse.json({ error: 'Community name cannot be empty' }, { status: 400 })
    patch.name = name
  }
  if (typeof body.code === 'string') {
    const result = validateBlockCode(body.code)
    if ('error' in result) {
      return NextResponse.json({ error: blockCodeErrorMessage(result.error) }, { status: 400 })
    }
    patch.code = result.code
  }
  if (body.boundary) {
    const validation = validatePolygonGeometry(body.boundary, MAX_BLOCK_AREA_KM2)
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
    patch.boundary = body.boundary
  }
  if (typeof body.publicBlurb === 'string') patch.publicBlurb = cappedText(body.publicBlurb, MAX_TEXT.publicBlurb) || null
  if (typeof body.privateNotes === 'string') patch.privateNotes = cappedText(body.privateNotes, MAX_TEXT.privateNotes) || null
  if (typeof body.residentExportEnabled === 'boolean') patch.residentExportEnabled = body.residentExportEnabled
  if (typeof body.lendingLibraryEnabled === 'boolean') patch.lendingLibraryEnabled = body.lendingLibraryEnabled
  if (typeof body.borrowRequestsEnabled === 'boolean') patch.borrowRequestsEnabled = body.borrowRequestsEnabled
  if (typeof body.corkboardEnabled === 'boolean') patch.corkboardEnabled = body.corkboardEnabled
  if (typeof body.autoApproveJoins === 'boolean') patch.autoApproveJoins = body.autoApproveJoins
  if (Array.isArray(body.hiddenSignupPrompts)) patch.hiddenSignupPrompts = parseSignupPromptKeys(body.hiddenSignupPrompts)

  try {
    const block = await getRepository().blocks.update(blockId, patch)
    return NextResponse.json({ block })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update community') }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { id: blockId } = await params
  const result = await deleteCommunityBeforeNeighborsJoin(blockId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
