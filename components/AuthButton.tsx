'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { MAX_TEXT } from '@/lib/validation'
import type { AuthUser } from '@/lib/auth'

/**
 * Sign-in — magic link only, no password. Same mechanism for stewards and residents alike:
 * whichever role(s) a given email resolves to is decided per-page (resolveActiveSteward /
 * resolveApprovedResident in lib/application.ts), not by this button.
 */

type Props = {
  user: AuthUser | null
}

export default function AuthButton({ user }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createSupabaseBrowserClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    setSending(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setOpen(false)
    // `user` is passed down from the root layout Server Component (reads the session cookie) —
    // signOut() alone only clears it client-side; without this the button kept showing the old
    // signed-in state until the next unrelated navigation/refresh happened to re-run the layout.
    router.refresh()
  }

  const inputClass =
    'w-full border border-border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

  if (user) {
    return (
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-base px-4 py-2 rounded-full transition-colors cursor-pointer font-medium border border-border text-ink hover:bg-surface-muted max-w-[200px] truncate"
          title={user.email}
        >
          {user.email}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-2xl shadow-lg p-4 w-60 space-y-3">
            <p className="text-sm text-muted break-all">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full text-left text-sm text-red-600 hover:text-red-700 transition-colors cursor-pointer font-medium"
            >
              Sign out
            </button>
          </div>
        )}
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => {
          setOpen((o) => !o)
          setSent(false)
          setError(null)
          setEmail('')
        }}
        className="shrink-0 text-base px-4 py-2 rounded-full transition-colors cursor-pointer font-medium border border-border text-ink hover:bg-surface-muted"
      >
        Sign in
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-2xl shadow-lg p-5 w-72">
          {sent ? (
            <div className="space-y-1">
              <p className="text-base font-medium text-ink">Check your email</p>
              <p className="text-sm text-muted">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-3">
              <p className="text-base font-medium text-ink">Sign in</p>
              <p className="text-sm text-muted">We&apos;ll send you a magic link — no password needed.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={MAX_TEXT.email}
                placeholder="you@example.com"
                required
                autoFocus
                className={inputClass}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!email.trim() || sending}
                className="w-full bg-accent text-white py-2.5 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
              >
                {sending ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}
