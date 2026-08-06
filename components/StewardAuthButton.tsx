'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

/**
 * Steward sign-in — magic link only, no password. Adapted from
 * geographic-community-webapp/components/AuthButton.tsx (same auth mechanism, generic
 * Tailwind classes here instead of that project's custom design tokens, and copy
 * reframed for stewards specifically since residents never sign in in this app).
 */

type Props = {
  user: User | null
}

export default function StewardAuthButton({ user }: Props) {
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
  }

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  if (user) {
    return (
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 max-w-[160px] truncate"
          title={user.email}
        >
          {user.email}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-52 space-y-2">
            <p className="text-xs text-gray-500 break-all">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full text-left text-xs text-red-600 hover:text-red-700 transition-colors cursor-pointer font-medium"
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
        className="shrink-0 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium border border-gray-300 text-gray-700 hover:bg-gray-100"
      >
        Steward sign in
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
          {sent ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Check your email</p>
              <p className="text-xs text-gray-500">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-3">
              <p className="text-sm font-medium text-gray-900">Sign in as a steward</p>
              <p className="text-xs text-gray-500">We&apos;ll send you a magic link — no password needed.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className={inputClass}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!email.trim() || sending}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
