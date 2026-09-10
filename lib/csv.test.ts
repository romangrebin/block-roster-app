import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('joins rows with CRLF and cells with commas', () => {
    expect(toCsv(['A', 'B'], [['1', '2'], ['3', '4']])).toBe('A,B\r\n1,2\r\n3,4')
  })

  it('quotes only cells containing a comma, quote, or newline', () => {
    expect(toCsv(['h'], [['plain']])).toBe('h\r\nplain')
    expect(toCsv(['h'], [['a,b']])).toBe('h\r\n"a,b"')
    expect(toCsv(['h'], [['line\nbreak']])).toBe('h\r\n"line\nbreak"')
  })

  it('escapes internal double quotes by doubling them', () => {
    expect(toCsv(['h'], [['say "hi"']])).toBe('h\r\n"say ""hi"""')
  })

  describe('formula-injection guard', () => {
    it('prefixes a quote to cells starting with = + - @ or a control char', () => {
      expect(toCsv(['h'], [['=1+1']])).toBe("h\r\n'=1+1")
      expect(toCsv(['h'], [['+1']])).toBe("h\r\n'+1")
      expect(toCsv(['h'], [['-1']])).toBe("h\r\n'-1")
      expect(toCsv(['h'], [['@SUM(A1)']])).toBe("h\r\n'@SUM(A1)")
      expect(toCsv(['h'], [['\tTAB']])).toBe("h\r\n'\tTAB")
    })

    it('still quotes a guarded cell that also contains a delimiter', () => {
      expect(toCsv(['h'], [['=HYPERLINK("http://x","y")']])).toBe(
        `h\r\n"'=HYPERLINK(""http://x"",""y"")"`
      )
    })

    it('leaves a normal negative-looking phone number... still guarded (accepted tradeoff)', () => {
      // A leading "-" is rare in real roster data; guarding it is the safe default.
      expect(toCsv(['h'], [['-555-1234']])).toBe("h\r\n'-555-1234")
    })
  })
})
