'use client'

import { useOptimistic, useState } from 'react'
import type { ContactMethod, ResidentProfile } from '@/lib/types'
import { MAX_TEXT } from '@/lib/validation'
import CharCount from './CharCount'
import ResidentProfileFields from './ResidentProfileFields'
import { useSaveAndRefresh } from './useSaveAndRefresh'

/** Shows the new choice immediately (useOptimistic) rather than snapping back to the old one
 * until the refreshed page data arrives. Reverts on its own if the save fails. */
function VisibilitySelect({ contact, onError }: { contact: ContactMethod; onError: (error: string | null) => void }) {
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const [visibility, setOptimisticVisibility] = useOptimistic(contact.visibility)

  const handleChange = (next: ContactMethod['visibility']) => {
    onError(null)
    saveAndRefresh(async () => {
      setOptimisticVisibility(next)
      const res = await fetch(`/api/contact-methods/${contact.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
      if (!res.ok) onError((await res.json()).error ?? 'Failed to update visibility')
      return res.ok
    })
  }

  return (
    <select
      value={visibility}
      onChange={(e) => handleChange(e.target.value as ContactMethod['visibility'])}
      disabled={isPending}
      className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="block_wide">Visible to neighbors</option>
      <option value="steward_only">Visible to steward only</option>
    </select>
  )
}

/**
 * A signed-in approved resident's own settings: their freeform blurb (always visible to
 * neighbors) and per-contact-method visibility (block_wide vs steward_only). Deliberately
 * separate from the read-only Residents directory below — this only ever edits the viewer's
 * own row, never anyone else's.
 */
export default function MyInfoForm({
  residentId,
  name: initialName,
  blurb: initialBlurb,
  profile: initialProfile,
  contacts,
}: {
  residentId: string
  name: string
  blurb: string | null
  profile: ResidentProfile
  contacts: ContactMethod[]
}) {
  const { isPending: savingName, saveAndRefresh: saveName } = useSaveAndRefresh()
  const { isPending: savingBlurb, saveAndRefresh: saveBlurb } = useSaveAndRefresh()
  const { isPending: savingProfile, saveAndRefresh: saveProfile } = useSaveAndRefresh()
  const { isPending: addingPhone, saveAndRefresh: savePhone } = useSaveAndRefresh()
  const { isPending: savingPhoneEdit, saveAndRefresh: savePhoneEdit } = useSaveAndRefresh()
  const [name, setName] = useState(initialName)
  const [nameSaved, setNameSaved] = useState(false)
  const [blurb, setBlurb] = useState(initialBlurb ?? '')
  const [blurbSaved, setBlurbSaved] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  const [profileSaved, setProfileSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneValue, setPhoneValue] = useState('')
  const [phoneVisibility, setPhoneVisibility] = useState<ContactMethod['visibility']>('block_wide')
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [phoneEditValue, setPhoneEditValue] = useState('')

  /** PATCH/POST a JSON body; on failure shows the server's error (or the fallback) and returns false. */
  const send = async (url: string, method: 'PATCH' | 'POST', body: object, errorFallback: string) => {
    setError(null)
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) setError((await res.json()).error ?? errorFallback)
    return res.ok
  }

  const flashSaved = (setSaved: (saved: boolean) => void) => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveName = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(
      () => send(`/api/residents/${residentId}/name`, 'PATCH', { name: trimmed }, 'Failed to save'),
      () => flashSaved(setNameSaved)
    )
  }

  const handleSaveBlurb = () => {
    saveBlurb(
      () => send(`/api/residents/${residentId}/blurb`, 'PATCH', { blurb }, 'Failed to save'),
      () => flashSaved(setBlurbSaved)
    )
  }

  const handleSaveProfile = () => {
    saveProfile(
      () => send(`/api/residents/${residentId}/profile`, 'PATCH', profile, 'Failed to save'),
      () => flashSaved(setProfileSaved)
    )
  }

  const handleAddPhone = () => {
    const trimmed = phoneValue.trim()
    if (!trimmed) return
    savePhone(
      () =>
        send(
          `/api/residents/${residentId}/phone`,
          'POST',
          { value: trimmed, visibility: phoneVisibility },
          'Failed to add phone number'
        ),
      () => setPhoneValue('')
    )
  }

  const startEditingPhone = (contact: ContactMethod) => {
    setEditingPhoneId(contact.id)
    setPhoneEditValue(contact.value)
    setError(null)
  }

  const handleSavePhoneEdit = () => {
    const trimmed = phoneEditValue.trim()
    if (!trimmed || !editingPhoneId) return
    savePhoneEdit(
      () => send(`/api/residents/${residentId}/phone`, 'PATCH', { value: trimmed }, 'Failed to update phone number'),
      () => setEditingPhoneId(null)
    )
  }

  return (
    <div className="space-y-6 border border-border rounded-2xl bg-surface-muted p-5">
      <h2 className="text-lg font-medium text-ink">Your info</h2>

      <div className="space-y-2">
        <label className="block text-base font-medium text-ink">
          Your name <span className="text-muted font-normal">(shown to your neighbors)</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_TEXT.name}
            className="flex-1 min-w-0 border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !name.trim() || name.trim() === initialName}
            className="bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {savingName ? 'Saving…' : nameSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-base font-medium text-ink">
          About you <span className="text-muted font-normal">(shown to your neighbors)</span>
        </label>
        <textarea
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          maxLength={MAX_TEXT.blurb}
          rows={3}
          placeholder="e.g. Happy to lend tools, new to the block, have a dog named Waffles…"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <CharCount value={blurb} max={MAX_TEXT.blurb} />
        <button
          onClick={handleSaveBlurb}
          disabled={savingBlurb || blurb === (initialBlurb ?? '')}
          className="bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {savingBlurb ? 'Saving…' : blurbSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-4">
        <ResidentProfileFields profile={profile} onChange={setProfile} />
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile || JSON.stringify(profile) === JSON.stringify(initialProfile)}
          className="bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {savingProfile ? 'Saving…' : profileSaved ? 'Saved' : 'Save'}
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
                  maxLength={MAX_TEXT.phone}
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
                  <VisibilitySelect contact={contact} onError={setError} />
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
              maxLength={MAX_TEXT.phone}
              placeholder="Add a phone number (optional)"
              className="flex-1 min-w-0 border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <select
              value={phoneVisibility}
              onChange={(e) => setPhoneVisibility(e.target.value as ContactMethod['visibility'])}
              className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="block_wide">Visible to neighbors</option>
              <option value="steward_only">Visible to steward only</option>
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
