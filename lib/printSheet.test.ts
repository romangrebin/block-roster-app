import { describe, expect, it } from 'vitest'
import {
  fitText,
  householdNames,
  placeHouses,
  printQrUrl,
  printTextLink,
  qrCodePath,
  spreadLabels,
  type PrintEntry,
  type PrintResident,
} from './printSheet'

const resident = (name: string): PrintResident => ({ name, phone: null, email: null, blurb: null, details: [] })

function squareHouse(label: string, lon: number, lat: number): PrintEntry {
  const size = 0.0001
  const ring = [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ]
  return { residenceId: label, label, residents: [], polygons: [[ring]] }
}

describe('householdNames', () => {
  it('keeps a lone resident’s full name', () => {
    expect(householdNames([resident('Roman Grebin')])).toBe('Roman Grebin')
  })

  it('joins first names for a shared household', () => {
    expect(householdNames([resident('Roman Grebin'), resident('Emily Smith')])).toBe('Roman & Emily')
    expect(householdNames([resident('A X'), resident('B Y'), resident('C Z')])).toBe('A, B & C')
  })
})

describe('fitText', () => {
  it('leaves short text alone and shortens long text with an ellipsis', () => {
    expect(fitText('Short', 100, 10)).toBe('Short')
    const shortened = fitText('A rather long household name here', 55, 10)
    expect(shortened.endsWith('…')).toBe(true)
    expect(shortened.length).toBeLessThanOrEqual(10)
  })
})

describe('spreadLabels', () => {
  it('keeps labels at their desired spot when there is room', () => {
    expect(spreadLabels([0, 50, 100], 20, 0, 200)).toEqual([0, 50, 100])
  })

  it('pushes overlapping labels apart and keeps them inside the column', () => {
    expect(spreadLabels([10, 10, 10], 20, 0, 200)).toEqual([10, 30, 50])
    expect(spreadLabels([190, 190], 20, 0, 200)).toEqual([160, 180])
  })
})

describe('placeHouses', () => {
  const box = { x: 0, y: 0, width: 100, height: 400 }

  it('turns an east–west street so it runs down the page, and numbers each side top to bottom', () => {
    const north = [0, 1, 2, 3].map((i) => squareHouse(`north-${i}`, i * 0.001, 0.0005))
    const south = [0, 1, 2, 3].map((i) => squareHouse(`south-${i}`, i * 0.001, 0))
    const houses = placeHouses([...north, ...south], box)

    const xs = houses.map((house) => house.center.x)
    const ys = houses.map((house) => house.center.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(Math.max(...xs) - Math.min(...xs))

    expect(houses.map((house) => house.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const leftSide = houses.filter((house) => house.side === 'left')
    expect(leftSide).toHaveLength(4)
    expect(new Set(leftSide.map((house) => house.entry.label.split('-')[0])).size).toBe(1)
    for (let i = 1; i < leftSide.length; i++) {
      expect(leftSide[i].center.y).toBeGreaterThan(leftSide[i - 1].center.y)
    }
  })

  it('skips residences with no shape', () => {
    const noShape: PrintEntry = { residenceId: 'x', label: 'x', residents: [], polygons: [] }
    expect(placeHouses([noShape], box)).toEqual([])
  })
})

describe('printed links', () => {
  it('encodes the permanent print code in the QR code and prints the memorable code as text', () => {
    expect(printQrUrl('3f9a1c07be')).toBe('https://ourblock.community/c/3f9a1c07be')
    expect(printTextLink('brave-otter-42')).toBe('ourblock.community/brave-otter-42')
  })
})

describe('qrCodePath', () => {
  it('stays a small QR code for a print URL', () => {
    const { path, size } = qrCodePath(printQrUrl('3f9a1c07be'))
    expect(size).toBeLessThanOrEqual(29)
    expect(path.startsWith('M0,0h1v1h-1z')).toBe(true)
  })
})
