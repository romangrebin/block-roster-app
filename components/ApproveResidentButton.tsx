'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApproveResidentButton({ residentId }: { residentId: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/approve`, { method: 'POST' })
    const body = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to approve')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={submitting}
        className="text-sm px-4 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Approving…' : 'Approve'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
