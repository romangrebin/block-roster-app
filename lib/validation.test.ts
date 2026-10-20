import { describe, it, expect } from 'vitest'
import { cappedText, escapeHtml, MAX_TEXT, parseProfile, parseSignupPromptKeys } from './validation'

describe('cappedText', () => {
  it('trims surrounding whitespace', () => {
    expect(cappedText('  hi  ', 10)).toBe('hi')
  })

  it('truncates to the cap (after trimming)', () => {
    expect(cappedText('abcdef', 3)).toBe('abc')
    expect(cappedText('   abcdef   ', 3)).toBe('abc')
  })

  it('coerces a non-string to an empty string', () => {
    expect(cappedText(null, 5)).toBe('')
    expect(cappedText(undefined, 5)).toBe('')
    expect(cappedText(123, 5)).toBe('')
    expect(cappedText({}, 5)).toBe('')
  })

  it('leaves input under the cap untouched', () => {
    expect(cappedText('a normal name', MAX_TEXT.name)).toBe('a normal name')
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml(`"quoted" and 'apostrophe'`)).toBe(
      '&quot;quoted&quot; and &#39;apostrophe&#39;'
    )
  })

  it('escapes & before it can double-escape the entities it introduces', () => {
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('neutralizes a script-injection attempt in a display name', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    )
  })
})

describe('parseProfile', () => {
  it('keeps valid values, trimmed', () => {
    expect(parseProfile({ movedInYear: '2014', favoriteSpot: ' the park ', countMeInFor: 'walks', askMeAbout: 'bikes' })).toEqual({
      movedInYear: 2014,
      favoriteSpot: 'the park',
      countMeInFor: 'walks',
      askMeAbout: 'bikes',
    })
  })

  it('turns blanks, junk, and out-of-range years into null', () => {
    const empty = { movedInYear: null, favoriteSpot: null, countMeInFor: null, askMeAbout: null }
    expect(parseProfile({})).toEqual(empty)
    expect(parseProfile(undefined)).toEqual(empty)
    expect(parseProfile({ movedInYear: '', favoriteSpot: '   ', countMeInFor: 42 })).toEqual(empty)
    expect(parseProfile({ movedInYear: 1800 }).movedInYear).toBeNull()
    expect(parseProfile({ movedInYear: new Date().getFullYear() + 1 }).movedInYear).toBeNull()
    expect(parseProfile({ movedInYear: 2014.5 }).movedInYear).toBeNull()
  })
})

describe('parseSignupPromptKeys', () => {
  it('keeps known keys, dedupes, and drops anything else', () => {
    expect(parseSignupPromptKeys(['movedInYear', 'bogus', 'blurb', 'movedInYear', 3])).toEqual([
      'blurb',
      'movedInYear',
    ])
  })

  it('treats a non-array as nothing hidden', () => {
    expect(parseSignupPromptKeys('blurb')).toEqual([])
  })
})
