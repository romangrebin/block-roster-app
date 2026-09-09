# Schema v3

Implemented in `../supabase/migrations/` (the single source of truth for the DB schema — no separate `schema.sql`), `../lib/types.ts`, `../lib/repository.ts`. Renamed `addresses` → `residences`. Validated against `user-journeys.md` (results in `schema-journey-evaluation.md`).

## Residence shape is decoupled from geometry

A residence only needs a label and a status. Whether there's a tappable shape, and its format, depends on the block's `canvas_type`: real geo polygon (`geo_map`), floor-plan image region (`image`, not yet built), or none (`none`, plain list).

## Naming — decided 2026-09-08

In-app terminology (all UI copy, user-facing error strings, and forward-looking comments) says
"community," not "block" — resolves the old open question about a single apartment building not
really being a "block." Prompted by Roman noticing his own `inbox.md` entries always said
"community" unprompted, never "block."

Deliberately **not** touched, to keep this a pure copy change with zero migration risk:
- DB schema — table/column names stay `blocks`, `block_id`, `canvas_type`, etc.
- Code identifiers — `Block`, `BlockInput`, `BlockRepository`, `blockId`, `lib/blockCode.ts`,
  component names like `CreateBlockForm`, route paths like `/blocks/new` and `/api/blocks/...`.
  Comments inside schema-adjacent files (`lib/types.ts`, `lib/repository.ts`,
  `lib/adapters/supabase.ts`, `lib/application.ts`, `lib/db.ts`) still say "block" too, since
  they describe those same identifiers — renaming the prose but not the code next to it would
  be more confusing, not less.
- The product name stays **Block Roster**.
- Historical notes entries (dated log lines in `ux-feedback.md`, `scaffold-status.md`, etc.)
  weren't swept — some "block" mentions there are real-world (an actual block party), not the
  app's entity, and rewriting history risked getting that distinction wrong at volume.

If code-level consistency (renaming `Block`→`Community` in types/routes/file names too) ever
matters enough to justify the much larger refactor, that's a distinct future decision — this one
only changed what users read.

## Data access

All reads and writes go through API routes calling shared application functions — no direct-client Supabase calls, no DB triggers (a trigger only fires for the `supabase` adapter, not `mock`/`json-file`). RLS stays enabled as a defense-in-depth backstop only, not the primary enforcement.

Named application functions:
- `createBlock()` — creates the block + founding steward together
- `registerResident()` — pre-auth intake (service-role)
- `approveResident()` — `pending → approved`; derives residence status to `current`
- `moveResidentOut()` — `approved → moved_out`; derives residence status to `vacant` (unless another resident there is still `approved`); resets `block_wide` contacts to `steward_only`. Built 2026-09-08.
- `promoteResidentToSteward()` — an approved resident becomes an active steward directly, via the `user_id` on their verified contact method — no invite/email round-trip. Built 2026-09-08, replacing the invite mechanism entirely (see `stewards` table below).
- `confirmResidentPresence()` — designed, not built. Roman's call 2026-09-08: skip the annual reconfirmation cycle for now, a steward tracks move-outs manually until there's a real pilot to learn from.
- every resident-scoped route resolves `resident_id` from the caller's session before touching a row

## Fields

### `blocks`
| field | type | notes |
|---|---|---|
| id, name | uuid, text | |
| canvas_type | text CHECK IN (`geo_map`, `image`, `none`) DEFAULT `geo_map` | |
| boundary | jsonb, nullable | geojson polygon, `geo_map` only |
| canvas_background | jsonb, nullable | `image` only; one image per block |
| status | text CHECK IN (`draft`, `live`, `archived`) DEFAULT `draft` | |
| resident_export_enabled | boolean NOT NULL DEFAULT `true` | gates bulk export for non-stewards |
| code | text NOT NULL UNIQUE | pseudo-secret slug for `/<code>` — random at creation (`lib/blockCode.ts`), steward-editable vanity slug afterward. Added 2026-09-07. |
| public_blurb | text, nullable | shown at `/<code>` to anyone who knows it, no sign-in. Added 2026-09-07. |
| private_notes | text, nullable | shown at `/<code>` only to a signed-in approved resident or active steward. Added 2026-09-07. |
| created_at | timestamptz | |

