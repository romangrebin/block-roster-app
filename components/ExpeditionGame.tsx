'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ARRIVAL,
  MAX_BORROWED_ITEMS,
  NEIGHBORS,
  PARTY_SIZE,
  runExpedition,
  type ExpeditionResult,
  type JournalDay,
} from '@/lib/expedition'

const AFTERWARD = [
  'Two winters later, in 1881, a railroad reached the pines. From then on the wood came to Bodie by the trainload, until 1917.',
  'The boom was already ending. The richest ore was running out, mining companies were going bankrupt, and the miners drifted on to the next strikes: Tombstone, Butte, Utah. Many left their furniture behind, and some of it is still there. In 1882 Congress passed the Chinese Exclusion Act, and King Street emptied too. By 1886 about fifteen hundred people remained, and the town kept shrinking for decades. In 1962 what was left became a state park, kept in "arrested decay," and no one has lived there since.',
  "Long before any of it, the Bodie Hills were the homeland of the Kutzadika'a, the Mono Lake Paiute, whose pinyon groves the rush cut down for firewood. They are still here.",
]

function toggle(list: string[], value: string, max: number) {
  if (list.includes(value)) return list.filter((v) => v !== value)
  return list.length < max ? [...list, value] : list
}

const choiceClass = (selected: boolean) =>
  `text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
    selected ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:border-accent'
  }`

const primaryButtonClass =
  'bg-accent text-white px-6 py-2.5 rounded-full text-base font-medium hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'

export default function ExpeditionGame({
  communityPath,
  setAsideItemNames,
}: {
  communityPath: string
  setAsideItemNames: string[]
}) {
  const [party, setParty] = useState<string[]>([])
  const [items, setItems] = useState<string[]>([])
  const [result, setResult] = useState<ExpeditionResult | null>(null)
  const [daysShown, setDaysShown] = useState(0)

  const startOver = () => {
    setResult(null)
    setDaysShown(0)
  }

  if (!result) {
    return (
      <PartyPicker
        setAsideItemNames={setAsideItemNames}
        party={party}
        items={items}
        onToggleNeighbor={(name) => setParty((current) => toggle(current, name, PARTY_SIZE))}
        onToggleItem={(name) => setItems((current) => toggle(current, name, MAX_BORROWED_ITEMS))}
        onSetOut={() => {
          setResult(runExpedition(party, items))
          setDaysShown(1)
        }}
      />
    )
  }

  const journeyOver = daysShown > result.journal.length
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink">The Expedition</h1>
      <p className="text-base text-muted">
        You, {party.join(', ')}
        {items.length > 0 && `, with ${items.join(' and ')}`}.
      </p>
      <ol className="space-y-5">
        {result.journal.slice(0, daysShown).map((day) => (
          <JournalEntry key={day.day} day={day} />
        ))}
      </ol>
      {journeyOver ? (
        <Ending result={result} communityPath={communityPath} onStartOver={startOver} />
      ) : (
        <button onClick={() => setDaysShown((n) => n + 1)} className={primaryButtonClass}>
          {daysShown === result.journal.length ? 'Come home' : 'Next day'}
        </button>
      )}
    </div>
  )
}

function PartyPicker({
  setAsideItemNames,
  party,
  items,
  onToggleNeighbor,
  onToggleItem,
  onSetOut,
}: {
  setAsideItemNames: string[]
  party: string[]
  items: string[]
  onToggleNeighbor: (name: string) => void
  onToggleItem: (name: string) => void
  onSetOut: () => void
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-ink">Choose your party</h1>
        <p className="text-lg text-muted">
          Four of you will take the wagons south to the pines. Pick the three neighbors going with you, and
          pick carefully: the journey will be difficult. If you haven&apos;t yet, get to know them first by
          reading what they say about themselves in the Community tab.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          Neighbors <span className="text-muted font-normal">({party.length} of {PARTY_SIZE})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NEIGHBORS.map(({ name, residence }) => {
            const selected = party.includes(name)
            return (
              <button
                key={name}
                onClick={() => onToggleNeighbor(name)}
                disabled={!selected && party.length >= PARTY_SIZE}
                className={choiceClass(selected)}
              >
                <span className="block text-base font-medium">{name}</span>
                <span className={`block text-sm ${selected ? 'text-white/80' : 'text-muted'}`}>{residence}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          Borrowed <span className="text-muted font-normal">(up to {MAX_BORROWED_ITEMS})</span>
        </h2>
        {setAsideItemNames.length === 0 ? (
          <p className="text-base text-muted">
            Nothing set aside yet. In the Lending Library tab, tap &quot;Ask to borrow&quot; on anything
            you&apos;d like to bring.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {setAsideItemNames.map((name) => {
              const selected = items.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => onToggleItem(name)}
                  disabled={!selected && items.length >= MAX_BORROWED_ITEMS}
                  className={choiceClass(selected)}
                >
                  <span className="block text-base font-medium">{name}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <button onClick={onSetOut} disabled={party.length !== PARTY_SIZE} className={primaryButtonClass}>
        Set out
      </button>
    </div>
  )
}

function JournalEntry({ day }: { day: JournalDay }) {
  return (
    <li className="space-y-1.5">
      <p className="text-sm font-medium text-muted uppercase tracking-wide">
        Day {day.day}
        {day.title && ` · ${day.title}`}
      </p>
      {day.lines.map((line) => (
        <p key={line} className={`text-lg ${day.succeeded === false ? 'text-muted italic' : 'text-ink'}`}>
          {line}
        </p>
      ))}
    </li>
  )
}

function Ending({
  result,
  communityPath,
  onStartOver,
}: {
  result: ExpeditionResult
  communityPath: string
  onStartOver: () => void
}) {
  const failed = result.outcome === 'failed'
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-medium text-muted uppercase tracking-wide">Day 12 · Home</p>
        <p className="text-lg text-ink">{ARRIVAL[result.outcome]}</p>
        {result.wingCame && (
          <p className="text-lg text-ink">
            Wing had asked one thing before he agreed to come: that King Street, where Bodie&apos;s Chinese
            families lived, would get its fair share of the wood. It did.
          </p>
        )}
        {!failed && (
          <p className="text-lg text-ink">
            The wood was not enough for every stove to burn warm all winter. But it was enough to matter.
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-xl font-semibold text-ink">Afterward</h2>
        {AFTERWARD.map((paragraph) => (
          <p key={paragraph} className="text-base text-muted">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <p className="text-lg text-ink">
          The wood we hauled was gone by March. Most of the families were gone within a few years. By 1962 there
          was no one left who remembered which stoves stayed lit that winter.
        </p>
        <p className="text-lg text-ink">
          {failed
            ? 'But we went, four of us, in the worst of it, because someone had to.'
            : 'But they did stay lit.'}{' '}
          Nobody remembers. It counted anyway.
        </p>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <p className="text-lg text-ink">Somewhere, your street is someone&apos;s history too. Who lives there now?</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={primaryButtonClass}>
            Start a community for your street
          </Link>
          <button
            onClick={onStartOver}
            className="px-6 py-2.5 rounded-full text-base font-medium border border-border text-ink hover:border-accent cursor-pointer"
          >
            Try a different party
          </button>
        </div>
        <p className="text-sm text-muted">
          Inspired by real Bodie residents. Names, households, and occupations follow the historical record where
          known; voices and stories are imagined.{' '}
          <Link
            href={`${communityPath}/expedition/sources`}
            target="_blank"
            className="text-accent underline"
          >
            The history behind the story
          </Link>
        </p>
      </section>
    </div>
  )
}
