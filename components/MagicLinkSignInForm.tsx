'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { MAX_TEXT } from '@/lib/validation'

/** Email box + "Send sign-in link". Magic link only, no password. `returnPath` is where the link lands once signed in. */
export default function MagicLinkSignInForm({
  returnPath = '/',
  layout = 'stacked',
}: {
  returnPath?: string
  layout?: 'stacked' | 'row'
}) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(returnPath)}`,
      },
    })
    setSending(false)
    if (signInError) setError(signInError.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-1">
        <p className="text-base font-medium text-ink">Check your email</p>
        <p className="text-sm text-muted">
          We sent a sign-in link to <strong>{email}</strong>. Click it to sign in.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className={layout === 'row' ? 'flex flex-col sm:flex-row gap-2' : 'space-y-3'}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={MAX_TEXT.email}
          placeholder="you@example.com"
          required
          autoFocus={layout === 'stacked'}
          className="w-full min-w-0 border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <button
          type="submit"
          disabled={!email.trim() || sending}
          className={`${layout === 'row' ? 'sm:shrink-0 px-5' : 'w-full'} bg-accent text-white py-2.5 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]`}
        >
          {sending ? 'Sending…' : 'Send sign-in link'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
