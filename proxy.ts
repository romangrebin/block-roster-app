import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Refreshes the Supabase session cookie on every request — the standard @supabase/ssr Next.js
 * pattern, so a steward's session doesn't silently expire mid-visit. Named `proxy` (not
 * `middleware`) per Next 16's file-convention rename — see node_modules/next/dist/docs's
 * file-conventions/proxy.md.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createSupabaseServerClient(request, response)
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
