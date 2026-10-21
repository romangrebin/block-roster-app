'use client'

import { useConfirmAction } from './useConfirmAction'

export default function DeleteExpeditionButton({ runId, playerName }: { runId: string; playerName: string }) {
  const { submitting, error, run } = useConfirmAction(`/api/expedition-runs/${runId}`, 'DELETE')

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={() => run('Failed to delete', `Delete ${playerName}'s expedition from the list?`)}
        disabled={submitting}
        className="text-sm text-muted hover:text-red-600 cursor-pointer disabled:opacity-40"
      >
        {submitting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  )
}
