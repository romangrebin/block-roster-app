'use client'

import { useConfirmAction } from './useConfirmAction'

/** Permanently deletes a resident record — offered for a pending registration (cleans up an
 * abandoned or mistaken signup) or for someone already marked moved out. An approved resident
 * has to go through "Move out" first; deleting active history outright isn't offered. */
export default function DeleteResidentButton({
  residentId,
  residentName,
}: {
  residentId: string
  residentName: string
}) {
  const { submitting, error, run } = useConfirmAction(`/api/residents/${residentId}`, 'DELETE')

  const handleDelete = () =>
    run(
      'Failed to delete',
      `Delete ${residentName}'s record? This also removes anything they've listed in the lending library. This cannot be undone.`
    )

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDelete}
        disabled={submitting}
        className="text-sm text-muted hover:text-red-600 cursor-pointer disabled:opacity-40"
      >
        {submitting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
