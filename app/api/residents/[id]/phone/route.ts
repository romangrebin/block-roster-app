import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import type { ContactVisibility } from '@/lib/types'

function parseVisibility(value: unknown): ContactVisibility {
  return value === 'steward_only' ? 'steward_only' : 'block_wide'
}

async function authorizeOwnResident(residentId: string, request: NextRequest) {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }

  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) return { error: NextResponse.json({ error: 'Resident not found' }, { status: 404 }) }

  const contacts = await repo.contactMethods.listByResident(residentId)
  const owns = contacts.some((c) => c.userId === user.id)
  if (!owns) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }

  return { repo, contacts }
}

/**
 * A resident adds a phone number they skipped at registration — ownership verified the same way
 * as blurb/visibility, via an existing verified contact method's userId. Only fills a gap; a
 * resident who already has one on file gets a 400 here, and should PATCH instead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const auth = await authorizeOwnResident(residentId, request)
  if (auth.error) return auth.error
  const { repo, contacts } = auth

  if (contacts.some((c) => c.type === 'phone')) {
    return NextResponse.json({ error: 'A phone number is already on file' }, { status: 400 })
  }

  const body = await request.json()
  const value = cappedText(body.value, MAX_TEXT.phone)
  if (!value) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })

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
  const auth = await authorizeOwnResident(residentId, request)
  if (auth.error) return auth.error
  const { repo, contacts } = auth

  const existingPhone = contacts.find((c) => c.type === 'phone')
  if (!existingPhone) return NextResponse.json({ error: 'No phone number on file yet' }, { status: 404 })

  const body = await request.json()
  const value = cappedText(body.value, MAX_TEXT.phone)
  if (!value) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })

  const contactMethod = await repo.contactMethods.setValue(existingPhone.id, value)
  return NextResponse.json({ contactMethod })
}
