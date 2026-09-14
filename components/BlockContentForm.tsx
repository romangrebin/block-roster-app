'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_TEXT } from '@/lib/validation'
import CharCount from './CharCount'

// Mirrors MAX_CODE_LENGTH in lib/blockCode.ts — kept as a literal here so this Client
// Component doesn't pull that server-only module (it imports node:crypto) into the bundle.
const MAX_CODE_LENGTH = 32

const inputClass =
  'w-full border border-border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/**
 * Steward-editable content for the community's public/private page at /<code>: its name, the
 * code itself, a public welcome blurb, and a private field only signed-in approved residents
 * (and stewards) see. One form, one PATCH — see app/api/blocks/[id]/route.ts.
 */
export default function BlockContentForm({
  blockId,
  name: initialName,
  code: initialCode,
  publicBlurb: initialPublicBlurb,
  privateNotes: initialPrivateNotes,
  residentExportEnabled: initialResidentExportEnabled,
  lendingLibraryEnabled: initialLendingLibraryEnabled,
  autoApproveJoins: initialAutoApproveJoins,
}: {
  blockId: string
  name: string
  code: string
  publicBlurb: string | null
  privateNotes: string | null
  residentExportEnabled: boolean
  lendingLibraryEnabled: boolean
  autoApproveJoins: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState(initialCode)
  const [publicBlurb, setPublicBlurb] = useState(initialPublicBlurb ?? '')
  const [privateNotes, setPrivateNotes] = useState(initialPrivateNotes ?? '')
  const [residentExportEnabled, setResidentExportEnabled] = useState(initialResidentExportEnabled)
  const [lendingLibraryEnabled, setLendingLibraryEnabled] = useState(initialLendingLibraryEnabled)
  const [autoApproveJoins, setAutoApproveJoins] = useState(initialAutoApproveJoins)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty =
    name !== initialName ||
    code !== initialCode ||
    publicBlurb !== (initialPublicBlurb ?? '') ||
    privateNotes !== (initialPrivateNotes ?? '') ||
    residentExportEnabled !== initialResidentExportEnabled ||
    lendingLibraryEnabled !== initialLendingLibraryEnabled ||
    autoApproveJoins !== initialAutoApproveJoins

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch(`/api/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim(),
        publicBlurb,
        privateNotes,
        residentExportEnabled,
        lendingLibraryEnabled,
        autoApproveJoins,
      }),
    })
    const body = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(body.error ?? 'Failed to save')
      return
    }
    const codeChanged = body.block.code !== initialCode
    setName(body.block.name)
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
        <label className="block text-base font-medium text-ink mb-1.5">Community name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_TEXT.name}
          required
          className={inputClass}
        />
      </div>
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
          maxLength={MAX_CODE_LENGTH}
          required
          className={`${inputClass} font-mono`}
        />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          Public welcome message <span className="text-muted font-normal">(anyone with the code sees this)</span>
        </label>
        <p className="text-sm text-muted mb-1.5">
          Supports Markdown: <span className="font-mono">**bold**</span>,{' '}
          <span className="font-mono">[link text](https://…)</span>
        </p>
        <textarea
          value={publicBlurb}
          onChange={(e) => setPublicBlurb(e.target.value)}
          maxLength={MAX_TEXT.publicBlurb}
          rows={3}
          className={inputClass}
        />
        <CharCount value={publicBlurb} max={MAX_TEXT.publicBlurb} />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          About this community{' '}
          <span className="text-muted font-normal">(only signed-in, approved residents see this)</span>
        </label>
        <p className="text-sm text-muted mb-1.5">
          Supports Markdown: <span className="font-mono">**bold**</span>,{' '}
          <span className="font-mono">[link text](https://…)</span>
        </p>
        <textarea
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          maxLength={MAX_TEXT.privateNotes}
          rows={6}
          className={inputClass}
        />
        <CharCount value={privateNotes} max={MAX_TEXT.privateNotes} />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={residentExportEnabled}
          onChange={(e) => setResidentExportEnabled(e.target.checked)}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
        <span className="text-base text-ink">Let residents export the directory themselves (CSV)</span>
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
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={autoApproveJoins}
          onChange={(e) => setAutoApproveJoins(e.target.checked)}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
        <span className="text-base text-ink">
          Auto-approve new joiners{' '}
          <span className="text-muted font-normal">
            (skips the approval step — you&apos;ll still get an email every time someone joins)
          </span>
        </span>
      </label>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!name.trim() || !code.trim() || saving || !dirty}
        className="bg-accent text-white px-6 py-2.5 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
    </form>
  )
}
