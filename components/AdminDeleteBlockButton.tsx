'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminDeleteBlockButton({ blockId, blockName }: { blockId: string; blockName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    const confirmed = confirm(
      `Delete "${blockName}"? This removes all its residences, residents, and stewards. This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    const res = await fetch(`/api/admin/blocks/${blockId}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 text-sm px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer font-medium"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
