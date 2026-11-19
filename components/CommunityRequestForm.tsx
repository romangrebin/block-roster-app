'use client'

import { useState } from 'react'
import CharCount from './CharCount'
import { MAX_TEXT } from '@/lib/validation'

const INPUT_CLASS =
  'w-full border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/** Signed-in visitors are replied to at their account email; everyone else types one in. */
export default function CommunityRequestForm({ signedInEmail }: { signedInEmail: string | null }) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replyEmail = signedInEmail ?? email.trim()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    const response = await fetch('/api/community-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, email, website }),
    })
    setSending(false)
    if (response.ok) setSent(true)
    else setError((await response.json().catch(() => null))?.error ?? 'Something went wrong. Please try again.')
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-1">
        <p className="text-lg font-medium text-ink">Thanks, request sent!</p>
        <p className="text-base text-muted">
          Roman will reply to <strong>{replyEmail}</strong>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">Tell us about your community</label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_TEXT.communityRequest}
          rows={4}
          placeholder="e.g. where it is, about how many households, and anything else you'd like to share"
          className={INPUT_CLASS}
        />
        <CharCount value={message} max={MAX_TEXT.communityRequest} />
      </div>

      {signedInEmail ? (
        <p className="text-sm text-muted">
          Roman will reply to <strong>{signedInEmail}</strong>.
        </p>
      ) : (
        <div>
          <label className="block text-base font-medium text-ink mb-1.5">Your email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={MAX_TEXT.email}
            placeholder="you@example.com"
            className={INPUT_CLASS}
          />
          <p className="text-sm text-muted mt-1">So Roman can reply.</p>
        </div>
      )}

      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so only bots fill it in. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />

      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        data-umami-event="request-community"
        disabled={!message.trim() || !replyEmail || sending}
        className="text-base px-5 py-2.5 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
      >
        {sending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
