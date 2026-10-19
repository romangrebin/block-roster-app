'use client'

import { useState } from 'react'
import { MAX_TEXT } from '@/lib/validation'
import { useSaveAndRefresh } from './useSaveAndRefresh'

/**
 * A friendlier, resident-set name for a residence, separate from the steward-owned official
 * label (ResidenceControls) — "Yellow house on the corner" vs "4504 Longfellow Avenue". Shown
 * to a residence's own approved resident(s) or a steward, only once the row is selected (same
 * reveal-on-select pattern as everything else in the residents sub-list).
 */
export default function ResidenceNicknameEditor({
  residenceId,
  nickname,
}: {
  residenceId: string
  nickname: string | null
}) {
  const { isPending: submitting, saveAndRefresh } = useSaveAndRefresh()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(nickname ?? '')
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setEditing(false)
    setValue(nickname ?? '')
    setError(null)
  }

  const handleSave = () => {
    setError(null)
    saveAndRefresh(
      async () => {
        const res = await fetch(`/api/residences/${residenceId}/nickname`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: value.trim() }),
        })
        if (!res.ok) setError((await res.json()).error ?? 'Failed to save')
        return res.ok
      },
      () => setEditing(false)
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_TEXT.nickname}
          placeholder="e.g. Yellow house on the corner"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            }
            if (e.key === 'Escape') cancel()
          }}
          autoFocus
          className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <button
          onClick={handleSave}
          disabled={submitting}
          className="text-sm text-accent font-medium cursor-pointer disabled:opacity-40 shrink-0"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button onClick={cancel} className="text-sm text-muted cursor-pointer shrink-0">
          Cancel
        </button>
        {error && <span className="text-sm text-red-600 shrink-0">{error}</span>}
      </div>
    )
  }

  // Rendered after a "Nickname:" label in the residence row, so this is just the value slot plus
  // a short action — not a standalone "+ Add a nickname" button (which read as ambiguous next to
  // the per-resident actions below it).
  return (
    <span className="inline-flex items-center gap-1.5">
      {nickname && <span className="text-ink">{nickname}</span>}
      <button onClick={() => setEditing(true)} className="text-sm text-accent hover:underline cursor-pointer">
        {nickname ? 'Edit' : 'Add one'}
      </button>
    </span>
  )
}
