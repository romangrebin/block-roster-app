/**
 * Shared input hygiene for the API routes. Nothing here is an authorization check — it's the
 * layer before that: coerce untrusted JSON to the right shape, and stop a single request from
 * writing an unbounded string into an unbounded Postgres `text` column (storage bloat, and every
 * /<code> render reads all of it back).
 */

/**
 * Per-field length caps. Set well past any legitimate input — hitting one means junk, not a real
 * name or blurb. The matching client inputs carry the same numbers as `maxLength` so honest users
 * get real feedback; this is the server-side backstop.
 */
export const MAX_TEXT = {
  name: 120,
  email: 254, // RFC 5321 maximum; anything longer isn't a deliverable address
  phone: 40,
  label: 200,
  nickname: 80,
  blurb: 2000,
  publicBlurb: 2000,
  privateNotes: 5000,
  stewardNotes: 2000,
  itemName: 120,
  itemDescription: 1000,
} as const

/**
 * Trims, then truncates to `max`. A non-string becomes ''. Truncation is silent by design: the
 * caps above sit far past any real input, so the only thing being cut is abuse, and a 400 there
 * would just be noise on a request that was never legitimate.
 */
export function cappedText(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : ''
}

/** Minimal HTML-escaping for the handful of user-supplied values that end up in notification
 *  email bodies (see lib/application.ts). Not for rendering — React already escapes JSX. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
