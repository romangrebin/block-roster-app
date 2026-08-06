import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Domain types for Block Roster — schema v3, mirrors ../supabase/schema.sql /
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
  createdAt: string
}

export type BlockInput = {
  name: string
  canvasType?: CanvasType
  boundary?: Feature<Polygon | MultiPolygon>
}

export type ResidenceStatus = 'unreached' | 'current' | 'vacant'

export type Residence = {
  id: string
  blockId: string
  label: string
  // Format depends on the parent block's canvasType: geojson polygon (geo_map), normalized
  // 0-1 image-space polygon (image, not yet designed), or null (none/list-only).
  shape: Feature<Polygon | MultiPolygon> | unknown | null
  // Fully derived by the application write path — never set directly except at creation
  // (defaults to 'unreached'). "Stale" isn't a value here; compute it from lastConfirmedAt's
  // age at read time instead.
  status: ResidenceStatus
  lastConfirmedAt: string | null
  sortOrder: number | null
  createdAt: string
  updatedAt: string | null
}

export type ResidenceInput = {
  blockId: string
  label: string
  shape?: Feature<Polygon | MultiPolygon> | unknown
  sortOrder?: number
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

export type StewardStatus = 'invited' | 'active' | 'inactive'

export type Steward = {
  id: string
  blockId: string
  userId: string | null // null until an invited steward accepts
  addedBy: string | null // steward id; null for founding steward(s)
  status: StewardStatus
  invitedEmail: string | null
  inviteToken: string | null
  inviteExpiresAt: string | null
  lastActiveAt: string | null
  createdAt: string
}

export type ConfirmationLogEntry = {
  id: string
  residenceId: string
  residentId: string | null
  confirmedBy: string | null // steward id; null = resident self-confirmed
  confirmedAt: string
}