**Resolving a signed-in user to private access** (added 2026-09-07, see `lib/application.ts`):
`resolveApprovedResident(blockId, userId)` walks every `contact_methods` row that user has
verified (`listByUserId`), and returns the first one whose resident is `approved` and whose
residence belongs to that block — the same `user_id` link `verified_resident_id()` uses in RLS,
just resolved application-side since the app never queries through RLS directly.
`getResidentDirectory(blockId)` is the peer-safe read: approved residents only, `block_wide`
contact methods only — the same visibility a neighbor would get, whether the viewer is actually
a resident or a steward looking at `/<code>` instead of their own dashboard.

### `residences`
| field | type | notes |
|---|---|---|
| id, block_id | uuid, uuid FK | |
| label | text, required | `UNIQUE(block_id, label)` |
| shape | jsonb, nullable | format depends on `canvas_type`; `image`-mode key structure TBD |
| status | text CHECK IN (`unreached`, `current`, `vacant`) DEFAULT `unreached` | fully derived, no manual override |
| last_confirmed_at, created_at, updated_at | timestamptz | |
| sort_order | integer, nullable | optional list ordering |

### `residents`
| field | type | notes |
|---|---|---|
| id, residence_id, name | uuid, uuid FK, text | |
| status | text CHECK IN (`pending`, `approved`, `moved_out`) | no "declined" — opting out means never registering |
| approved_by, approved_at | uuid FK nullable, timestamptz | `CHECK (status != 'approved' OR both set)` |
| blurb | text, nullable | freeform, always block-wide |
| created_at, updated_at | timestamptz | |

### `contact_methods`
| field | type | notes |
|---|---|---|
| id, resident_id, type, value | uuid, uuid FK, text, text | |
| verified_at, user_id | timestamptz nullable, uuid FK nullable | `CHECK (both null or both set)` |
| visibility | text CHECK IN (`steward_only`, `block_wide`) DEFAULT `block_wide` | |
| created_at, updated_at | timestamptz | |

### `stewards`
| field | type | notes |
|---|---|---|
| id, block_id | uuid, uuid FK | |
| user_id | uuid FK, NOT NULL | always set — a steward row is only ever created for an already-authenticated user, `UNIQUE(block_id, user_id)` |
| added_by | uuid FK, nullable | null for the founding steward; another steward's id for a promotion |
| status | text CHECK IN (`active`, `inactive`) DEFAULT `active` | |
| last_active_at | timestamptz, nullable | for future orphan-claim |
| created_at | timestamptz | |

**No invite mechanism** (removed 2026-09-08, migration `20260908000000_remove_steward_invite.sql`
— dropped `invited_email`/`invite_token`/`invite_expires_at` and the `'invited'` status). Roman's
call: a co-steward candidate is someone already registered and approved, not a cold email
contact, so a steward just promotes them directly (`promoteResidentToSteward` above) — one insert,
no token/expiry/accept round-trip. `createFounding(blockId, userId)` and
`promote(blockId, userId, addedBy)` are now the only two ways a `stewards` row gets created.

### `confirmation_log`
| field | type | notes |
|---|---|---|
| id, confirmed_at | uuid, timestamptz | |
| residence_id | uuid FK | |
| resident_id | uuid FK, nullable | |
| confirmed_by | uuid FK, nullable | null = self-confirmed |

## Known limitations, accepted

- One `canvas_background` image per block — doesn't fit multi-floor buildings
- No locking on concurrent "first approved resident" derivation
- Resident peer-read policy on `residents` exposes the whole row (incl. `approved_by`/`approved_at`), not just name + residence

## Deferred

- A "steward note" on a residence, if an explicit opted-out signal is ever needed
- Orphan-claim/succession subsystem (no claims table yet)
- Multi-floor apartment buildings (`canvas_images` child table, if needed)
- Auth identity linking for a resident's second verified contact — use Supabase's identity-linking API so it attaches to the existing session
- JSON key structure for `shape`/`canvas_background` in `image` mode
