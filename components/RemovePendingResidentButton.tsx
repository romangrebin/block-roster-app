'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Removes an abandoned or mistaken pending registration — the "awaiting verification"/
 * "awaiting approval" case had no way to clean up before this. */
export default function RemovePendingResidentButton({
  residentId,
  residentName,
}: {
  residentId: string
  residentName: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = async () => {
    const confirmed = confirm(`Remove ${residentName}'s pending registration? This cannot be undone.`)
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}`, { method: 'DELETE' })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to remove')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRemove}
        disabled={submitting}
        className="text-sm text-muted hover:text-red-600 cursor-pointer disabled:opacity-40"
      >
        {submitting ? 'Removing…' : 'Remove'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
