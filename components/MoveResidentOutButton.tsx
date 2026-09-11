'use client'

import { useConfirmAction } from './useConfirmAction'

export default function MoveResidentOutButton({ residentId, residentName }: { residentId: string; residentName: string }) {
  const { submitting, error, run } = useConfirmAction(`/api/residents/${residentId}/move-out`, 'POST')

  const handleMoveOut = () =>
    run(
      'Failed to update',
      `Mark ${residentName} as moved out? Their community-wide contact info will be hidden again — a steward can still see it.`
    )

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
