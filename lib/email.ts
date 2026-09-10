/**
 * Minimal transactional email sender via Resend's HTTP API — the same provider/domain already
 * verified for Supabase Auth's own SMTP (see notes/scaffold-status.md's Infra section). A plain
 * fetch call rather than pulling in Resend's SDK for the one endpoint this needs.
 *
 * Deliberately never throws: a notification email failing should never break whatever real
 * action triggered it (same graceful-degradation stance as lib/overpass.ts's suggestions) — logs
 * and gives up instead. Also a no-op if `RESEND_API_KEY`/`RESEND_FROM_EMAIL` aren't set, so local
 * dev without them configured doesn't need to care.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[]
  subject: string
  html: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from || to.length === 0) return

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error(`[email] Resend request failed: ${res.status} ${await res.text()}`)
    }
  } catch (err) {
    console.error('[email] failed to send', err)
  }
}
