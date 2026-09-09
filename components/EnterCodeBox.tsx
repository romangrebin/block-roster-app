'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** The resident front door: type a community's code, land on its page — no sign-in required to try. */
export default function EnterCodeBox() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toLowerCase()
    if (!trimmed) return
    router.push(`/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full max-w-md">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter your community's code"
        className="flex-1 min-w-0 border border-border rounded-full px-5 py-3 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
      <button
        type="submit"
        disabled={!code.trim()}
        className="shrink-0 bg-accent text-white px-6 py-3 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        Open
      </button>
    </form>
  )
}
