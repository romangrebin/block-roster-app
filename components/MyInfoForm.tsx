'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContactMethod } from '@/lib/types'

/**
 * A signed-in approved resident's own settings: their freeform blurb (always visible to
 * neighbors) and per-contact-method visibility (block_wide vs steward_only). Deliberately
 * separate from the read-only Residents directory below — this only ever edits the viewer's
 * own row, never anyone else's.
 */
export default function MyInfoForm({
  residentId,
  blurb: initialBlurb,
  contacts,
}: {
  residentId: string
  blurb: string | null
  contacts: ContactMethod[]
}) {
  const router = useRouter()
  const [blurb, setBlurb] = useState(initialBlurb ?? '')
  const [savingBlurb, setSavingBlurb] = useState(false)
  const [blurbSaved, setBlurbSaved] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phoneValue, setPhoneValue] = useState('')
  const [phoneVisibility, setPhoneVisibility] = useState<ContactMethod['visibility']>('block_wide')
  const [addingPhone, setAddingPhone] = useState(false)
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [phoneEditValue, setPhoneEditValue] = useState('')
  const [savingPhoneEdit, setSavingPhoneEdit] = useState(false)

  const handleSaveBlurb = async () => {
    setSavingBlurb(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/blurb`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blurb }),
    })
    const body = await res.json()
    setSavingBlurb(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to save')
      return
    }
    setBlurbSaved(true)
    setTimeout(() => setBlurbSaved(false), 2000)
    router.refresh()
  }

  const handleToggleVisibility = async (contactMethodId: string, next: ContactMethod['visibility']) => {
    setTogglingId(contactMethodId)
    setError(null)
    const res = await fetch(`/api/contact-methods/${contactMethodId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: next }),
    })
    setTogglingId(null)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to update visibility')
      return
    }
    router.refresh()
  }

  const handleAddPhone = async () => {
    const trimmed = phoneValue.trim()
    if (!trimmed) return
    setAddingPhone(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: trimmed, visibility: phoneVisibility }),
    })
    setAddingPhone(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to add phone number')
      return
    }
    setPhoneValue('')
    router.refresh()
  }

  const startEditingPhone = (contact: ContactMethod) => {
    setEditingPhoneId(contact.id)
    setPhoneEditValue(contact.value)
    setError(null)
  }

  const handleSavePhoneEdit = async () => {
    const trimmed = phoneEditValue.trim()
    if (!trimmed || !editingPhoneId) return
    setSavingPhoneEdit(true)
    setError(null)
    const res = await fetch(`/api/residents/${residentId}/phone`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: trimmed }),
    })
    setSavingPhoneEdit(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to update phone number')
      return
    }
    setEditingPhoneId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6 border border-border rounded-2xl bg-surface-muted p-5">
      <h2 className="text-lg font-medium text-ink">Your info</h2>

      <div className="space-y-2">
        <label className="block text-base font-medium text-ink">
          About you <span className="text-muted font-normal">(shown to your neighbors)</span>
        </label>
        <textarea
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          rows={3}
          placeholder="e.g. Happy to lend tools, new to the block, have a dog named Biscuit…"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <button
          onClick={handleSaveBlurb}
          disabled={savingBlurb || blurb === (initialBlurb ?? '')}
          className="bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {savingBlurb ? 'Saving…' : blurbSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-base font-medium text-ink">Your contact info</p>
        <ul className="space-y-2">
          {contacts.map((contact) =>
            contact.id === editingPhoneId ? (
              <li
                key={contact.id}
                className="flex items-center gap-2 flex-wrap text-base bg-surface rounded-xl border border-border px-4 py-2.5"
              >
                <input
                  type="tel"
                  value={phoneEditValue}
                  onChange={(e) => setPhoneEditValue(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-1 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                <button
                  onClick={handleSavePhoneEdit}
                  disabled={savingPhoneEdit || !phoneEditValue.trim()}
                  className="text-sm text-accent font-medium cursor-pointer disabled:opacity-40 shrink-0"
                >
                  {savingPhoneEdit ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingPhoneId(null)}
                  className="text-sm text-muted cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </li>
            ) : (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-3 flex-wrap text-base bg-surface rounded-xl border border-border px-4 py-2.5"
              >
                <span className="text-ink break-words">
                  {contact.type === 'email' ? 'Email' : 'Phone'}: {contact.value}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Email's value has no edit path anywhere in this app — it's tied to identity
                      (markVerified's userId) and changing it would need re-verification, not a
                      quick edit. Phone was never verified, so editing it directly is safe. */}
                  {contact.type === 'phone' && (
                    <button
                      onClick={() => startEditingPhone(contact)}
                      className="text-sm text-muted hover:text-ink cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  <select
                    value={contact.visibility}
                    onChange={(e) =>
                      handleToggleVisibility(contact.id, e.target.value as ContactMethod['visibility'])
                    }
                    disabled={togglingId === contact.id}
                    className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="block_wide">Visible to neighbors</option>
                    <option value="steward_only">Steward only</option>
                  </select>
                </div>
              </li>
            )
          )}
        </ul>
        {/* Only offered if there's no phone on file yet (registration lets it be skipped) — once
            one exists, it gets an inline "Edit" instead, in the list above. */}
        {!contacts.some((c) => c.type === 'phone') && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="tel"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="Add a phone number (optional)"
              className="flex-1 min-w-0 border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <select
              value={phoneVisibility}
              onChange={(e) => setPhoneVisibility(e.target.value as ContactMethod['visibility'])}
              className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="block_wide">Visible to neighbors</option>
              <option value="steward_only">Steward only</option>
            </select>
            <button
              onClick={handleAddPhone}
              disabled={addingPhone || !phoneValue.trim()}
              className="text-sm px-4 py-1.5 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
            >
              {addingPhone ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
