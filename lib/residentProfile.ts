import type { ResidentProfile, SignupPromptKey } from './types'
import { EARLIEST_MOVED_IN_YEAR, MAX_TEXT } from './validation'

/** Labels for the steward's "Sign-up questions" checklist, in form order. */
export const SIGNUP_PROMPT_LABELS: Record<SignupPromptKey, string> = {
  blurb: 'About you',
  movedInYear: 'Year you moved in',
  favoriteSpot: 'Favorite local spot',
  countMeInFor: 'Count me in for…',
  askMeAbout: 'Ask me about…',
}

type TextPromptKey = Exclude<keyof ResidentProfile, 'movedInYear'>

/** The free-text sign-up prompts, in display order. The placeholder hints at answers before anyone types. */
export const TEXT_PROMPTS: { key: TextPromptKey; label: string; placeholder: string; max: number }[] = [
  {
    key: 'favoriteSpot',
    label: 'Favorite local spot',
    placeholder: 'e.g. a park, a coffee shop, the taco place around the corner',
    max: MAX_TEXT.favoriteSpot,
  },
  {
    key: 'countMeInFor',
    label: 'Count me in for…',
    placeholder: 'e.g. evening walks, porch beers, potlucks, frisbee, board game nights',
    max: MAX_TEXT.countMeInFor,
  },
  {
    key: 'askMeAbout',
    label: 'Ask me about…',
    placeholder: 'e.g. gardening, bike repair, living abroad, sourdough',
    max: MAX_TEXT.askMeAbout,
  },
]

export const EMPTY_PROFILE: ResidentProfile = {
  movedInYear: null,
  favoriteSpot: null,
  countMeInFor: null,
  askMeAbout: null,
}

/** Newest first — most people moved in recently, so they shouldn't scroll past decades to find it. */
export function movedInYearOptions(): number[] {
  const years: number[] = []
  for (let year = new Date().getFullYear(); year >= EARLIEST_MOVED_IN_YEAR; year--) years.push(year)
  return years
}

export function pickProfile(resident: ResidentProfile): ResidentProfile {
  const { movedInYear, favoriteSpot, countMeInFor, askMeAbout } = resident
  return { movedInYear, favoriteSpot, countMeInFor, askMeAbout }
}
