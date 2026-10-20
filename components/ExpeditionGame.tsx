'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PastExpedition } from '@/lib/application'
import {
  CHALLENGE_COUNT,
  BORROWED_ITEM_COUNT,
  NEIGHBORS,
  PARTY_SIZE,
  runExpedition,
  type ExpeditionResult,
  type JournalDay,
} from '@/lib/expedition'

const AFTERWARD = [
  'Two winters later, in 1881, a railroad reached the pines. From then on the wood came to Bodie by the trainload, until 1917.',
  'The boom was already ending. The richest ore was running out, mining companies were going bankrupt, and the miners drifted on to the next strikes: Tombstone, Butte, Utah. Many left their furniture behind, and some of it is still there. In 1882 Congress passed the Chinese Exclusion Act, and no new families could come to join the ones on King Street. By 1886 about fifteen hundred people remained, and the town kept shrinking for decades. The mines shut for good in 1942, and the last families left. Twenty years later what was left became a state park, kept in "arrested decay." Today the only people who live in Bodie are park staff.',
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

function listWithAnd(names: string[]) {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
}

export default function ExpeditionGame({
  communityPath,
  setAsideItemNames,
  pastExpeditions,
}: {
  communityPath: string
  setAsideItemNames: string[]
  pastExpeditions: PastExpedition[]
}) {
  const router = useRouter()
  const topRef = useRef<HTMLDivElement>(null)
  const [party, setParty] = useState<string[]>([])
  const [items, setItems] = useState<string[]>([])
  const [result, setResult] = useState<ExpeditionResult | null>(null)
  const [daysShown, setDaysShown] = useState(0)

  const scrollToTop = () => topRef.current?.scrollIntoView({ block: 'start' })

  const startOver = () => {
    setResult(null)
    setDaysShown(0)
    scrollToTop()
  }

  const setOut = async () => {
    setResult(runExpedition(party, items))
    setDaysShown(1)
    scrollToTop()
    const res = await fetch('/api/expedition-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ party, items }),
    })
    if (res.ok) router.refresh()
  }

  if (!result) {
    return (
      <div ref={topRef} className="scroll-mt-6">
        <PartyPicker
          setAsideItemNames={setAsideItemNames}
          party={party}
          items={items}
          onToggleNeighbor={(name) => setParty((current) => toggle(current, name, PARTY_SIZE))}
          onToggleItem={(name) => setItems((current) => toggle(current, name, BORROWED_ITEM_COUNT))}
          onSetOut={setOut}
        />
      </div>
    )
  }

  const journeyOver = daysShown > result.journal.length
  const lastDay = daysShown === result.journal.length
  return (
    <div ref={topRef} className="space-y-6 scroll-mt-6">
      <h1 className="text-3xl font-semibold text-ink">The Expedition</h1>
      <div className="text-base text-muted">
        <p>You set out with {listWithAnd(party)}.</p>
        {items.length > 0 && <p>Borrowed: {listWithAnd(items)}.</p>}
      </div>
      <ol className="space-y-5">
        {result.journal.slice(0, daysShown).map((day) => (
          <JournalEntry key={day.day} day={day} />
        ))}
      </ol>
      {journeyOver ? (
        <Ending
          result={result}
          communityPath={communityPath}
          pastExpeditions={pastExpeditions}
          onStartOver={startOver}
        />
      ) : (
        <button
          onClick={() => setDaysShown((n) => n + 1)}
          {...(lastDay && {
            'data-umami-event': 'expedition-finished',
            'data-umami-event-outcome': result.outcome,
            'data-umami-event-failures': result.failures,
          })}
          className={primaryButtonClass}
        >
          {lastDay ? 'Come home' : 'Next day'}
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
          Borrowed{' '}
          <span className="text-muted font-normal">
            ({items.length} of {BORROWED_ITEM_COUNT})
          </span>
        </h2>
        {setAsideItemNames.length === 0 ? (
          <p className="text-base text-muted">
            Nothing set aside yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {setAsideItemNames.map((name) => {
              const selected = items.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => onToggleItem(name)}
                  disabled={!selected && items.length >= BORROWED_ITEM_COUNT}
                  className={choiceClass(selected)}
                >
                  <span className="block text-base font-medium">{name}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {setAsideItemNames.length < BORROWED_ITEM_COUNT && (
        <p className="text-base text-ink rounded-xl border border-border bg-surface-muted px-4 py-3">
          You&apos;re not prepared yet. See if anyone in the Lending Library has something useful to lend:
          tap &quot;Ask to borrow&quot; on two things you&apos;d want on the trip.
        </p>
      )}
      <button
        onClick={onSetOut}
        disabled={party.length !== PARTY_SIZE || items.length !== BORROWED_ITEM_COUNT}
        data-umami-event="expedition-set-out"
        className={primaryButtonClass}
      >
        Set out
      </button>

    </div>
  )
}

function PastExpeditions({ expeditions }: { expeditions: PastExpedition[] }) {
  return (
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-lg font-medium text-ink">Past expeditions</h2>
      <ul className="space-y-2">
        {expeditions.map((expedition) => (
          <li key={expedition.createdAt + expedition.playerName} className="text-base">
            <span className="text-ink font-medium">{expedition.playerName}</span>
            <span className="text-muted">
              {' '}
              took {listWithAnd(expedition.party)}
              {expedition.items.length > 0 && `, with ${listWithAnd(expedition.items)}`}.{' '}
              {CHALLENGE_COUNT - expedition.failures} of {CHALLENGE_COUNT} challenges met ·{' '}
              {new Date(expedition.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'America/Los_Angeles',
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function JournalEntry({ day }: { day: JournalDay }) {
  if (day.succeeded === null) {
    return (
      <li className="space-y-1.5">
        <p className="text-sm font-medium text-muted uppercase tracking-wide">Day {day.day}</p>
        {day.lines.map((line) => (
          <p key={line} className="text-lg text-ink">
            {line}
          </p>
        ))}
      </li>
    )
  }

  return (
    <li
      className={`space-y-1.5 rounded-xl border border-border border-l-4 bg-surface px-4 py-3 ${
        day.succeeded ? 'border-l-emerald-600' : 'border-l-red-600'
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium text-muted uppercase tracking-wide">
          Day {day.day} · Challenge: {day.title}
        </p>
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            day.succeeded ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {day.succeeded ? 'Overcome' : 'Failed'}
        </span>
      </div>
      {day.lines.map((line) => (
        <p key={line} className="text-lg text-ink">
          {line}
        </p>
      ))}
      {day.hint && <p className="text-sm text-muted">{day.hint}</p>}
    </li>
  )
}

function Ending({
  result,
  communityPath,
  pastExpeditions,
  onStartOver,
}: {
  result: ExpeditionResult
  communityPath: string
  pastExpeditions: PastExpedition[]
  onStartOver: () => void
}) {
  const failed = result.outcome === 'failed'
  const challengesMet = CHALLENGE_COUNT - result.failures
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-medium text-muted uppercase tracking-wide">Day 12 · Home</p>
        <p className="text-lg text-ink">{result.arrival}</p>
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
        <p className="text-base font-medium text-ink">
          {result.failures === 0
            ? 'All six challenges met: a perfect expedition.'
            : `${challengesMet} of ${CHALLENGE_COUNT} challenges met.`}
        </p>
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
          {failed ? 'What little wood we hauled was gone within weeks.' : 'The wood we hauled was gone by March.'} Most of the families were gone within a few years. By 1962 there
          was no one left who remembered which stoves stayed lit that winter.
        </p>
        <p className="text-lg text-ink">
          {failed
            ? 'But we went, four of us, in the worst of it, because someone had to.'
            : 'But they did stay lit.'}{' '}
          Nobody remembers. It counted anyway.
        </p>
      </section>

      <Link
        href={`${communityPath}/expedition/sources`}
        target="_blank"
        data-umami-event="expedition-sources"
        className="block rounded-2xl border border-border bg-surface-muted p-5 hover:border-accent transition-colors"
      >
        <span className="block text-lg font-semibold text-ink">The history behind the story →</span>
        <span className="block text-base text-muted mt-1">
          What was real, what we invented, and the surprising facts along the way: why skis were called
          snowshoes, what frostbite advice was in 1879, and who cut Bodie&apos;s wood.
        </span>
      </Link>

      <section className="space-y-4 border-t border-border pt-6">
        <p className="text-lg text-ink">Your street is someone&apos;s history in the making. Who lives on it now?</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" data-umami-event="expedition-start-community" className={primaryButtonClass}>
            Start a community for your street
          </Link>
          <button
            onClick={onStartOver}
            data-umami-event="expedition-try-again"
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
            data-umami-event="expedition-sources"
            className="text-accent underline"
          >
            The history behind the story
          </Link>
        </p>
      </section>

      {pastExpeditions.length > 0 && <PastExpeditions expeditions={pastExpeditions} />}
    </div>
  )
}
