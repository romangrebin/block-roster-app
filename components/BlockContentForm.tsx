'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inputClass =
  'w-full border border-border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/**
 * Steward-editable content for the community's public/private page at /<code>: the code itself,
 * a public welcome blurb, and a private field only signed-in approved residents (and
 * stewards) see. One form, one PATCH — see app/api/blocks/[id]/route.ts.
 */
export default function BlockContentForm({
  blockId,
  code: initialCode,
  publicBlurb: initialPublicBlurb,
  privateNotes: initialPrivateNotes,
  residentExportEnabled: initialResidentExportEnabled,
  lendingLibraryEnabled: initialLendingLibraryEnabled,
}: {
  blockId: string
  code: string
  publicBlurb: string | null
  privateNotes: string | null
  residentExportEnabled: boolean
  lendingLibraryEnabled: boolean
}) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode)
  const [publicBlurb, setPublicBlurb] = useState(initialPublicBlurb ?? '')
  const [privateNotes, setPrivateNotes] = useState(initialPrivateNotes ?? '')
  const [residentExportEnabled, setResidentExportEnabled] = useState(initialResidentExportEnabled)
  const [lendingLibraryEnabled, setLendingLibraryEnabled] = useState(initialLendingLibraryEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty =
    code !== initialCode ||
    publicBlurb !== (initialPublicBlurb ?? '') ||
    privateNotes !== (initialPrivateNotes ?? '') ||
    residentExportEnabled !== initialResidentExportEnabled ||
    lendingLibraryEnabled !== initialLendingLibraryEnabled

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch(`/api/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim(),
        publicBlurb,
        privateNotes,
        residentExportEnabled,
        lendingLibraryEnabled,
      }),
    })
    const body = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to save')
      return
    }
    const codeChanged = body.block.code !== initialCode
    setCode(body.block.code)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    if (codeChanged) {
      // The page itself lives at /<old-code> — a refresh alone would leave every link (and a
      // reload of this very page) pointing at a URL that 404s now that the DB code changed.
      router.push(`/${body.block.code}`)
    } else {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">Community code</label>
        <p className="text-sm text-muted mb-1.5">
          Anyone with this code can reach <span className="font-mono">/{code || '…'}</span> — not listed
          anywhere, so pick something you can say out loud but wouldn&apos;t expect a stranger to guess.
        </p>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className={`${inputClass} font-mono`}
        />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          Public welcome message <span className="text-muted font-normal">(anyone with the code sees this)</span>
        </label>
        <textarea
          value={publicBlurb}
          onChange={(e) => setPublicBlurb(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          Residents-only notes{' '}
          <span className="text-muted font-normal">(only signed-in, approved residents see this)</span>
        </label>
        <textarea
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          rows={6}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={residentExportEnabled}
          onChange={(e) => setResidentExportEnabled(e.target.checked)}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
        <span className="text-base text-ink">Let residents export the roster themselves (CSV)</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={lendingLibraryEnabled}
          onChange={(e) => setLendingLibraryEnabled(e.target.checked)}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
        <span className="text-base text-ink">
          Enable the Lending Library{' '}
          <span className="text-muted font-normal">(residents can list items to lend each other)</span>
        </span>
      </label>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!code.trim() || saving || !dirty}
        className="bg-accent text-white px-6 py-2.5 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
    </form>
  )
}
