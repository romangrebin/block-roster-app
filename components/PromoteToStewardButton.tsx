'use client'

import { useConfirmAction } from './useConfirmAction'

export default function PromoteToStewardButton({ residentId, residentName }: { residentId: string; residentName: string }) {
  const { submitting, error, run } = useConfirmAction(`/api/residents/${residentId}/promote`, 'POST')

  const handlePromote = () =>
    run('Failed to promote', `Make ${residentName} a steward? They'll get full access to manage this community.`)

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
