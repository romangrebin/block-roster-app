import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'

/** A resident narrows/widens visibility of their own verified contact method. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contactMethodId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const contactMethod = await repo.contactMethods.getById(contactMethodId)
  if (!contactMethod) return NextResponse.json({ error: 'Contact method not found' }, { status: 404 })
  if (contactMethod.userId !== user.id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  if (body.visibility !== 'block_wide' && body.visibility !== 'steward_only') {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
  }

  const updated = await repo.contactMethods.setVisibility(contactMethodId, body.visibility)
  return NextResponse.json({ contactMethod: updated })
}
