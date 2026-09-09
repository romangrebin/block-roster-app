'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PromoteToStewardButton({ residentId, residentName }: { residentId: string; residentName: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePromote = async () => {
    const confirmed = confirm(`Make ${residentName} a steward? They'll get full access to manage this community.`)
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/promote`, { method: 'POST' })
    const body = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to promote')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePromote}
        disabled={submitting}
        className="text-sm px-4 py-1.5 rounded-full bg-accent-soft text-accent-soft-ink hover:bg-accent/20 transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Promoting…' : 'Make steward'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
