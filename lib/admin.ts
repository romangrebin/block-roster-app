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
export const COMMUNITY_CREATION_OPEN = false

/** The "start a community" request form is public, so this env var is its off switch if it ever attracts spam. */
export function communityRequestsEnabled(): boolean {
  return process.env.COMMUNITY_REQUESTS_DISABLED?.trim().toLowerCase() !== 'true'
}
