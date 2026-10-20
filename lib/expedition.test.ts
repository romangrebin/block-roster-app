import { describe, it, expect } from 'vitest'
import { NEIGHBORS, runExpedition } from './expedition'

const ITEMS = [
  'Chart of the Mono Lake shore',
  'Two-person crosscut saw',
  "August's fiddle",
  'Long snowshoes',
  'A book of poems',
  'Iron-shod spare axle',
  'Buffalo robe',
]

function combinations<T>(pool: T[], size: number): T[][] {
  if (size === 0) return [[]]
  return pool.flatMap((first, i) => combinations(pool.slice(i + 1), size - 1).map((rest) => [first, ...rest]))
}

describe('runExpedition', () => {
  it('has exactly one perfect party', () => {
    const names = NEIGHBORS.map((n) => n.name)
    const itemChoices = [0, 1, 2].flatMap((count) => combinations(ITEMS, count))
    const perfect = combinations(names, 3).flatMap((party) =>
      itemChoices.filter((items) => runExpedition(party, items).failures === 0).map((items) => ({ party, items }))
    )
    expect(perfect).toEqual([
      { party: ['Tom Miller', 'Hannah Price', 'Wing Yee'], items: ['Long snowshoes', 'Iron-shod spare axle'] },
    ])
  })

  it('writes twelve days minus the homecoming, and fails a party with no skills', () => {
    const result = runExpedition(['Clara Holt', 'Josiah Webb', 'Dan McDonald'], ['Buffalo robe'])
    expect(result.journal.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(result.outcome).toBe('failed')
    expect(result.journal.find((d) => d.day === 2)?.lines).toHaveLength(2)
  })

  it('gives every neighbor in a perfect party a color line', () => {
    const result = runExpedition(['Tom Miller', 'Hannah Price', 'Wing Yee'], ['Long snowshoes', 'Iron-shod spare axle'])
    const colorLines = result.journal.filter((d) => d.title === null).flatMap((d) => d.lines.slice(1))
    expect(colorLines).toHaveLength(3)
  })

  it("doesn't claim both wagons came home after losing one", () => {
    const result = runExpedition(['Tom Miller', 'Hannah Price', 'Wing Yee'], ['Long snowshoes'])
    expect(result.outcome).toBe('clean')
    expect(result.arrival).toContain('one wagon')
    expect(result.journal.find((d) => d.title === 'The axle')?.hint).toBeTruthy()
  })
})
