import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createBlock } from '@/lib/application'
import { validatePolygonGeometry, MAX_BLOCK_AREA_KM2 } from '@/lib/geometryValidation'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import type { BlockInput } from '@/lib/types'

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const body = await request.json()
  const name = cappedText(body.name, MAX_TEXT.name)
  if (!name) return NextResponse.json({ error: 'Community name is required' }, { status: 400 })

  const input: BlockInput = { name }
  if (body.boundary) {
    const validation = validatePolygonGeometry(body.boundary, MAX_BLOCK_AREA_KM2)
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
    input.boundary = body.boundary
  }

  const block = await createBlock(input, user.id)
  return NextResponse.json({ block }, { status: 201 })
}
