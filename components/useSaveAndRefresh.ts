'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Runs a save, then refreshes the page's server data, keeping `isPending` true until that fresh
 * data has actually rendered. Without the transition, "Saved" showed while the page still
 * displayed the old values for however long the community page took to re-render.
 *
 * `save` returns whether it succeeded (it handles its own error display). `afterSave` runs only
 * on success, committed together with the refreshed data, so e.g. closing an editor doesn't
 * briefly flash the old value.
 */
export function useSaveAndRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const saveAndRefresh = (save: () => Promise<boolean>, afterSave?: () => void) => {
    startTransition(async () => {
      if (!(await save())) return
      // State updates after an `await` fall out of the outer transition — React needs them
      // re-wrapped to keep them batched with the refresh.
      startTransition(() => {
        afterSave?.()
        router.refresh()
      })
    })
  }

  return { isPending, saveAndRefresh }
}
