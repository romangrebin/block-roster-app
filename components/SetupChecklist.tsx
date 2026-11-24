import JoinLinkBox from './JoinLinkBox'

type Step = { done: boolean; title: string; where: string }

/** Steward-only next steps for a new community. The page hides it once every step is done. */
export default function SetupChecklist({
  code,
  hasBoundary,
  hasResidences,
  hasRegisteredOwnHome,
  hasWelcomeMessage,
  hasNeighbors,
}: {
  code: string
  hasBoundary: boolean
  hasResidences: boolean
  hasRegisteredOwnHome: boolean
  hasWelcomeMessage: boolean
  hasNeighbors: boolean
}) {
  const steps: Step[] = [
    { done: hasBoundary, title: 'Draw the boundary', where: 'Manage tab' },
    { done: hasResidences, title: 'Add the residences', where: 'Community tab, "+ Add a residence"' },
    { done: hasRegisteredOwnHome, title: 'Register your own home', where: 'My info tab' },
    { done: hasWelcomeMessage, title: 'Write a public welcome message', where: 'Manage tab' },
    { done: hasNeighbors, title: 'Share the link with your neighbors', where: 'done once someone joins' },
  ]

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 print:hidden">
      <h2 className="text-lg font-semibold text-ink">Set up your community</h2>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.title} className="flex items-baseline gap-2.5 text-base">
            <span aria-hidden className={step.done ? 'text-accent' : 'text-muted'}>
              {step.done ? '✓' : '○'}
            </span>
            <span className={step.done ? 'text-muted line-through' : 'text-ink'}>
              {step.title}
              {!step.done && step.where && <span className="text-sm text-muted"> ({step.where})</span>}
            </span>
          </li>
        ))}
      </ol>
      {hasResidences && !hasNeighbors && <JoinLinkBox code={code} />}
    </div>
  )
}
