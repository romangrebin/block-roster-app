import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { authorizeOwnResident } from '@/lib/application'
import { parseProfile } from '@/lib/validation'
import { clientErrorMessage } from '@/lib/apiError'

/** A resident edits their own sign-up prompts (year moved in, favorite spot, …) — same ownership check as blurb. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: residentId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const auth = await authorizeOwnResident(residentId, user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const repo = getRepository()
    const updated = await repo.residents.setProfile(residentId, parseProfile(await request.json()))
    return NextResponse.json({ resident: updated })
  } catch (err) {
    return NextResponse.json({ error: clientErrorMessage(err, 'Failed to update profile') }, { status: 400 })
  }
}
