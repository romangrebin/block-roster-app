'use client'

import { useConfirmAction } from './useConfirmAction'

/** Removes an abandoned or mistaken pending registration — the "awaiting verification"/
 * "awaiting approval" case had no way to clean up before this. */
export default function RemovePendingResidentButton({
  residentId,
  residentName,
}: {
  residentId: string
  residentName: string
}) {
  const { submitting, error, run } = useConfirmAction(`/api/residents/${residentId}`, 'DELETE')

  const handleRemove = () =>
    run('Failed to remove', `Remove ${residentName}'s pending registration? This cannot be undone.`)

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
