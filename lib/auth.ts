import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServerComponentClient } from './supabase-server'

// Shared by stewards and residents alike — a resident's OTP verification during intake creates
// a real, persistent Supabase Auth session too (see verifyContactMethod in lib/application.ts),
// not just a one-time confirmation.

export type AuthUser = {
  id: string
  email: string
}

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

/** Same as getUser(), for Server Components, which have no NextRequest to read cookies from. */
export async function getUserFromServerComponent(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerComponentClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { id: user.id, email: user.email! }
}
