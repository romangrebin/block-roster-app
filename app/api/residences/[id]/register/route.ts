import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { registerResident, verifyAndMaybeAutoApprove } from '@/lib/application'
import { cappedText, MAX_TEXT } from '@/lib/validation'
import type { ContactVisibility } from '@/lib/types'

function parseVisibility(value: unknown): ContactVisibility {
  return value === 'steward_only' ? 'steward_only' : 'block_wide'
}

// No signed-in session required — this is how a resident gets their first one. The contact
// method created here normally stays unverified until they tap the confirmation link sent to
// app/[code]/complete. Exception: if the caller is already signed in under this exact email,
// a prior magic link already proved they control it — verify (and auto-approve, if they're a
// steward) right here instead of sending another one just to prove the same thing twice.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residenceId } = await params
  const body = await request.json()

  const name = cappedText(body.name, MAX_TEXT.name)
  const email = cappedText(body.email, MAX_TEXT.email)
  const phone = cappedText(body.phone, MAX_TEXT.phone)
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  try {
    const { resident, contactMethod } = await registerResident(
      residenceId,
      name,
      { type: 'email', value: email, visibility: parseVisibility(body.emailVisibility) },
      phone ? { value: phone, visibility: parseVisibility(body.phoneVisibility) } : undefined
    )

    const user = await getUser(request)
    let autoVerified = false
    let autoApproved = false
    if (user && user.email.toLowerCase() === email.toLowerCase()) {
      const result = await verifyAndMaybeAutoApprove(contactMethod.id, user.id, email)
      autoVerified = true
      autoApproved = result.autoApproved
    }

    return NextResponse.json(
      { residentId: resident.id, contactMethodId: contactMethod.id, autoVerified, autoApproved },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
