import { Patrick_Hand } from 'next/font/google'

// The Corkboard's own look: cork, paper and pins, adapted from the Corkboard on Roman's personal
// site. These colours are deliberately outside the app's design tokens, because they imitate
// real materials.

// A legible handwriting face, so notes read like something a neighbor wrote.
export const handwriting = Patrick_Hand({ weight: '400', subsets: ['latin'] })

export const inkColor = 'rgba(26,25,24,0.88)'
export const pinColor = '#C2412F'

export const PAPER_SHADES = ['#FFF4C2', '#FBF4E6', '#E4EEF2', '#F5E2DC', '#E8F0DD'] as const
export const photoBorderColor = '#FFFDF8'

export const cardShadow = '0 1px 2px rgba(0,0,0,0.25), 0 6px 14px rgba(0,0,0,0.14)'

/** Cork: a warm tan with two layers of fine specks, framed in darker wood. */
export const corkStyle = {
  backgroundColor: '#C49A68',
  backgroundImage:
    'radial-gradient(rgba(92,58,26,0.28) 0.8px, transparent 1.4px), radial-gradient(rgba(255,238,205,0.22) 0.8px, transparent 1.4px)',
  backgroundSize: '7px 7px, 11px 11px',
  backgroundPosition: '0 0, 3px 5px',
  border: '10px solid #7E5D3A',
  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.2)',
}

/** A stable number from a note's id, so its colour and tilt are the same on every visit. */
function numberFromId(id: string): number {
  let total = 0
  for (const character of id) total = (total * 31 + character.charCodeAt(0)) % 100003
  return total
}

export function paperShadeOf(noteId: string): string {
  return PAPER_SHADES[numberFromId(noteId) % PAPER_SHADES.length]
}

/** Between -1.8° and 1.8°. */
export function tiltOf(noteId: string): number {
  return ((numberFromId(noteId) % 7) - 3) * 0.6
}
