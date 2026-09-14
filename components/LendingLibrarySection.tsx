'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContactMethod, Item } from '@/lib/types'
import { ITEM_CATEGORY_LABEL } from '@/lib/types'
import AddItemForm from './AddItemForm'

export type LibraryItem = {
  item: Item
  ownerName: string
  // Already filtered by the caller to whatever the viewer is allowed to see — block_wide only
  // for a peer, everything for a steward — same as getResidentDirectory elsewhere.
  ownerContacts: ContactMethod[]
}

/**
 * The Lending Library tab: Browse (everyone's items) and My items (add/remove your own),
 * toggled the same way the Residences List/Map view is. Only signed-in approved residents get
 * a "My items" view at all — a steward with no resident record of their own (see the My info
 * tab) has nothing of their own to manage here, so they only ever see Browse.
 */
export default function LendingLibrarySection({
  blockId,
  items,
  viewerResidentId,
}: {
  blockId: string
  items: LibraryItem[]
  viewerResidentId: string | null
}) {
  const router = useRouter()
  const [view, setView] = useState<'browse' | 'mine'>('browse')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myItems = items.filter(({ item }) => item.residentId === viewerResidentId)

  const handleRemove = async (itemId: string) => {
    if (!confirm('Remove this item from the Lending Library?')) return
    setDeletingId(itemId)
    setError(null)
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to remove item')
      return
    }
    router.refresh()
  }

  const visible = view === 'mine' ? myItems : items

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-medium text-ink">Lending Library</h2>
        {viewerResidentId && (
          <div className="flex rounded-full border border-border overflow-hidden text-sm">
            <button
              onClick={() => setView('browse')}
              className={`px-3 py-1 cursor-pointer transition-colors ${view === 'browse' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-muted'}`}
            >
              Browse
            </button>
            <button
              onClick={() => setView('mine')}
              className={`px-3 py-1 cursor-pointer transition-colors ${view === 'mine' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-muted'}`}
            >
              My items
            </button>
          </div>
        )}
      </div>

      {view === 'mine' && viewerResidentId && (
        <>
          <p className="text-sm text-muted">
            Items you&apos;re willing to share and neighbors might want to borrow. Especially good for rarely-used tools that are invaluable when actually needed!
          </p>
          <AddItemForm blockId={blockId} />
        </>
      )}

      {visible.length === 0 ? (
        <p className="text-base text-muted">
          {view === 'mine' ? "You haven't listed anything yet." : 'No items listed yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-2xl bg-surface">
          {visible.map(({ item, ownerName, ownerContacts }) => (
            <li key={item.id} className="px-5 py-4 space-y-1.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-base font-medium text-ink break-words">{item.name}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-surface-muted text-muted">
                    {ITEM_CATEGORY_LABEL[item.category]}
                  </span>
                  {view === 'mine' && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={deletingId === item.id}
                      className="text-sm text-muted hover:text-red-600 cursor-pointer disabled:opacity-40"
                    >
                      {deletingId === item.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
              {item.description && <p className="text-base text-muted whitespace-pre-wrap">{item.description}</p>}
              {view === 'browse' && (
                <p className="text-sm text-ink">
                  {ownerName}
                  {ownerContacts.map((contact) => (
                    <span key={contact.id} className="text-muted">
                      {' '}
                      · {contact.value}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {view === 'browse' && (
        <div className="text-sm text-muted space-y-1">
          <p>If you have an item you&apos;d like to borrow, reach out to your neighbors! They&apos;re very friendly.</p>
          {viewerResidentId && <p>Have something you&apos;re willing to share? Add it under &quot;My items&quot;.</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
