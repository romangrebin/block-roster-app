import { NextRequest, NextResponse } from 'next/server'
import { getRepository } from '@/lib/db'

// Printed QR codes point here. The redirect is temporary (307) on purpose: the community's code
// can be renamed, so browsers must not cache where a print code leads.
export async function GET(request: NextRequest, { params }: { params: Promise<{ printCode: string }> }) {
  const { printCode } = await params
  const block = await getRepository().blocks.getByPrintCode(printCode.toLowerCase())
  if (!block) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(new URL(`/${block.code}`, request.url))
}
