import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { ITEM_CATEGORIES, type ItemCategory } from '@/lib/types'
import type { BlockRosterRepository } from '@/lib/repository'

function parseCategory(value: unknown): ItemCategory | undefined {
  return (ITEM_CATEGORIES as readonly string[]).includes(value as string) ? (value as ItemCategory) : undefined
}

/** Owner (via their verified contact's userId, same as blurb/visibility/phone) or a steward of
 * the item's block — either can edit/delete a listing. */
async function authorizeItemAccess(
  itemId: string,
  request: NextRequest
): Promise<{ repo: BlockRosterRepository } | { error: NextResponse }> {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }

  const repo = getRepository()
  const item = await repo.items.getById(itemId)
  if (!item) return { error: NextResponse.json({ error: 'Item not found' }, { status: 404 }) }

  const resident = await repo.residents.getById(item.residentId)
  if (!resident) return { error: NextResponse.json({ error: 'Item not found' }, { status: 404 }) }

  const contacts = await repo.contactMethods.listByResident(resident.id)
  if (contacts.some((c) => c.userId === user.id)) return { repo }

  const residence = await repo.residences.getById(resident.residenceId)
  const steward = residence ? await resolveActiveSteward(residence.blockId, user.id) : null
  if (!steward) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  return { repo }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params
  const auth = await authorizeItemAccess(itemId, request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const patch: { name?: string; description?: string | null; category?: ItemCategory } = {}
  if (typeof body.name === 'string') {
    const name = cappedText(body.name, MAX_TEXT.itemName)
    if (!name) return NextResponse.json({ error: 'Item name cannot be empty' }, { status: 400 })
    patch.name = name
  }
  if (typeof body.description === 'string') patch.description = cappedText(body.description, MAX_TEXT.itemDescription) || null
  const category = parseCategory(body.category)
  if (category) patch.category = category

  const item = await auth.repo.items.update(itemId, patch)
  return NextResponse.json({ item })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params
  const auth = await authorizeItemAccess(itemId, request)
  if ('error' in auth) return auth.error

  await auth.repo.items.delete(itemId)
  return NextResponse.json({ ok: true })
}
