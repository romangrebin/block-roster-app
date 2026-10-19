'use client'

import { useState } from 'react'
import { useSaveAndRefresh } from './useSaveAndRefresh'

/** Shared confirm → fetch → loading/error → refresh flow for the block's one-shot action
 * buttons (approve, move out, promote, remove, delete). */
export function useConfirmAction(url: string, method: 'POST' | 'DELETE') {
  const { isPending: submitting, saveAndRefresh } = useSaveAndRefresh()
  const [error, setError] = useState<string | null>(null)

  const run = (errorFallback: string, confirmMessage?: string) => {
    if (confirmMessage && !confirm(confirmMessage)) return

    setError(null)
    saveAndRefresh(async () => {
      const res = await fetch(url, { method })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? errorFallback)
      }
      return res.ok
    })
  }

  return { submitting, error, run }
}
