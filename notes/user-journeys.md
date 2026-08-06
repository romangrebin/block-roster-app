# User Journeys — Schema Stress Test

Twelve end-to-end journeys used to validate `minimal-schema-proposal.md` (now implemented in `../supabase/schema.sql`). Useful going forward as a regression checklist — does the real app still satisfy each of these.

## 1. Steward creates a new block and configures its canvas

Actor: founding steward (first person, no invite needed).

1. Signs up / signs in (Supabase Auth magic link).
2. Creates a new block: name, and picks a canvas type — real map, floor-plan image, or list-only.
3. If `geo_map`: draws the block's overall boundary on a real map.
4. If `image`: uploads a floor plan / diagram image.
5. If `none`: skips straight to listing residences.
6. Block is saved in `draft` status — not yet visible to anyone else.

## 2. Steward pre-populates residences

Actor: same founding steward, continuing setup.

1. For `geo_map`: draws individual parcel shapes (or imports county parcel data) for each house on the block.
2. For `image`: draws individual unit regions on the uploaded floor plan.
3. For `none`: types a list of residence labels directly (e.g., "Apt 1" through "Apt 12").
4. Each created residence starts at `unreached` status, no residents attached yet — the "complete but empty" gap map.

## 3. Steward invites a co-steward; block goes live

Actor: founding steward, then invitee.

1. Founding steward sends an invite (email) to a second person to be a co-steward.
2. Invitee accepts, signs in, becomes a second `stewards` row for the block.
3. Once ≥2 active stewards exist, the founding steward flips the block from `draft` to `live`.
4. Edge case worth checking: what stops a block going live with only 1 steward if the founding steward tries anyway?

## 4. Resident self-registers via QR code — typical house on a real map

Actor: a resident at a block party.

1. Scans a QR code tied to the block (or the block + a specific pre-selected residence, if the QR is per-mailbox).
2. Sees a real map, taps their house's parcel shape to select their residence.
3. Enters name + one contact method (phone or email).
4. Receives and enters an OTP to that contact method.
5. Their `residents` row is created (`status = pending`), a `contact_methods` row is created and marked verified (`verified_at`, `user_id` set).
6. Resident sees a "waiting on steward approval" state.

## 5. Resident self-registers in a multi-unit apartment building

Actor: a resident of a 12-unit building.

1. Scans a QR code (posted in the building lobby, say).
2. Sees the building's floor-plan image (`canvas_type = 'image'`) or a plain list of units (`canvas_type = 'none'`) — no real map, since a real map can't distinguish stacked units.
3. Taps/selects their specific unit.
4. Same name + contact + OTP flow as journey 4.
5. Edge case worth checking explicitly: two residents in the same unit (e.g., roommates) both registering against the same `residence_id`. Does the schema support two `residents` rows under one `residence_id`? It should, structurally.

## 6. Steward reviews and approves a pending resident

Actor: a steward, sometime after intake.

1. Steward sees a list of pending residents (`residents.status = 'pending'`) for their block.
2. Reviews name + contact (steward always sees contact info per the brief, regardless of the resident's chosen visibility).
3. Approves: `residents.status → 'approved'`, `approved_by`, `approved_at` set.
4. Residence status may need to update too (e.g., first approved resident at a residence flips it from `unreached` to `current`) — worth checking how/where that rule lives.

## 7. A resident moves away

Actor: a previously `approved` resident who moves away; a steward (or the resident, if still reachable) marks them `moved_out`.

1. `residents.status → 'moved_out'` via `moveResidentOut()`.
2. The residence automatically reverts to `vacant` if no other approved resident remains there — derived, not a separate steward action.
3. The departed resident's row is kept (audit/history), never deleted — there's no deletion mechanism in the schema.
4. Any of the departed resident's `block_wide` contact methods reset to `steward_only` — data isn't deleted, just re-locked.

## 8. Resident self-service after intake

Actor: an already-approved, already-verified resident, returning later.

1. Adds a second contact method (e.g., adds email after registering with just a phone) — requires a fresh OTP to that new contact, per the brief's "additional contact methods addable later."
2. Narrows visibility on an existing contact method from the default `block_wide` down to `steward_only` (the common direction now, since block-wide is the default — not the reverse).
3. Writes or edits their `blurb` — freeform, always block-wide, no visibility choice to make.

## 9. Annual reconfirmation cycle

Actor: a resident (self-confirm) and, separately, a steward (confirming on behalf of a non-responsive resident/vacant unit).

1. Once a year, each residence gets a nudge: "still here?"
2. Resident taps a one-tap confirmation.
3. `confirmation_log` gets a new row (`confirmed_by = null` for self-confirm); `residence.last_confirmed_at` needs to reflect this too.
4. For a residence whose resident never responds, a steward can confirm on their behalf (`confirmed_by = steward id`) — or just leave it: staleness is computed from `last_confirmed_at`'s age at read time, not a status a steward sets by hand.
5. Edge case: a residence with multiple residents — does confirming one resident's info confirm the whole residence, or does each resident need to reconfirm individually?

## 10. A steward goes inactive; orphan-claim recovery

Actor: the block's other steward(s), or a resident wanting to step up.

1. A steward stops logging in / explicitly resigns (exact trigger rule not yet decided).
2. Their `stewards.status` flips to `inactive`.
3. If **all** stewards for a block go inactive for ~6 months, the block becomes claimable.
4. A verified resident can initiate a claim; the rest of the block gets notified; a waiting period passes; the claim resolves (new steward created).
5. Worth checking: does the schema have anywhere to represent an in-progress claim, the notice, or the waiting period — or is this entirely unmodeled today?

## 11. A resident browses the roster to look up a neighbor

Actor: a verified, approved resident, not a steward.

1. Opens the roster view for their block.
2. Sees every other approved resident's name and residence (label) — the brief's "verified block members" default.
3. Sees each visible resident's `blurb` (always block-wide).
4. Sees a neighbor's contact method only if that specific one is `block_wide` — a `steward_only` contact stays invisible to them.
5. Does *not* see anything about pending/moved-out residents — only approved, current residents.
6. Edge case, now resolved by the residences-peer-read policy: "no one's registered here" (`residence.status = unreached`) and "someone lives here, chose to share nothing beyond their name" (`residence.status = current`, no `block_wide` contacts, no blurb) look different at the residence-status level even when the second case shares almost nothing else.

## 12. A resident exports/downloads the roster, or is blocked from doing so

Actor: a verified, approved resident, and separately a steward changing the block's setting.

1. Steward has left `resident_export_enabled` at its default (`true`) — resident sees an export/CSV option in the roster view and downloads it.
2. The export includes only what that resident could already see field-by-field via journey 11 (no `steward_only` contact methods, no pending/moved-out residents) — same visibility rules, just aggregated instead of browsed one at a time.
3. Steward later flips `resident_export_enabled` to `false` for their block — the export option disappears (or errors) for residents; stewards can still export regardless of this setting, per the brief's existing "no bulk view or export for non-stewards" baseline (this setting only ever *adds* resident access, never removes steward access).
