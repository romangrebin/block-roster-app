import { createSupabaseAdminClient } from './supabase-admin'
import { createSupabaseRepository } from './adapters/supabase'
import type { BlockRosterRepository } from './repository'

/**
 * Single point where the app picks a repository adapter. Only the supabase adapter exists so
 * far — mock/json-file adapters (lib/adapters/{mock,json-file}.ts) are deferred until the
 * live end-to-end flow has been through a real steward and its shape has stabilized, per
 * notes/scaffold-status.md.
 */
let repository: BlockRosterRepository | null = null

export function getRepository(): BlockRosterRepository {
  if (!repository) {
    repository = createSupabaseRepository(createSupabaseAdminClient())
  }
  return repository
}
