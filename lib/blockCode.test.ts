import { describe, it, expect } from 'vitest'
import {
  generateBlockCode,
  validateBlockCode,
  blockCodeErrorMessage,
  MIN_CODE_LENGTH,
  MAX_CODE_LENGTH,
} from './blockCode'

describe('validateBlockCode', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(validateBlockCode('  Curious-Otter-42  ')).toEqual({ code: 'curious-otter-42' })
  })

  it('rejects codes that are too short or too long', () => {
    expect(validateBlockCode('ab')).toEqual({ error: 'too_short' })
    expect(validateBlockCode('a'.repeat(MAX_CODE_LENGTH + 1))).toEqual({ error: 'too_long' })
    expect('code' in validateBlockCode('a'.repeat(MIN_CODE_LENGTH))).toBe(true)
  })

  it('rejects characters outside [a-z0-9-]', () => {
    expect(validateBlockCode('has space')).toEqual({ error: 'invalid_characters' })
    expect(validateBlockCode('under_score')).toEqual({ error: 'invalid_characters' })
    expect(validateBlockCode('café')).toEqual({ error: 'invalid_characters' })
  })

  it('rejects codes that would collide with a real top-level route', () => {
    for (const reserved of ['admin', 'api', 'blocks', 'favicon.ico']) {
      // favicon.ico also fails the character check, but the reserved list is the intent
      expect(validateBlockCode(reserved)).toHaveProperty('error')
    }
    expect(validateBlockCode('admin')).toEqual({ error: 'reserved' })
  })
})

describe('generateBlockCode', () => {
  it('always produces a value that passes validation', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBlockCode()
      expect(code).toMatch(/^[a-z]+-[a-z]+-\d{1,2}$/)
      expect(validateBlockCode(code)).toEqual({ code })
    }
  })
})

describe('blockCodeErrorMessage', () => {
  it('returns a human string that reflects the current length bounds', () => {
    expect(blockCodeErrorMessage('too_short')).toContain(String(MIN_CODE_LENGTH))
    expect(blockCodeErrorMessage('too_long')).toContain(String(MAX_CODE_LENGTH))
  })
})
