import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { adminEmails, communityRequestsEnabled } from '@/lib/admin'
import { sendEmail } from '@/lib/email'
import { cappedText, escapeHtml, MAX_TEXT } from '@/lib/validation'

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * A request to start a community, emailed to the admins with Reply-To the requester. Open to
 * signed-out visitors, who type their own email; a signed-in visitor's verified email is used instead.
 */
export async function POST(request: NextRequest) {
  if (!communityRequestsEnabled()) {
    return NextResponse.json({ error: "Requests can't be sent right now" }, { status: 503 })
  }

  const body = await request.json()
  // The honeypot: a field hidden from people, so only a bot fills it. Pretend it worked.
  if (cappedText(body.website, MAX_TEXT.label)) return NextResponse.json({ sent: true })

  const message = cappedText(body.message, MAX_TEXT.communityRequest)
  if (!message) return NextResponse.json({ error: 'Tell us a little about your community' }, { status: 400 })

  const user = await getUser(request)
  const replyTo = user?.email ?? cappedText(body.email, MAX_TEXT.email)
  if (!LOOKS_LIKE_EMAIL.test(replyTo)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const recipients = adminEmails()
  if (recipients.length === 0) {
    console.error('[community-requests] ADMIN_EMAILS is not set; request not delivered')
    return NextResponse.json({ error: "Requests can't be sent right now" }, { status: 503 })
  }

  await sendEmail({
    to: recipients,
    replyTo,
    subject: 'Request to start a community on Our Block',
    html: `<p><strong>${escapeHtml(replyTo)}</strong> would like to start a community${user ? '' : ' (not signed in, so this email address is unverified)'}:</p>
<p style="white-space: pre-wrap">${escapeHtml(message)}</p>
<p>Reply to this email to reach them.</p>`,
  })
  return NextResponse.json({ sent: true })
}
