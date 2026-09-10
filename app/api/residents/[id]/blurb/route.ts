import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'

/** A resident edits their own freeform blurb — ownership verified via their verified contact method's userId. */
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
  const blurb = cappedText(body.blurb, MAX_TEXT.blurb) || null

  try {
    const updated = await repo.residents.setBlurb(residentId, blurb)
    return NextResponse.json({ resident: updated })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update blurb') }, { status: 400 })
  }
}
