'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MoveResidentOutButton({ residentId, residentName }: { residentId: string; residentName: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMoveOut = async () => {
    const confirmed = confirm(
      `Mark ${residentName} as moved out? Their community-wide contact info will be hidden again — a steward can still see it.`
    )
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/move-out`, { method: 'POST' })
    const body = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to update')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleMoveOut}
        disabled={submitting}
        className="text-sm px-4 py-1.5 rounded-full border border-border text-muted hover:bg-surface-muted transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Updating…' : 'Move out'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
