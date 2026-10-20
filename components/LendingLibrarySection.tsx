'use client'

import { useState } from 'react'
import type { ContactMethod, Item } from '@/lib/types'
import { useSaveAndRefresh } from './useSaveAndRefresh'
import { ITEM_CATEGORY_LABEL } from '@/lib/types'
import AddItemForm from './AddItemForm'

export type LibraryItem = {
  item: Item
  ownerName: string
  // Already filtered by the caller to whatever the viewer is allowed to see — block_wide only
  // for a peer, everything for a steward — same as getResidentDirectory elsewhere.
  ownerContacts: ContactMethod[]
}

type BorrowRequestResponse = { ownerEmailed: boolean; alreadyRequested: boolean }

function borrowConfirmation(response: BorrowRequestResponse, ownerName: string) {
  if (response.alreadyRequested) return 'You already asked today.'
  if (response.ownerEmailed) return `Sent! We emailed ${ownerName} and shared your email so they can reply.`
  return `${ownerName} has no email on file, so reach out to them directly.`
}

/** In the Expedition demo the owners have no email, so a request just sets the item aside for the trip. */
function AskToBorrowButton({
  itemId,
  ownerName,
  requested,
  forExpedition,
  viewerEmail,
}: {
  itemId: string
  ownerName: string
  requested: boolean
  forExpedition: boolean
  viewerEmail: string | null
}) {
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const [confirming, setConfirming] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAsk = () => {
    setConfirming(false)
    setError(null)
    saveAndRefresh(async () => {
      const res = await fetch(`/api/items/${itemId}/borrow-request`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Failed to send the request')
        return false
      }
      setConfirmation(borrowConfirmation(body, ownerName))
      return true
    })
  }

  if (forExpedition && requested) {
    return <p className="text-sm text-ink">Set aside for the expedition. You&apos;ll bring two borrowed items on the trip.</p>
  }
  if (confirmation) return <p className="text-sm text-ink">{confirmation}</p>
  if (confirming) {
    return (
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-ink">
          This will email {ownerName}
          {viewerEmail && (
            <>
              {' '}
              with replies going to <strong>{viewerEmail}</strong>
            </>
          )}
          . Send?
        </span>
        <button
          onClick={handleAsk}
          data-umami-event="ask-to-borrow"
          className="font-medium text-accent hover:underline cursor-pointer"
        >
          Send
        </button>
        <button onClick={() => setConfirming(false)} className="text-muted hover:text-ink cursor-pointer">
          Cancel
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <button
        onClick={forExpedition ? handleAsk : () => setConfirming(true)}
        {...(forExpedition && { 'data-umami-event': 'ask-to-borrow' })}
        disabled={isPending || requested}
        className="text-sm font-medium text-accent border border-accent rounded-full px-3 py-1 hover:bg-accent hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? 'Asking…' : requested ? 'Requested' : 'Ask to borrow'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
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
  borrowRequestsEnabled,
  requestedItemIds,
  forExpedition,
  viewerEmail,
}: {
  blockId: string
  items: LibraryItem[]
  viewerResidentId: string | null
  borrowRequestsEnabled: boolean
  requestedItemIds: string[]
  forExpedition: boolean
  viewerEmail: string | null
}) {
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const [view, setView] = useState<'browse' | 'mine'>('browse')
  const [lastRemovedId, setLastRemovedId] = useState<string | null>(null)
  const deletingId = isPending ? lastRemovedId : null
  const [error, setError] = useState<string | null>(null)

  const myItems = items.filter(({ item }) => item.residentId === viewerResidentId)

  const handleRemove = (itemId: string) => {
    if (!confirm('Remove this item from the Lending Library?')) return
    setLastRemovedId(itemId)
    setError(null)
    saveAndRefresh(async () => {
      const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) setError((await res.json()).error ?? 'Failed to remove item')
      return res.ok
    })
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
              {view === 'browse' && borrowRequestsEnabled && viewerResidentId && item.residentId !== viewerResidentId && (
                <AskToBorrowButton
                  itemId={item.id}
                  ownerName={ownerName}
                  requested={requestedItemIds.includes(item.id)}
                  forExpedition={forExpedition}
                  viewerEmail={viewerEmail}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {view === 'browse' && (
        <div className="text-sm text-muted space-y-1">
          <p>
            {forExpedition
              ? 'Ask to borrow sets an item aside for the expedition. You choose two when you pick your party in the Expedition tab.'
              : borrowRequestsEnabled
                ? 'Asking to borrow emails the owner and shares your email with them so they can reply.'
                : "If you have an item you'd like to borrow, reach out to your neighbors! They're very friendly."}
          </p>
          {viewerResidentId && <p>Have something you&apos;re willing to share? Add it under &quot;My items&quot;.</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
