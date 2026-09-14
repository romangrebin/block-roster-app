'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_TEXT } from '@/lib/validation'
import CharCount from './CharCount'

/**
 * A steward's own private notes on a residence — never shown to residents, not even an approved
 * one of this exact residence (see the doc comment on Residence.stewardNotes in lib/types.ts).
 * The parent only renders this when isSteward is true and only ever passes it a residence whose
 * stewardNotes wasn't stripped server-side — this component doesn't re-check access itself.
 */
export default function ResidenceStewardNotes({
  residenceId,
  notes: initialNotes,
}: {
  residenceId: string
  notes: string | null
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/residences/${residenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stewardNotes: notes }),
    })
    const body = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to save')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className="border-t border-border pt-3 space-y-1.5">
      <label className="block text-sm font-medium text-muted">
        Private steward notes <span className="font-normal">(only stewards see this)</span>
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={MAX_TEXT.stewardNotes}
        rows={2}
        placeholder="e.g. number of people who live here, dietary restrictions, pets, ..."
        className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
      <CharCount value={notes} max={MAX_TEXT.stewardNotes} />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || notes === (initialNotes ?? '')}
          className="text-sm text-accent font-medium cursor-pointer disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
