import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { resolveActiveSteward } from '@/lib/application'
import { getRepository } from '@/lib/db'
import { validateBlockCode, blockCodeErrorMessage } from '@/lib/blockCode'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'
import type { BlockInput } from '@/lib/types'

// Steward-only: edits the community's name, code, public blurb, and private notes. Creating a
// community and drawing its boundary happen elsewhere (app/api/blocks/route.ts) — this route is
// just for the content a steward keeps up to date afterward.
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
  if (typeof body.publicBlurb === 'string') patch.publicBlurb = cappedText(body.publicBlurb, MAX_TEXT.publicBlurb) || null
  if (typeof body.privateNotes === 'string') patch.privateNotes = cappedText(body.privateNotes, MAX_TEXT.privateNotes) || null
  if (typeof body.residentExportEnabled === 'boolean') patch.residentExportEnabled = body.residentExportEnabled
  if (typeof body.lendingLibraryEnabled === 'boolean') patch.lendingLibraryEnabled = body.lendingLibraryEnabled

  try {
    const block = await getRepository().blocks.update(blockId, patch)
    return NextResponse.json({ block })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update community') }, { status: 400 })
  }
}
