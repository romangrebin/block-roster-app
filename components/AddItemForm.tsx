'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABEL, type ItemCategory } from '@/lib/types'

/** Adds one item at a time to the caller's own Lending Library listing — same one-at-a-time
 * pattern as AddResidencesForm, for the same reason: no bulk-paste complexity for a v1 feature. */
export default function AddItemForm({ blockId }: { blockId: string }) {
  const router = useRouter()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ItemCategory>('other')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/blocks/${blockId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, description: description.trim(), category }),
    })
    const body = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to add item')
      return
    }
    setName('')
    setDescription('')
    setCategory('other')
    nameRef.current?.focus()
    router.refresh()
  }

  return (
    <div className="space-y-3 border border-border rounded-xl p-3 bg-surface">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-ink mb-1">Item name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="e.g. Ladder, Settlers of Catan, cordless drill"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ItemCategory)}
            className="text-sm border border-border rounded-lg px-2 py-2.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ITEM_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional — condition, size, anything worth knowing before someone asks"
          className="w-full border border-border rounded-xl px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
      </div>
      <button
        onClick={submit}
        disabled={submitting || !name.trim()}
        className="text-sm px-4 py-1.5 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
      >
        {submitting ? 'Adding…' : 'Add item'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
