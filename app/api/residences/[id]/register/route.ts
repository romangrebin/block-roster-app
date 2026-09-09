import { NextRequest, NextResponse } from 'next/server'
import { registerResident } from '@/lib/application'
import type { ContactVisibility } from '@/lib/types'

function parseVisibility(value: unknown): ContactVisibility {
  return value === 'steward_only' ? 'steward_only' : 'block_wide'
}

// Public — no signed-in session required, this is how a resident gets their first one. The
// contact method created here stays unverified until they tap the confirmation link sent to
// app/[code]/complete.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residenceId } = await params
  const body = await request.json()

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
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
    return NextResponse.json({ residentId: resident.id, contactMethodId: contactMethod.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
