import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/** For Route Handlers, where a NextRequest/NextResponse pair is available to carry cookies. */
export function createSupabaseServerClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

/**
 * For Server Components, which have no NextRequest/NextResponse — only next/headers'
 * cookies(). Effectively read-only: Server Components can't write response cookies, so setAll
 * below is a no-op; proxy.ts is what actually refreshes the session.
 */
export async function createSupabaseServerComponentClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — cookies() is read-only there. Safe to ignore
          // since proxy.ts refreshes the session on every request anyway.
        }
      },
    },
  })
}
