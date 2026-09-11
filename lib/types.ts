import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Domain types for Block Roster — schema v3, mirrors ../supabase/migrations/*.sql /
 * notes/minimal-schema-proposal.md exactly. See notes/product-brief.md for product rationale.
 */

export type CanvasType = 'geo_map' | 'image' | 'none'
export type BlockStatus = 'draft' | 'live' | 'archived'

export type Block = {
  id: string
  name: string
  canvasType: CanvasType
  // Geojson polygon when canvasType === 'geo_map'; unused otherwise.
  boundary: Feature<Polygon | MultiPolygon> | null
  // Image URL + dimensions when canvasType === 'image'; shape not yet pinned down — 'image'
  // canvas type isn't built in the UI yet.
  canvasBackground: unknown | null
  status: BlockStatus
  residentExportEnabled: boolean
  // Steward-controlled: the Lending Library is opt-in complexity, off by default. Nothing about
  // items themselves is deleted when this is turned off — the tab just stops showing.
  lendingLibraryEnabled: boolean
  // Pseudo-secret slug for the public/private landing page at /<code> — see lib/blockCode.ts.
  code: string
  // Shown to anyone who knows the code, no sign-in required.
  publicBlurb: string | null
  // Shown only to a signed-in approved resident or active steward — see
  // resolveApprovedResident/getResidentDirectory in lib/application.ts.
  privateNotes: string | null
  createdAt: string
}

export type BlockInput = {
  name: string
  canvasType?: CanvasType
  boundary?: Feature<Polygon | MultiPolygon>
  code?: string
  publicBlurb?: string | null
  privateNotes?: string | null
  residentExportEnabled?: boolean
  lendingLibraryEnabled?: boolean
}

export type Residence = {
  id: string
  blockId: string
  label: string
  // Resident-facing, set by any approved resident of this residence (or a steward) — the
  // official label stays address-based; this is the friendlier name neighbors actually use.
  // Purely cosmetic: never used for de-dup, sorting, or matching against OSM suggestions.
  nickname: string | null
  // Format depends on the parent block's canvasType: geojson polygon (geo_map), normalized
  // 0-1 image-space polygon (image, not yet designed), or null (none/list-only).
  shape: Feature<Polygon | MultiPolygon> | unknown | null
  // Steward-only scratch space ("4 people, 1 vegan, dog named Fido") — never shown to
  // residents, not even an approved one of this exact residence. Stricter than nickname/blurb,
  // which residents can see or set themselves. Callers building a page for a non-steward viewer
  // MUST null this out before the Residence reaches any client component — see
  // app/[code]/page.tsx's `redactForViewer`. It's plain app-layer access control, same as every
  // other visibility rule here (see notes/minimal-schema-proposal.md's "Data access" section);
  // nothing enforces it at the database row level.
  stewardNotes: string | null
  createdAt: string
  updatedAt: string | null
}

export type ResidenceInput = {
  blockId: string
  label: string
  nickname?: string | null
  shape?: Feature<Polygon | MultiPolygon> | unknown
  stewardNotes?: string | null
}

export type ResidentStatus = 'pending' | 'approved' | 'moved_out'

export type Resident = {
  id: string
  residenceId: string
  name: string
  status: ResidentStatus
  approvedBy: string | null // steward id
  approvedAt: string | null
  // Freeform, always block-wide, no per-field visibility — replaces the earlier curated
  // true/false self-declared-flags idea entirely.
  blurb: string | null
  createdAt: string
  updatedAt: string | null
}

export type ResidentInput = {
  residenceId: string
  name: string
  blurb?: string | null
}

export type ContactMethodType = 'phone' | 'email'
export type ContactVisibility = 'steward_only' | 'block_wide'

export type ContactMethod = {
  id: string
  residentId: string
  type: ContactMethodType
  value: string
  verifiedAt: string | null
  // Set alongside verifiedAt: the auth.users id of the Supabase Auth session created when
  // this contact method's OTP succeeds.
  userId: string | null
  visibility: ContactVisibility
  createdAt: string
  updatedAt: string | null
}

export type ContactMethodInput = {
  residentId: string
  type: ContactMethodType
  value: string
  // Default block_wide per the revised visibility philosophy — resident can narrow later.
  visibility?: ContactVisibility
}

export type StewardStatus = 'active' | 'inactive'

export type Steward = {
  id: string
  blockId: string
  userId: string
  addedBy: string | null // steward id; null for founding steward(s)
  status: StewardStatus
  lastActiveAt: string | null
  createdAt: string
}

/**
 * The Lending Library's starter categories — deliberately just a plain string at the database
 * level (no CHECK constraint), so growing this list later is a one-line code change, not a
 * migration. Roman: "I *REALLY* don't want extra, unused categories," so keep this short and
 * only add to it once there's a real need, not speculatively.
 */
export const ITEM_CATEGORIES = ['tool', 'book', 'game', 'other'] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

export const ITEM_CATEGORY_LABEL: Record<ItemCategory, string> = {
  tool: 'Tool',
  book: 'Book',
  game: 'Game',
  other: 'Other',
}

export type Item = {
  id: string
  // A person's belonging, not tied to their address — survives a move within the same
  // community cleanly, and roommates each have their own items rather than sharing one pool.
  residentId: string
  name: string
  description: string | null
  category: ItemCategory
  createdAt: string
  updatedAt: string | null
}

export type ItemInput = {
  residentId: string
  name: string
  description?: string | null
  category?: ItemCategory
}
