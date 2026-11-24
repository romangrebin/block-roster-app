'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CorkboardNote } from '@/lib/types'
import { groupIntoColumns, moveNote, readAcrossColumns, type BoardColumns, type DropTarget } from '@/lib/corkboardLayout'
import { MAX_TEXT } from '@/lib/validation'
import { useSaveAndRefresh } from './useSaveAndRefresh'
import CharCount from './CharCount'
import {
  PAPER_SHADES,
  cardShadow,
  corkStyle,
  handwriting,
  inkColor,
  paperShadeOf,
  photoBorderColor,
  pinColor,
  tiltOf,
} from './corkboardLook'

export type BoardNote = {
  note: CorkboardNote
  // A short-lived link to the photo, for a photo note. Null if it's a text note or the file is missing.
  photoUrl: string | null
  authorName: string
  interestedNames: string[]
  viewerIsInterested: boolean
}

const NEW_NOTE_SHADE = PAPER_SHADES[0]

// Tailwind's sm breakpoint. Narrower (a phone) shows one list read across the columns, with no
// dragging, since "which column" means nothing in a single list.
const WIDE_SCREEN_QUERY = '(min-width: 640px)'

function subscribeToScreenWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** False on the server (it can't know the screen), the real answer once in the browser. */
function useIsWideScreen() {
  return useSyncExternalStore(subscribeToScreenWidth, () => window.matchMedia(WIDE_SCREEN_QUERY).matches, () => false)
}

// Droppable ids for each column's empty space. Note ids are uuids, so these can't collide.
const COLUMN_ID_PREFIX = 'column:'
const columnDroppableId = (column: number) => `${COLUMN_ID_PREFIX}${column}`

function dropTargetFromId(id: string): DropTarget {
  return id.startsWith(COLUMN_ID_PREFIX)
    ? { kind: 'column', column: Number(id.slice(COLUMN_ID_PREFIX.length)) }
    : { kind: 'note', noteId: id }
}

/** Under the pointer, a note wins over the column it sits in. Keyboard drags have no pointer. */
const detectDropTarget: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args)
  const underPointer = pointerWithin(args)
  const notesUnderPointer = underPointer.filter((collision) => !String(collision.id).startsWith(COLUMN_ID_PREFIX))
  return notesUnderPointer.length > 0 ? notesUnderPointer : underPointer
}

// Other notes stay put while one is dragged: with uneven heights, sliding them around mid-drag
// jumps. The dragged note lands where it's dropped (see moveNote).
const keepOtherNotesStill: SortingStrategy = () => null
const handwrittenTextClass = `${handwriting.className} text-[1.4rem] leading-snug`

/** POSTs or PATCHes a note's text; returns an error message, or null on success. */
async function saveNoteText(url: string, method: 'POST' | 'PATCH', text: string): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return res.ok ? null : ((await res.json()).error ?? 'Failed to save the note')
}

/** Keeps a textarea exactly as tall as its text, wrapped lines included. */
function useAutoHeight(textareaRef: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [textareaRef, value])
}

/** Enter saves (Shift+Enter is a new line), Escape cancels. */
function noteKeyHandler(onSave: () => void, onCancel: () => void) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSave()
    }
    if (event.key === 'Escape') onCancel()
  }
}

function PushPin() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
      <ellipse cx="12.5" cy="22" rx="4" ry="1.6" fill="rgba(0,0,0,0.22)" />
      <path d="M11 14.5 L11.6 21.5" stroke="#8C8C8C" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="9" r="7.5" fill={pinColor} />
      <circle cx="11" cy="9" r="7.5" fill="none" stroke="rgba(0,0,0,0.18)" />
      <circle cx="8.4" cy="6.4" r="2.3" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

/** A little pad of paper: a few sheets offset beneath the top one. */
function PaperPad({ onClick }: { onClick: () => void }) {
  const edge = 'rgba(60,40,20,0.18)'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Write a new note"
      className={`${handwriting.className} flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-[2px] text-center text-[1.05rem] leading-[0.95] transition-transform hover:-translate-y-0.5 active:translate-y-0`}
      style={{
        backgroundColor: NEW_NOTE_SHADE,
        color: 'rgba(26,25,24,0.5)',
        boxShadow: `1px 1px 0 ${edge}, 2px 2px 0 ${NEW_NOTE_SHADE}, 3px 3px 0 ${edge}, 4px 4px 0 ${NEW_NOTE_SHADE}, 5px 5px 0 ${edge}, 5px 7px 8px rgba(0,0,0,0.2)`,
      }}
    >
      new
      <br />
      note
    </button>
  )
}

