'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { AuthUser } from '@/lib/auth'
import MagicLinkSignInForm from './MagicLinkSignInForm'

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

  const handleSignOut = async () => {
    await createSupabaseBrowserClient().auth.signOut()
    setOpen(false)
    // `user` is passed down from the root layout Server Component (reads the session cookie) —
    // signOut() alone only clears it client-side; without this the button kept showing the old
    // signed-in state until the next unrelated navigation/refresh happened to re-run the layout.
    router.refresh()
  }

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
        onClick={() => setOpen((o) => !o)}
        className="shrink-0 text-base px-4 py-2 rounded-full transition-colors cursor-pointer font-medium border border-border text-ink hover:bg-surface-muted"
      >
        Sign in
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-2xl shadow-lg p-5 w-72 space-y-3">
          <div>
            <p className="text-base font-medium text-ink">Sign in</p>
            <p className="text-sm text-muted">We&apos;ll email you a sign-in link. No password needed.</p>
          </div>
          <MagicLinkSignInForm />
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}
