import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'

/**
 * Stable auth interface — wraps Supabase Auth magic links today;
 * swap the implementation here without touching any caller.
 *
 * This is steward auth specifically. Residents never get a persistent account in
 * Block Roster's model (per block-roster-brief.md) — their contact info is verified
 * once via OTP during intake, not signed in against. Only stewards sign in.
 */

export type AuthUser = {
  id: string
  email: string
}

/**
 * Resolves the signed-in steward, if any, from the request's session cookie.
 */
export async function getUser(request: NextRequest): Promise<AuthUser | null> {
  const response = NextResponse.next()
  const supabase = createSupabaseServerClient(request, response)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { id: user.id, email: user.email! }
}
