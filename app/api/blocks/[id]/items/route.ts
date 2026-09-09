import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveApprovedResident } from '@/lib/application'
import { ITEM_CATEGORIES, type ItemCategory } from '@/lib/types'

function parseCategory(value: unknown): ItemCategory {
  return (ITEM_CATEGORIES as readonly string[]).includes(value as string) ? (value as ItemCategory) : 'other'
}

/** An approved resident adds an item to the Lending Library, listed under their own resident row. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const resident = await resolveApprovedResident(blockId, user.id)
  if (!resident) {
    return NextResponse.json({ error: 'Not an approved resident of this community' }, { status: 403 })
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 })
  const description = typeof body.description === 'string' ? body.description.trim() || null : null

  const item = await getRepository().items.create({
    residentId: resident.id,
    name,
    description,
    category: parseCategory(body.category),
  })
  return NextResponse.json({ item }, { status: 201 })
}
