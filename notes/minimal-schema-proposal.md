# Schema v3

Implemented in `../supabase/migrations/` (the single source of truth for the DB schema — no separate `schema.sql`), `../lib/types.ts`, `../lib/repository.ts`. Renamed `addresses` → `residences`. Validated against `user-journeys.md` (results in `schema-journey-evaluation.md`).

## Residence shape is decoupled from geometry

A residence only needs a label and a status. Whether there's a tappable shape, and its format, depends on the block's `canvas_type`: real geo polygon (`geo_map`), floor-plan image region (`image`, not yet built), or none (`none`, plain list).

## Naming

Whether "block" still fits as the top-level name now that a single apartment building is a first-class case — open, zero schema impact either way.

## Data access

All reads and writes go through API routes calling shared application functions — no direct-client Supabase calls, no DB triggers (a trigger only fires for the `supabase` adapter, not `mock`/`json-file`). RLS stays enabled as a defense-in-depth backstop only, not the primary enforcement.

Named application functions:
- `createBlock()` — creates the block + founding steward together
- `registerResident()` — pre-auth intake (service-role)
- `approveResident()` — `pending → approved`; derives residence status to `current`
- `moveResidentOut()` — `approved → moved_out`; derives residence status to `vacant`; resets `block_wide` contacts to `steward_only`
- `confirmResidentPresence()` — logs a confirmation, updates `residences.last_confirmed_at`
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
| created_at | timestamptz | |

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
| user_id | uuid FK, nullable | null until invite accepted |
| added_by | uuid FK, nullable | |
| status | text CHECK IN (`invited`, `active`, `inactive`) DEFAULT `invited` | |
| invited_email | text, nullable | `UNIQUE(block_id, invited_email) WHERE status = 'invited'` |
| invite_token, invite_expires_at | text nullable, timestamptz nullable | |
| last_active_at | timestamptz, nullable | for future orphan-claim |
| created_at | timestamptz | |

Accepting an invite updates the existing row in place — never creates a second one.

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
