'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import ResidenceMapPicker from './ResidenceMapPicker'
import { MAX_TEXT } from '@/lib/validation'
import CharCount from './CharCount'
import type { CanvasType, ContactVisibility } from '@/lib/types'

const visibilitySelectClass =
  'text-sm border border-border rounded-lg px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-accent'

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ContactVisibility
  onChange: (v: ContactVisibility) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ContactVisibility)}
      className={visibilitySelectClass}
    >
      <option value="block_wide">Visible to neighbors</option>
      <option value="steward_only">Steward only</option>
    </select>
  )
}

type ResidenceOption = { id: string; label: string; nickname: string | null; shape: unknown }

/**
 * Resident self-registration: pick a residence (by tapping the map, if any residence has a
 * drawn shape — the plain-list dropdown is always shown too, as the guaranteed fallback for
 * residences without one yet), give a name + blurb + email (+ optional phone), confirm by
 * tapping the emailed link — app/[code]/complete is where that link lands and finishes it. Phone
 * is unverified/informational only — no phone-OTP path exists yet.
 *
 * The blurb is required here (unlike editing it later via My Info, which is optional) — besides
 * being the "something about you" neighbors see, it's the one piece of free text a steward has
 * to help judge a pending registration before approving it (see resident.blurb's unconditional
 * display in ResidencesSection's resident cards, right next to Approve).
 *
 * If the visitor is already signed in, `signedInEmail` skips asking for an email at all — a
 * prior magic link already proved they control that inbox, so there's nothing left for another
 * one to verify. The register route recognizes this (email matches the signed-in session) and
 * finishes verification immediately server-side; this form just skips straight to the success
 * screen instead of sending a second, redundant confirmation email.
 */
export default function ResidentIntakeForm({
  code,
  residences,
  canvasType,
  signedInEmail,
}: {
  code: string
  residences: ResidenceOption[]
  canvasType: CanvasType
  signedInEmail?: string | null
}) {
  const [sent, setSent] = useState(false)
  const [registered, setRegistered] = useState<{ autoApproved: boolean } | null>(null)
  // Deliberately no default residence — a pre-filled dropdown looks like an already-made choice,
  // and picking the wrong house here is exactly the mistake this form shouldn't make easy.
  const [residenceId, setResidenceId] = useState('')
  const [name, setName] = useState('')
  const [blurb, setBlurb] = useState('')
  const [email, setEmail] = useState(signedInEmail ?? '')
  const [emailVisibility, setEmailVisibility] = useState<ContactVisibility>('block_wide')
  const [phone, setPhone] = useState('')
  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>('block_wide')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createSupabaseBrowserClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!residenceId || !name.trim() || !blurb.trim() || !email.trim()) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/residences/${residenceId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        blurb: blurb.trim(),
        email: email.trim(),
        emailVisibility,
        phone: phone.trim(),
        phoneVisibility,
      }),
    })
    const body = await res.json()
    if (!res.ok) {
      setSubmitting(false)
      setError(body.error ?? 'Failed to register')
      return
    }

    if (body.autoVerified) {
      setSubmitting(false)
      setRegistered({ autoApproved: body.autoApproved })
      return
    }

    const completePath = `/${code}/complete?contactMethodId=${body.contactMethodId}`
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(completePath)}`,
      },
    })
    setSubmitting(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setSent(true)
  }

  if (registered) {
    return (
      <div className="space-y-1">
        <p className="text-lg font-medium text-ink">You&apos;re registered!</p>
        <p className="text-base text-muted">
          {registered.autoApproved
            ? "You're approved automatically since you're already a steward here."
            : 'A steward will approve you soon — no further action needed.'}
        </p>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="space-y-1">
        <p className="text-lg font-medium text-ink">Check your email</p>
        <p className="text-base text-muted">
          We sent a link to <strong>{email}</strong>. Tap it to confirm — a steward will approve
          you soon after.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

  const shapedResidences = residences.filter(
    (r): r is ResidenceOption & { shape: Feature<Polygon | MultiPolygon> } => !!r.shape
  )
  const showMap = canvasType === 'geo_map' && shapedResidences.length > 0

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      {showMap && (
        <div className="space-y-1.5">
          <p className="text-sm text-muted">Tap your house on the map, or pick from the list below.</p>
          <div className="h-72 rounded-xl overflow-hidden border border-border">
            <ResidenceMapPicker residences={shapedResidences} selectedId={residenceId} onSelect={setResidenceId} />
          </div>
        </div>
      )}
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">Your residence</label>
        <select
          value={residenceId}
          onChange={(e) => setResidenceId(e.target.value)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            Select your residence…
          </option>
          {residences.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nickname ? `${r.nickname} (${r.label})` : r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_TEXT.name}
          required
          autoFocus
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          About you <span className="text-muted font-normal">(shown to your neighbors)</span>
        </label>
        <textarea
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          maxLength={MAX_TEXT.blurb}
          rows={2}
          placeholder="Something simple your neighbors could know about you, something you love about where you live, or someplace you love near your home"
          required
          className={inputClass}
        />
        <CharCount value={blurb} max={MAX_TEXT.blurb} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <label className="block text-base font-medium text-ink">Email</label>
          <VisibilitySelect value={emailVisibility} onChange={setEmailVisibility} />
        </div>
        {signedInEmail ? (
          // Signed in already means a prior magic link already proved they control this inbox —
          // asking again (and sending yet another confirmation email) would be pure friction with
          // no security benefit, so there's nothing to type here, just a confirmation of who
          // they're registering as.
          <p className="text-base text-ink">
            Registering as <strong>{signedInEmail}</strong>
          </p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={MAX_TEXT.email}
              placeholder="you@example.com"
              required
              className={inputClass}
            />
            <p className="text-sm text-muted mt-1.5">
              Confirms it&apos;s really you and lets you sign back in later — visible to your
              neighbors by default, or switch it to steward only above.
            </p>
          </>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <label className="block text-base font-medium text-ink">
            Phone <span className="text-muted font-normal">(optional)</span>
          </label>
          <VisibilitySelect value={phoneVisibility} onChange={setPhoneVisibility} />
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={MAX_TEXT.phone}
          placeholder="(555) 555-5555"
          className={inputClass}
        />
      </div>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!residenceId || !name.trim() || !blurb.trim() || !email.trim() || submitting}
        className="w-full bg-accent text-white py-3 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        {submitting ? 'Sending link…' : 'Register'}
      </button>
    </form>
  )
}
