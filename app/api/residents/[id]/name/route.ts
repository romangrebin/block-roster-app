import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'

/** A resident edits their own name — ownership verified via their verified contact method's
 *  userId, same pattern as the blurb route. Name is set once at registration and otherwise
 *  only changeable here. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 })

  const contacts = await repo.contactMethods.listByResident(residentId)
  const owns = contacts.some((c) => c.userId === user.id)
  if (!owns) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  const name = cappedText(body.name, MAX_TEXT.name)
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const updated = await repo.residents.setName(residentId, name)
    return NextResponse.json({ resident: updated })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update name') }, { status: 400 })
  }
}
