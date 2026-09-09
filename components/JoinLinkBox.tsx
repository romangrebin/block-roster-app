'use client'

import { useState } from 'react'
import Link from 'next/link'

/** Shows the community's link (its code, clickable, opens the public/private page itself) and copies it. */
export default function JoinLinkBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/${code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3 bg-accent-soft border border-accent/20 rounded-2xl px-5 py-4">
      <p className="text-base text-accent-soft-ink flex-1">
        Share this link so residents can register:{' '}
        <Link href={`/${code}`} target="_blank" className="font-mono underline hover:no-underline">
          /{code}
        </Link>
      </p>
      <button
        onClick={handleCopy}
        className="shrink-0 text-sm px-4 py-2 rounded-full bg-surface border border-accent/30 text-accent hover:bg-accent-soft transition-colors cursor-pointer font-medium"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  )
}
