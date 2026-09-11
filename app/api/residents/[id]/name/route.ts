import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { authorizeOwnResident } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'

/** A resident edits their own name — ownership verified via their verified contact method's
 *  userId, same pattern as the blurb route. Name is set once at registration and otherwise
 *  only changeable here. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const auth = await authorizeOwnResident(residentId, user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const name = cappedText(body.name, MAX_TEXT.name)
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const repo = getRepository()
    const updated = await repo.residents.setName(residentId, name)
    return NextResponse.json({ resident: updated })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update name') }, { status: 400 })
  }
}
