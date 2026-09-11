'use client'

import { useConfirmAction } from './useConfirmAction'

export default function ApproveResidentButton({ residentId }: { residentId: string }) {
  const { submitting, error, run } = useConfirmAction(`/api/residents/${residentId}/approve`, 'POST')

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => run('Failed to approve')}
        disabled={submitting}
        className="text-sm px-4 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Approving…' : 'Approve'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
