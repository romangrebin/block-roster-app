'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import DrawableMap from './DrawableMap'
import { MAX_TEXT } from '@/lib/validation'

export default function CreateBlockForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [boundary, setBoundary] = useState<Feature<Polygon | MultiPolygon> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a community name to continue.')
      return
    }
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), boundary }),
    })
    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error ?? 'Failed to create community')
      return
    }
    router.push(`/${body.block.code}`)
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
          placeholder="e.g. 400 block of Elm St"
          required
          className="w-full border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-base font-medium text-ink mb-1.5">
          Boundary <span className="text-muted font-normal">(optional — draw now or skip and add it later)</span>
        </label>
        <div className="h-[36rem] rounded-2xl overflow-hidden border border-border">
          <DrawableMap onChange={setBoundary} />
        </div>
      </div>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-white px-6 py-3 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        {submitting ? 'Creating…' : 'Create community'}
      </button>
    </form>
  )
}
