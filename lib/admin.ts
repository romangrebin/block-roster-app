/**
 * Admin gating for /admin and its API routes — an env var allowlist, not a role in the data
 * model. Deliberately the smallest thing that works: this is a one-person tool for now.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}

/** Flip to true to allow creating communities again. While false, /blocks/new asks everyone (admins too) for a request instead. */
export const COMMUNITY_CREATION_OPEN = true

/** Admins are exempt. Deleting a community frees its slot. */
export const MAX_FOUNDED_COMMUNITIES_PER_USER = 4

/** The public "start a community" request form: only needed while creation is closed, and the env var is its off switch if it ever attracts spam. */
export function communityRequestsEnabled(): boolean {
  if (COMMUNITY_CREATION_OPEN) return false
  return process.env.COMMUNITY_REQUESTS_DISABLED?.trim().toLowerCase() !== 'true'
}
