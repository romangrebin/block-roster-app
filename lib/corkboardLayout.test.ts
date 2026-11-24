import { describe, expect, it } from 'vitest'
import { groupIntoColumns, moveNote, readAcrossColumns } from './corkboardLayout'

describe('groupIntoColumns', () => {
  it('keeps each column in the order given', () => {
    const notes = [
      { id: 'a', boardColumn: 1 },
      { id: 'b', boardColumn: 0 },
      { id: 'c', boardColumn: 1 },
    ]
    expect(groupIntoColumns(notes)).toEqual([['b'], ['a', 'c'], []])
  })
})

describe('readAcrossColumns', () => {
  it('reads row by row, skipping columns that have run out', () => {
    expect(readAcrossColumns([['photo', 'hello'], ['go'], ['test']])).toEqual(['photo', 'go', 'test', 'hello'])
  })

  it('handles an empty board', () => {
    expect(readAcrossColumns([[], [], []])).toEqual([])
  })
})

describe('moveNote', () => {
  const board = [['photo', 'hello'], ['go'], ['test']]

  it('moves a note to the bottom of an emptier column', () => {
    expect(moveNote(board, 'hello', { kind: 'column', column: 1 })).toEqual([['photo'], ['go', 'hello'], ['test']])
  })

  it('puts a note just above the note it is dropped on in another column', () => {
    expect(moveNote(board, 'hello', { kind: 'note', noteId: 'go' })).toEqual([['photo'], ['hello', 'go'], ['test']])
  })

  it('swaps places within a column, in either direction', () => {
    expect(moveNote(board, 'photo', { kind: 'note', noteId: 'hello' })).toEqual([['hello', 'photo'], ['go'], ['test']])
    expect(moveNote(board, 'hello', { kind: 'note', noteId: 'photo' })).toEqual([['hello', 'photo'], ['go'], ['test']])
  })

  it('leaves the board alone when dropped on itself or an unknown note', () => {
    expect(moveNote(board, 'go', { kind: 'note', noteId: 'go' })).toBe(board)
    expect(moveNote(board, 'go', { kind: 'note', noteId: 'missing' })).toBe(board)
    expect(moveNote(board, 'missing', { kind: 'column', column: 0 })).toBe(board)
  })
})