/** Tap the pad to take a sheet, write on it, then pin it. Leaving it empty puts it back. */
function NewNote({ blockId }: { blockId: string }) {
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const [isWriting, setIsWriting] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useAutoHeight(textareaRef, text)
  const trimmed = text.trim()

  const putBack = () => {
    setIsWriting(false)
    setText('')
    setError(null)
  }

  const pin = () => {
    if (!trimmed || isPending) return
    setError(null)
    saveAndRefresh(async () => {
      const failure = await saveNoteText(`/api/blocks/${blockId}/corkboard-notes`, 'POST', trimmed)
      setError(failure)
      return !failure
    }, putBack)
  }

  return (
    <div className="mb-8 flex flex-col items-center">
      {!isWriting ? (
        <PaperPad onClick={() => setIsWriting(true)} />
      ) : (
        <div className="w-full max-w-sm">
          <div
            className="flex items-start gap-2 rounded-[2px] px-3.5 py-2.5"
            style={{ backgroundColor: NEW_NOTE_SHADE, boxShadow: cardShadow }}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={noteKeyHandler(pin, putBack)}
              onBlur={() => {
                if (!trimmed) putBack()
              }}
              maxLength={MAX_TEXT.corkboardNote}
              rows={1}
              placeholder="new note…"
              className={`${handwrittenTextClass} min-h-[44px] flex-1 resize-none overflow-hidden bg-transparent py-1.5 outline-none placeholder:opacity-50`}
              style={{ color: inkColor }}
            />
            <button
              type="button"
              // Keeps the textarea focused, so its "empty means put it back" blur doesn't fire first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={pin}
              disabled={!trimmed || isPending}
              aria-label="Pin it"
              title="Pin it"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[opacity,transform] hover:scale-110 disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100"
            >
              <PushPin />
            </button>
          </div>
          <CharCount value={text} max={MAX_TEXT.corkboardNote} />
          {error && <p className="mt-1 rounded-md bg-surface px-2 py-1 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

function NotePhoto({ photoUrl, authorName }: { photoUrl: string | null; authorName: string }) {
  if (!photoUrl) return <p className="text-base text-muted">Photo unavailable.</p>
  return (
    <a href={photoUrl} target="_blank" rel="noopener noreferrer">
      {/* A plain <img>: the signed URL expires, so Next's image optimizer has nothing stable to cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt={`Photo pinned by ${authorName}`} className="w-full" />
    </a>
  )
}

function NoteCard({
  boardNote,
  viewerResidentId,
  isSteward,
  canMove,
}: {
  boardNote: BoardNote
  viewerResidentId: string | null
  isSteward: boolean
  canMove: boolean
}) {
  const { note, photoUrl, authorName, interestedNames, viewerIsInterested } = boardNote
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({ id: note.id, disabled: !canMove })
  const [editingText, setEditingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  useAutoHeight(editorRef, editingText ?? '')

  const isPhoto = note.imagePath !== null
  const isAuthor = note.residentId === viewerResidentId
  const canMarkInterest = viewerResidentId !== null && !isAuthor
  // Text notes get a raised hand ("I'm up for this too"); photos get a heart.
  const interestSymbol = isPhoto ? '♥' : '✋'

  const run = (request: () => Promise<Response>) => {
    setError(null)
    saveAndRefresh(async () => {
      const res = await request()
      if (!res.ok) setError((await res.json()).error ?? 'Something went wrong')
      return res.ok
    })
  }

  const toggleInterest = () =>
    run(() => fetch(`/api/corkboard-notes/${note.id}/interest`, { method: viewerIsInterested ? 'DELETE' : 'POST' }))

  const remove = () => {
    if (!confirm('Take this note off the Corkboard?')) return
    run(() => fetch(`/api/corkboard-notes/${note.id}`, { method: 'DELETE' }))
  }

  const cancelEdit = () => setEditingText(null)
  const saveEdit = () => {
    const trimmed = editingText?.trim()
    if (!trimmed || isPending) return
    if (trimmed === note.text) return cancelEdit()
    setError(null)
    saveAndRefresh(async () => {
      const failure = await saveNoteText(`/api/corkboard-notes/${note.id}`, 'PATCH', trimmed)
      setError(failure)
      return !failure
    }, cancelEdit)
  }

  return (
    // dnd-kit moves the whole card; the tilt sits on the paper inside so the two don't fight.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`relative pt-2 ${isDragging ? 'z-10' : ''}`}
    >
      <div
        className={`flex flex-col gap-3 rounded-[2px] pb-3 ${isPhoto ? 'px-2.5 pt-4' : 'px-3.5 pt-5'}`}
        style={{
          backgroundColor: isPhoto ? photoBorderColor : paperShadeOf(note.id),
          boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.3)' : cardShadow,
          transform: `rotate(${tiltOf(note.id)}deg)`,
          // Marks the spot the dragged note will take.
          outline: isOver && !isDragging ? '3px dashed rgba(255,255,255,0.9)' : undefined,
          outlineOffset: 4,
        }}
      >
        {isPhoto ? (
          <NotePhoto photoUrl={photoUrl} authorName={authorName} />
        ) : editingText === null ? (
          <p className={`${handwrittenTextClass} whitespace-pre-wrap break-words`} style={{ color: inkColor }}>
            {note.text}
          </p>
        ) : (
          <div>
            <textarea
              ref={editorRef}
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={noteKeyHandler(saveEdit, cancelEdit)}
              maxLength={MAX_TEXT.corkboardNote}
              rows={1}
              className={`${handwrittenTextClass} block w-full resize-none overflow-hidden bg-transparent outline-none`}
              style={{ color: inkColor }}
            />
            <CharCount value={editingText} max={MAX_TEXT.corkboardNote} />
            <div className="mt-1 flex items-center gap-3 text-sm">
              <button onClick={saveEdit} disabled={isPending || !editingText.trim()} className="font-medium text-accent cursor-pointer disabled:opacity-40">
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={cancelEdit} className="text-muted hover:text-ink cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-0.5 text-sm">
          <p className="text-muted">{authorName}</p>
          {interestedNames.length > 0 && (
            <p className="text-ink">
              {interestSymbol} {interestedNames.join(', ')}
            </p>
          )}
        </div>

        {editingText === null && (canMarkInterest || isAuthor || isSteward) && (
          <div className="flex items-center gap-3 flex-wrap text-sm">
            {canMarkInterest && (
              <button
                onClick={toggleInterest}
                disabled={isPending}
                aria-pressed={viewerIsInterested}
                aria-label={isPhoto ? 'Heart' : undefined}
                className={`font-medium rounded-full px-3 py-0.5 border border-accent transition-colors cursor-pointer disabled:opacity-40 ${
                  viewerIsInterested ? 'bg-accent text-white' : 'text-accent hover:bg-accent-soft'
                }`}
              >
                {isPhoto ? '♥' : '✋ Interested'}
              </button>
            )}
            {isAuthor && !isPhoto && (
              <button onClick={() => setEditingText(note.text)} className="text-muted hover:text-ink cursor-pointer">
                Edit
              </button>
            )}
            {(isAuthor || isSteward) && (
              <button onClick={remove} disabled={isPending} className="text-muted hover:text-red-600 cursor-pointer disabled:opacity-40">
                Remove
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* The pin is the handle: grab it to move the note. */}
      {canMove ? (
        <button
          {...attributes}
          {...listeners}
          aria-label="Move note"
          title="Drag to move"
          className="absolute left-1/2 top-0 flex h-11 w-11 -translate-x-1/2 -translate-y-3 touch-none cursor-grab items-center justify-center rounded-full transition-transform hover:scale-110 active:cursor-grabbing"
        >
          <PushPin />
        </button>
      ) : (
        <div className="absolute left-1/2 top-0 flex h-11 w-11 -translate-x-1/2 -translate-y-3 items-center justify-center">
          <PushPin />
        </div>
      )}
    </li>
  )
}

/**
 * The board's columns of note ids. Follows the server's layout, except right after this viewer
 * moves a note: then it shows the new layout until the refreshed page data catches up.
 */
function useBoardLayout(notes: BoardNote[]) {
  const serverColumns = groupIntoColumns(notes.map(({ note }) => note))
  const serverLayoutKey = JSON.stringify(serverColumns)
  const [layout, setLayout] = useState({ basedOn: serverLayoutKey, columns: serverColumns })
  if (layout.basedOn !== serverLayoutKey) setLayout({ basedOn: serverLayoutKey, columns: serverColumns })

  const showLayout = (columns: BoardColumns) => setLayout({ basedOn: serverLayoutKey, columns })
  const resetLayout = () => setLayout({ basedOn: serverLayoutKey, columns: serverColumns })
  return { columns: layout.columns, showLayout, resetLayout }
}

/** One column of the board. Its empty space below the last note is a drop target too. */
function BoardColumn({ column, children }: { column: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(column) })
  return (
    <ul
      ref={setNodeRef}
      className="flex min-h-32 min-w-0 flex-1 flex-col gap-7 rounded-md pb-4"
      style={{ outline: isOver ? '3px dashed rgba(255,255,255,0.9)' : undefined, outlineOffset: 4 }}
    >
      {children}
    </ul>
  )
}

/**
 * The Corkboard tab: a cork board of handwritten-looking notes any resident can pin, plus photo
 * notes, in an order anyone can rearrange by dragging a note's pin. Neighbors raise a hand on
 * text notes and heart photos. The author can edit or remove their note, and stewards can remove
 * any. A steward with no resident row of their own can read, rearrange and remove, but not pin
 * or raise a hand.
 */
export default function CorkboardSection({
  blockId,
  notes,
  viewerResidentId,
  isSteward,
}: {
  blockId: string
  notes: BoardNote[]
  viewerResidentId: string | null
  isSteward: boolean
}) {
  const { saveAndRefresh } = useSaveAndRefresh()
  const { columns, showLayout, resetLayout } = useBoardLayout(notes)
  const isWideScreen = useIsWideScreen()
  const [moveError, setMoveError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const noteById = new Map(notes.map((boardNote) => [boardNote.note.id, boardNote]))
  const notesFor = (ids: string[]) => ids.flatMap((id) => noteById.get(id) ?? [])
  const renderNote = (boardNote: BoardNote) => (
    <NoteCard
      key={boardNote.note.id}
      boardNote={boardNote}
      viewerResidentId={viewerResidentId}
      isSteward={isSteward}
      canMove={isWideScreen}
    />
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const newColumns = moveNote(columns, String(active.id), dropTargetFromId(String(over.id)))
    if (newColumns === columns) return
    showLayout(newColumns)
    setMoveError(null)
    saveAndRefresh(async () => {
      const res = await fetch(`/api/blocks/${blockId}/corkboard-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: newColumns }),
      })
      if (!res.ok) {
        setMoveError((await res.json()).error ?? 'Failed to move the note')
        resetLayout()
      }
      return res.ok
    })
  }

  return (
    <section className="rounded-md px-3 pb-6 pt-5 sm:px-5" style={corkStyle}>
      {viewerResidentId && <NewNote blockId={blockId} />}
      {moveError && <p className="mb-4 rounded-md bg-surface px-2 py-1 text-sm text-red-600">{moveError}</p>}
      {notes.length === 0 ? (
        <p className={`${handwriting.className} py-10 text-center text-[1.6rem]`} style={{ color: 'rgba(40,24,10,0.55)' }}>
          nothing pinned
        </p>
      ) : (
        // A fixed id keeps dnd-kit's generated accessibility ids the same on server and client.
        <DndContext id="corkboard" sensors={sensors} collisionDetection={detectDropTarget} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.flat()} strategy={keepOtherNotesStill}>
            {isWideScreen ? (
              <div className="flex gap-5">
                {columns.map((columnIds, column) => (
                  <BoardColumn key={column} column={column}>
                    {notesFor(columnIds).map(renderNote)}
                  </BoardColumn>
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-7">{notesFor(readAcrossColumns(columns)).map(renderNote)}</ul>
            )}
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
