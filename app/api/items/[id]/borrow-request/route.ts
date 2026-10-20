import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { requestToBorrow } from '@/lib/application'

// An approved resident asks to borrow a neighbor's Lending Library item.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { id: itemId } = await params
  const result = await requestToBorrow(itemId, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
