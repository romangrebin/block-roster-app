'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Shared confirm → fetch → loading/error → refresh flow for the block's one-shot action
 * buttons (approve, move out, promote, remove, delete). */
export function useConfirmAction(url: string, method: 'POST' | 'DELETE') {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (errorFallback: string, confirmMessage?: string) => {
    if (confirmMessage && !confirm(confirmMessage)) return

    setSubmitting(true)
    setError(null)
    const res = await fetch(url, { method })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? errorFallback)
      return
    }
    router.refresh()
  }

  return { submitting, error, run }
}
