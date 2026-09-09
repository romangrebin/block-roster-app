import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — server-only, never import this from a Client Component.
 * The repository/application layer (lib/adapters/supabase.ts, lib/application.ts) uses this
 * exclusively so RLS never blocks a legitimate server-side write; authorization is enforced by
 * the application layer itself (API routes checking steward/resident identity), not by RLS. See
 * notes/minimal-schema-proposal.md's "Data access" section.
 */
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
