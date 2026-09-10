'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_TEXT } from '@/lib/validation'

/**
 * Adds one residence at a time — not a bulk paste box, so this pairs naturally with a future
 * "draw this residence's shape" step per residence, rather than a list that has no way to
 * attach a shape to any one line.
 */
export default function AddResidencesForm({ blockId }: { blockId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = label.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    setJustAdded(null)
    const res = await fetch(`/api/blocks/${blockId}/residences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: [trimmed] }),
    })
    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error ?? 'Failed to add residence')
      return
    }
    setLabel('')
    inputRef.current?.focus()
    setJustAdded(trimmed)
    setTimeout(() => setJustAdded(null), 2000)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink">By name or address</label>
      <p className="text-sm text-muted -mt-1">
        A shortened address or any label neighbors would recognize (e.g. &ldquo;yellow house on hill&rdquo;).
      </p>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={MAX_TEXT.label}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="412 Elm St"
          autoFocus
          className="flex-1 border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <button
          onClick={submit}
          disabled={submitting || !label.trim()}
          className="bg-accent text-white px-5 py-3 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {justAdded && <p className="text-sm text-accent">✓ Added &ldquo;{justAdded}&rdquo; to the Residences list.</p>}
    </div>
  )
}
