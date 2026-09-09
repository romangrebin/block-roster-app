import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { getRepository } from '@/lib/db'

// Cascades via the DB's ON DELETE CASCADE foreign keys — removes the community's residences,
// residents, contact methods, and stewards along with it.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { id } = await params
  await getRepository().blocks.delete(id)
  return NextResponse.json({ ok: true })
}
