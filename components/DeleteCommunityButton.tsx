'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Shown on Manage only until a neighbor joins. The server enforces the same rule. */
export default function DeleteCommunityButton({ blockId, blockName }: { blockId: string; blockName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirm(`Delete "${blockName}" and all its residences? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/blocks/${blockId}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to delete')
      setDeleting(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="border-t border-border pt-5 space-y-2">
      <p className="text-sm text-muted">
        Made this by mistake, or just testing? You can delete this community until a neighbor joins.
      </p>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-sm px-4 py-2 rounded-full border border-red-600 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer font-medium"
      >
        {deleting ? 'Deleting…' : 'Delete this community'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
