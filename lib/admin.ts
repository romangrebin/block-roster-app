/**
 * Admin gating for /admin and its API routes — an env var allowlist, not a role in the data
 * model. Deliberately the smallest thing that works: this is a one-person tool for now.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
