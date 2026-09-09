# Block Roster — Working Brief

A tool for block stewards to build and maintain an accurate, resident-owned contact list for their block. Not a communication tool — that problem is solved. This is about **persistence**: knowing who lives here, and still knowing it in five years.

## Philosophy

- **Residences are the record; people are the occupants.** A block is a fixed set of residences. People churn. Anchoring on the residence means move-outs become to-dos, not holes — and it's the only way to answer "who haven't we reached?"
- **Staleness is the product.** A roster nobody refreshes is worse than useless, because people trust it. Every record carries a last-confirmed date.
- **No single point of failure.** Co-stewards by default. The block club dies when the leader moves and takes the list; the tool should make that impossible.
- **The data is never hostage.** Export anytime, no permission needed. If this project dies, blocks keep their roster.
- **Opting out must be socially free.** Some neighbors have real reasons to stay off a list. Not registering is enough — no separate "declined" record is kept (a "steward note" on a residence is the parked idea if that's ever needed — see `minimal-schema-proposal.md`).
- **Paper is a feature.** Printouts survive power outages, dead phones, and defunct startups.

## Core features

**Setup (steward, ahead of time)**
- Draw block boundary; pre-populate residences manually or import from county parcel data (floor-plan image or plain list also supported for buildings a real map can't represent — first build covers the map case only)
- Roster starts complete-but-empty — day one is a visible gap map
- Minimum two stewards enforced before a block can go live

**Intake (resident, ~20 seconds at a block party)**
- QR code → tap your house on a map of large, pre-loaded parcel shapes
- Name + one contact method (phone or email)
- OTP to that contact — proves the contact actually works
- Steward approves; human-in-the-loop beats automated verification at 40 households
- Additional contact methods addable later, not at signup

**Community page** (added 2026-09-07, after a real block get-together — neighbors asked for a
directory and floated a tool/book/seed lending library; this is the skeleton those build on)
- Every block has a pseudo-secret "community code" reachable at `/<code>` — not a real secret,
  not listable/enumerable, but the only way in short of a steward directly sharing it. Replaces
  the old `/blocks/[id]/join` link as the resident-facing front door.
- Two tiers at that one URL: a public blurb + the join form, visible to anyone with the code;
  a resident directory + a free-text steward note, visible only once signed in as an approved
  resident (or steward) of that block.
- This is also the answer to "how does a resident see anything after they're approved?" —
  before this, residents never got a persistent account at all; signing in now reuses the same
  magic-link mechanism stewards already use.
- One page, not two: the steward sees this exact same `/<code>` page, not a separate dashboard
  — a "Manage" panel and the unfiltered resident list render for them in place of the resident's
  filtered view. Roman's call, modeled on ourblock.community/local-block-app's single-page
  pattern (extra buttons for an admin, not a separate admin page).

**Roster**
- Live coverage count: "31 of 44 residences current"
- Per-residence status: current / vacant / unreached; "stale" is computed from last-confirmed date, not a stored status
- Annual one-tap "still here?" re-confirmation cycle
- One-page printable roster, generated fresh, with an annual print nudge
- CSV export by any steward, any time

**Visibility (open by default, per-field opt-down)**

Open by default — hiding info by default undercuts the trust a roster like this depends on. A resident or steward can always narrow specific fields.

- Name + house → verified block members
- Contact info → block-wide by default; resident can narrow any contact method to steward-only
- Blurb (freeform, per resident — replaces the earlier curated true/false flags idea) → always block-wide
- Bulk export available to residents by default; a steward can disable it per block. Still no public block directory — block-wide means verified members, never the open internet

**Succession**
- All stewards equal — no owner account, nothing tied to the creator
- Any steward can export, add, or promote another
- Orphan recovery: if all stewards go inactive ~6 months, block becomes claimable by a verified member, with notice to the block and a waiting period

## Explicitly out of scope (for now)

- Messaging, feeds, forums, events
- Vulnerability or medical data — highest emergency value, highest harm if leaked. Paper-in-a-bin is the right home for this, per Neighborfest.
- Live two-way Google Sheets sync — conflict tax plus the single likeliest accidental-exposure vector. Export button instead.

## Open questions

- No data *deletion* path — only status transitions that re-lock visibility (e.g. moving out resets contact visibility, but the row stays forever). Is re-locking sufficient, or does "remove my info entirely" need a real purge path?
- Cold start is per-block, not per-city: no network effects, ~30 of 44 needed before it's useful. Is a single block-party afternoon enough to clear that bar?
- Can a steward delete their block entirely? Right now only the app-admin allowlist can (`/admin`, testing-only). If this becomes a real steward-facing action, does it need some form of community consensus first, or is steward judgment enough? Raised by Roman 2026-08-10.
- What is the block `boundary` (drawn at block creation) actually for? Still just stored, not consumed — "tap your house on a map" would use it and is still unbuilt (`scaffold-status.md` "Not done yet" #1). Unchanged by the 2026-09-07 community-page work: that added a resident-facing directory, but the residence picker there is still the same plain list, not a map. Raised by Roman 2026-08-10.
