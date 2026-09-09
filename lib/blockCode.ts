import { randomInt } from 'crypto'

/**
 * The "community code" is a pseudo-secret: knowing it is the only thing gating /<code>'s
 * public content, and it's the only way to reach the private (signed-in resident) content too.
 * Not listed anywhere, not enumerable — but not a real secret either (see product-brief.md),
 * so this is about making it unguessable, not cryptographically airtight.
 */

const RESERVED_CODES = new Set(['admin', 'api', 'blocks', 'new', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml'])

// adjective-animal-number instead of a random string — a default a steward can actually say out
// loud at a block party, per Roman. 48 × 42 × 100 ≈ 200,000 combinations: word-word alone
// (~2,000) was too small once you remember the code is also the enumeration barrier for
// /<code> (see the doc comment above) — at ~2,000, scripting through every combination to find
// every public community page is trivial, and there's no rate limiting on that route yet.
// Collisions just retry with a fresh triple (see blocks.create in lib/adapters/supabase.ts).
const ADJECTIVES = [
  'brave', 'calm', 'cheerful', 'clever', 'cozy', 'curious', 'eager', 'feisty', 'friendly',
  'gentle', 'happy', 'jolly', 'kind', 'lively', 'lucky', 'merry', 'mighty', 'nimble', 'plucky',
  'proud', 'quiet', 'quick', 'scrappy', 'shiny', 'silly', 'snappy', 'sunny', 'swift', 'tidy',
  'warm', 'witty', 'zesty', 'breezy', 'bold', 'bright', 'chill', 'dapper', 'dizzy', 'fuzzy',
  'giddy', 'humble', 'jaunty', 'keen', 'loyal', 'nifty', 'peppy', 'perky', 'sturdy',
]
const ANIMALS = [
  'otter', 'fox', 'rabbit', 'badger', 'beaver', 'heron', 'sparrow', 'robin', 'raccoon',
  'squirrel', 'hedgehog', 'owl', 'deer', 'moose', 'turtle', 'gecko', 'panda', 'koala', 'llama',
  'alpaca', 'penguin', 'dolphin', 'walrus', 'seal', 'falcon', 'eagle', 'hawk', 'wolf', 'lynx',
  'bison', 'elk', 'mole', 'vole', 'wren', 'finch', 'crane', 'stork', 'pelican', 'newt', 'crow',
  'lark', 'goose',
]

export function generateBlockCode(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)]
  const animal = ANIMALS[randomInt(ANIMALS.length)]
  const number = randomInt(100)
  return `${adjective}-${animal}-${number}`
}

export type BlockCodeValidationError = 'too_short' | 'too_long' | 'invalid_characters' | 'reserved'

const BLOCK_CODE_ERROR_MESSAGES: Record<BlockCodeValidationError, string> = {
  too_short: 'Code must be at least 3 characters.',
  too_long: 'Code must be 32 characters or fewer.',
  invalid_characters: 'Code can only contain lowercase letters, numbers, and hyphens.',
  reserved: 'That code is reserved — please pick another.',
}

export function blockCodeErrorMessage(error: BlockCodeValidationError): string {
  return BLOCK_CODE_ERROR_MESSAGES[error]
}

/** Normalizes and validates a steward-chosen vanity code. Does not check uniqueness — that's a DB constraint. */
export function validateBlockCode(raw: string): { code: string } | { error: BlockCodeValidationError } {
  const code = raw.trim().toLowerCase()
  if (code.length < 3) return { error: 'too_short' }
  if (code.length > 32) return { error: 'too_long' }
  if (!/^[a-z0-9-]+$/.test(code)) return { error: 'invalid_characters' }
  if (RESERVED_CODES.has(code)) return { error: 'reserved' }
  return { code }
}
