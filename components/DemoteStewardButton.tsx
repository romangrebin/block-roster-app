'use client'

import { useConfirmAction } from './useConfirmAction'

/** Demotes an active steward back to a regular resident. The API refuses this if they're the
 * community's only active steward — someone else has to be promoted first. */
export default function DemoteStewardButton({
  stewardId,
  residentName,
}: {
  stewardId: string
  residentName: string
}) {
  const { submitting, error, run } = useConfirmAction(`/api/stewards/${stewardId}/demote`, 'POST')

  const handleDemote = () =>
    run('Failed to demote', `Remove ${residentName} as a steward? They'll go back to being a regular resident.`)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDemote}
        disabled={submitting}
        className="text-sm px-4 py-1.5 rounded-full border border-border text-muted hover:bg-surface-muted transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Removing…' : 'Remove as steward'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
