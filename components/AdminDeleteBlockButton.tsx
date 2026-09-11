'use client'

import { useConfirmAction } from './useConfirmAction'

export default function AdminDeleteBlockButton({ blockId, blockName }: { blockId: string; blockName: string }) {
  const { submitting, error, run } = useConfirmAction(`/api/admin/blocks/${blockId}`, 'DELETE')

  const handleDelete = () =>
    run(
      'Failed to delete',
      `Delete "${blockName}"? This removes all its residences, residents, and stewards. This cannot be undone.`
    )

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={handleDelete}
        disabled={submitting}
        className="text-sm px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {submitting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
