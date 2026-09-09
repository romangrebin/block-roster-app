# Lending Library

Added 2026-09-09. The neighbors-lending-tools-books-games-puzzles idea from the original
get-together (see `product-brief.md`) — the first of the "beyond the skeleton" features, and the
first optional/toggleable one. Built after a short Q&A with Roman rather than guessed; the answers
below are decisions, not assumptions.

## Scope decisions (from Roman, 2026-09-09)

- **Steward-togglable, off by default.** `blocks.lending_library_enabled` — an "optional upgrade
  and additional complexity," Roman's words. The whole tab disappears when off; nothing about
  existing items is deleted, so re-enabling later picks up where it left off.
- **Purely informal borrowing.** No "currently borrowed" status, no reservation/request flow.
  Browse shows an item, its owner, and (Roman's specific ask) the owner's contact info right
  there — "make it easier to contact people using the app (e.g. have the owner's phone number on
  hand)" — so you can just message them yourself. Matches the app's existing philosophy: no
  in-app messaging exists anywhere else either. If a real need for tracking who-has-what emerges
  later, that's a genuinely new feature, not a v1 gap to feel bad about.
- **Items belong to a resident, not a residence.** A person's belongings, not their address's.
  Survives a move within the same community cleanly; roommates each have their own listings
  rather than sharing one pool. `items.resident_id`, no `block_id` of its own — Browse/listByBlock
  goes through residents → residences, same indirection the rest of the schema already uses for
  "everything in my block."
- **One tab, two views** (Browse / My items), not two separate top-level tabs. Mirrors the
  Residences List/Map toggle already in the app, and keeps `CommunityTabs`' top-level bar from
  growing every time another optional feature like this one gets added later.
- **Categories: a short, code-only list, not a database enum.** Roman: "I *REALLY* don't want
  extra, unused categories" but also wants adding one to be cheap. `items.category` is a plain
  `text` column with no `CHECK` constraint (unlike `canvas_type`/`status`/`visibility` elsewhere in
  this schema, which are real fixed enums load-bearing for app logic) — the actual allowed set
  lives in `lib/types.ts`'s `ITEM_CATEGORIES` (`tool`/`book`/`game`/`other` to start) and is
  enforced only by the UI's `<select>` offering just those options. Adding a fifth category later
  is a one-line array edit and a deploy, not a migration.
- **Metadata: name + description only.** Explicitly deferred: images, more structured fields.
  `items.description` is a single freeform text column — same "grow by adding a real column later"
  approach as everything else in this schema, not a speculative JSONB metadata blob now.

## Data model

- `blocks.lending_library_enabled boolean default false` — the steward toggle.
- `items` table: `id`, `resident_id` (FK, cascades on resident delete), `name`, `description`
  (nullable), `category` (text, app-enforced set), `created_at`, `updated_at`. See
  `supabase/migrations/20260909000000_add_lending_library.sql`.
- RLS mirrors `residents`/`contact_methods`: owner reads their own, approved peers in the same
  block read everyone's (no block_wide/steward_only split — items are meant to be browsed, unlike
  contact info), stewards read everything in their own block. Same defense-in-depth-only posture
  as the rest of this schema — the app always goes through the service-role client, never RLS.

## Access rules

- **Adding an item**: `POST /api/blocks/[id]/items` resolves the caller to their own
  `resolveApprovedResident` row for that block and creates the item under it — you can only ever
  list items as yourself, there's no "add on behalf of" path.
- **Editing/removing**: `PATCH`/`DELETE /api/items/[id]` — owner (via their verified contact's
  `userId`, same ownership check as blurb/phone/visibility elsewhere) **or** an active steward of
  that item's block. Stewards can remove any listing (e.g. moved-out resident's stale item,
  something inappropriate) without needing to be the owner.
- **Browse's owner-contact display** reuses whatever `getResidentDirectory`/the steward's full
  resident list already computed for the page — no separate visibility logic was written for
  items; a peer sees exactly the same block_wide contacts they'd see in the resident directory,
  a steward sees everything, automatically, because both are keyed off the same already-fetched
  resident/contact data (see `app/[code]/page.tsx`'s `residentInfoById` map).
- A moved-out resident's items aren't auto-deleted (their `residents` row still exists, just
  `status: 'moved_out'`) — but since `residentInfoById` only includes residents the current viewer
  is allowed to see (approved-only for a peer), their stale listings just quietly stop appearing to
  peers the same way their contact info already does. A steward still sees them (and can remove
  them) since a steward's resident list includes every status.

## Deliberately not built yet

- **Editing an existing item's name/description/category** — the `PATCH` route supports it (built
  for exactly this reason — "well designed... able to extend"), but `LendingLibrarySection` only
  wires up add/remove for v1, per Roman's own framing ("residents should be able to add things
  they have"). Adding an inline edit later is a small UI change against an already-existing route,
  not a new feature.
- **Borrow/return tracking, reservations, due dates** — explicitly deferred, see "purely informal"
  above.
- **Photos** — explicitly deferred, per Roman ("eventually we might want images... but let's leave
  that out for now").
- **A resident-facing way to see "all my items across every category" beyond the flat My items
  list** — not asked for; the flat list is fine at expected scale (a handful of items per person).

## Naming

"Lending Library" (Roman's own term, kept) for the feature/tab. Items are just "items" throughout
— code, UI copy, API routes — deliberately not "tools," since games/books/puzzles are just as much
the point. "Browse" / "My items" for the two views.
