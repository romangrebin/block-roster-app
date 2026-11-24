import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { COMMUNITY_CREATION_OPEN, MAX_FOUNDED_COMMUNITIES_PER_USER, isAdmin } from '@/lib/admin'
import { createBlock, countFoundedCommunities } from '@/lib/application'
import { validatePolygonGeometry, MAX_BLOCK_AREA_KM2 } from '@/lib/geometryValidation'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import type { BlockInput } from '@/lib/types'

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  if (!COMMUNITY_CREATION_OPEN) {
    return NextResponse.json({ error: 'New communities are paused right now' }, { status: 403 })
  }
  if (!isAdmin(user.email) && (await countFoundedCommunities(user.id)) >= MAX_FOUNDED_COMMUNITIES_PER_USER) {
    return NextResponse.json(
      { error: `You can create up to ${MAX_FOUNDED_COMMUNITIES_PER_USER} communities` },
      { status: 403 }
    )
  }

  const body = await request.json()
  const name = cappedText(body.name, MAX_TEXT.name)
  if (!name) return NextResponse.json({ error: 'Community name is required' }, { status: 400 })

  if (!body.boundary) return NextResponse.json({ error: 'Draw your community’s boundary first' }, { status: 400 })
  const validation = validatePolygonGeometry(body.boundary, MAX_BLOCK_AREA_KM2)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const input: BlockInput = { name, boundary: body.boundary }

  const block = await createBlock(input, { id: user.id, email: user.email ?? null })
  return NextResponse.json({ block }, { status: 201 })
}
