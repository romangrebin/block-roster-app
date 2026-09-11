import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { authorizeOwnResident } from '@/lib/application'
import { cappedText, MAX_TEXT, parseVisibility } from '@/lib/validation'

/**
 * A resident adds a phone number they skipped at registration — ownership verified the same way
 * as blurb/visibility, via an existing verified contact method's userId. Only fills a gap; a
 * resident who already has one on file gets a 400 here, and should PATCH instead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const auth = await authorizeOwnResident(residentId, user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (auth.contacts.some((c) => c.type === 'phone')) {
    return NextResponse.json({ error: 'A phone number is already on file' }, { status: 400 })
  }

  const body = await request.json()
  const value = cappedText(body.value, MAX_TEXT.phone)
  if (!value) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })

  const repo = getRepository()
  const contactMethod = await repo.contactMethods.create({
    residentId,
    type: 'phone',
    value,
    visibility: parseVisibility(body.visibility),
  })
  return NextResponse.json({ contactMethod }, { status: 201 })
}

/**
 * Edits the *value* of an existing phone — safe to let a resident change directly since phone is
 * never verified (no userId tied to it the way email's markVerified requires), unlike email's
 * value, which deliberately has no edit path anywhere in this app.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const auth = await authorizeOwnResident(residentId, user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const existingPhone = auth.contacts.find((c) => c.type === 'phone')
  if (!existingPhone) return NextResponse.json({ error: 'No phone number on file yet' }, { status: 404 })

  const body = await request.json()
  const value = cappedText(body.value, MAX_TEXT.phone)
  if (!value) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })

  const repo = getRepository()
  const contactMethod = await repo.contactMethods.setValue(existingPhone.id, value)
  return NextResponse.json({ contactMethod })
}
