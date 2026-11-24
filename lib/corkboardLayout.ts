import { CORKBOARD_COLUMN_COUNT } from './types'

/**
 * The Corkboard's layout as note ids: `columns[c]` is column c, top to bottom. Pure functions,
 * shared by the board UI and its tests.
 */
export type BoardColumns = string[][]

export type DropTarget = { kind: 'note'; noteId: string } | { kind: 'column'; column: number }

/** Groups notes into their columns. Expects notes already sorted by position. */
export function groupIntoColumns(notes: { id: string; boardColumn: number }[]): BoardColumns {
  return Array.from({ length: CORKBOARD_COLUMN_COUNT }, (_, column) =>
    notes.filter((note) => note.boardColumn === column).map((note) => note.id)
  )
}

/** The one-column order for phones: across the columns, row by row. */
export function readAcrossColumns(columns: BoardColumns): string[] {
  const rowCount = Math.max(0, ...columns.map((column) => column.length))
  return Array.from({ length: rowCount }, (_, row) => columns.flatMap((column) => column[row] ?? [])).flat()
}

/**
 * Moves a note. Dropped on another note in the same column, it takes that note's place. Dropped
 * on a note in another column, it goes just above it. Dropped on a column's empty space, it goes
 * to the bottom of that column.
 */
export function moveNote(columns: BoardColumns, movedId: string, target: DropTarget): BoardColumns {
  const fromColumn = columns.findIndex((column) => column.includes(movedId))
  if (fromColumn === -1) return columns

  if (target.kind === 'note') {
    const toColumn = columns.findIndex((column) => column.includes(target.noteId))
    if (toColumn === -1 || target.noteId === movedId) return columns
    if (toColumn === fromColumn) {
      const column = columns[fromColumn]
      return replaceColumn(columns, fromColumn, moveWithin(column, column.indexOf(movedId), column.indexOf(target.noteId)))
    }
    const withoutMoved = columns.map((column) => column.filter((id) => id !== movedId))
    const targetIndex = withoutMoved[toColumn].indexOf(target.noteId)
    const destination = withoutMoved[toColumn]
    return replaceColumn(withoutMoved, toColumn, [...destination.slice(0, targetIndex), movedId, ...destination.slice(targetIndex)])
  }

  const withoutMoved = columns.map((column) => column.filter((id) => id !== movedId))
  return replaceColumn(withoutMoved, target.column, [...withoutMoved[target.column], movedId])
}

function moveWithin(ids: string[], fromIndex: number, toIndex: number): string[] {
  const result = [...ids]
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}

function replaceColumn(columns: BoardColumns, index: number, newColumn: string[]): BoardColumns {
  return columns.map((column, i) => (i === index ? newColumn : column))
}
