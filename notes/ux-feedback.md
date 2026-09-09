# UX Feedback Tracking

Claude-maintained triage log of UX/product feedback from using the app. Raw feedback goes in
`../inbox.md` first — Claude reads that file but never writes to it (Roman's, not Claude's);
Claude copies items here once triaged into a tracked item, it doesn't move or clear them from
the inbox. Durable philosophies that apply to everything (not just this list) live in
`philosophy.md` instead, since those are loaded every session via `CLAUDE.md`, not read on
demand like this file.

## Open feedback

- **Hover vs. click for residence selection** — Roman asked whether selecting a residence (List ↔
  Map highlighting) should happen on hover instead of click, and specifically asked how that'd work
  on mobile / where hover falls down. Answered in chat, not implemented: hover doesn't exist as an
  input on touch devices (mobile/tablet — this app's realistic resident device), and hovering the
  List while looking at the Map (or vice versa) requires the mouse to be over one to affect the
  other, which doesn't hold up the same way once "selected" needs to be a real state (e.g. driving
  Edit/Save/Cancel, as it does now for shape editing) rather than purely a transient visual cue.
  Click stays. 2026-09-09.
- **Resident's own view after sign-in, flattening the list** — Roman is thinking ahead to giving
  residents richer profile info and wondering whether each list entry should become
  expandable/click-into rather than always showing everything inline. Partially addressed: long
  blurbs now clamp to 2 lines with a Show more/less toggle (see below), which is the immediate
  problem this was about — but the bigger "flatten into a clickable/expandable entry with more
  profile fields" question is still genuinely open, not decided. 2026-09-09.

## In progress — implemented, not yet verified by Roman in a browser

- **Feature, "your blocks" listing** — The home page now lists every block you actively steward
  (name + coverage count) instead of just a bare "create a block" CTA. Uses a new
  `stewards.listByUserId`. 2026-08-08.
- **Feature, admin page** — `/admin` lists every block with residence/steward counts and a
  per-block delete (cascades via the DB's existing FK constraints). Gated by an `ADMIN_EMAILS`
  env-var allowlist (`lib/admin.ts`) — not a real role system, deliberately the smallest thing
  that works for a one-person tool. An "Admin" link shows in the header when you're on the
  allowlist. Roman: I set `ADMIN_EMAILS` to roman.b.grebin@gmail.com in `.env.local` — update it
  if you test as a different account. 2026-08-08.
- **Bug, was blocking** — The email-OTP step sent a magic link, not a 6-digit code, so testing
  couldn't get past "enter your code." Redesigned to be link-only: `ResidentIntakeForm` sends
  the link and stops; `app/blocks/[id]/join/complete` finishes verification server-side; the
  old code-entry endpoint was deleted. 2026-08-08.
- **UX, more screen real estate** — Widened page containers and bumped body/button/input text
  and touch-target sizes across every page (home, create-block, dashboard, join, join/complete)
  — accessibility-minded given older users may use this. The block-boundary map on the
  create-block page grew from a small fixed box to most of the viewport. Later simplified
  further to one shared `PageContainer` component (no max-width at all — fills available
  space) instead of a different max-width per page. 2026-08-08.
- **Feature, location search on the map** — `DrawableMap` has a search box overlaid on the map
  (Nominatim geocoding, no API key needed) that flies the map to a searched address before
  drawing. 2026-08-08.
- **UX, Add Residences fewer clicks, then redesigned again** — First pass made the multi-line
  paste box always-visible instead of click-to-reveal. Then changed again per Roman: one
  residence at a time via a single-line input, not a bulk paste box — sets up better for a
  future "draw this residence's shape" step, which a bulk list has no way to attach to. 2026-08-08.
- **Feature, phone/other contact method** — Resident intake now has an optional phone field,
  shown on the steward dashboard alongside email. It is *not* verified — phone OTP still needs
  a paid SMS vendor, which is a deliberate earlier decision, not reopened here (see
  `scaffold-status.md`). If real phone verification turns out to matter, that's a bigger call
  for Roman to make, not something to slip in quietly. 2026-08-08.

- **Feature, community page (public/private tiers), then merged with the steward dashboard** —
  After a real block get-together where neighbors asked for a directory and floated a
  tool/book/seed lending library, added the skeleton those build on: every block gets a
  pseudo-secret "community code" at `/<code>` (replaces the old `/blocks/[id]/join` link).
  Anyone with the code sees a public blurb + the join form; a signed-in approved resident or
  active steward additionally sees a resident directory and a free-text steward note. Residents
  now get a real (magic-link) sign-in for the first time — previously they never got a
  persistent account at all. `AuthButton.tsx` (renamed from `StewardAuthButton.tsx`) is shared
  by both roles. Same day, per Roman (referencing ourblock.community/local-block-app's model):
  folded the separate `/blocks/[id]` steward dashboard into this same page instead of keeping
  two pages — a steward now sees the identical `/<code>` page a resident would, plus a "Manage"
  panel (add residences, approve pending, edit code/blurb/notes) and the unfiltered resident
  list, rather than a distinct dashboard. `/blocks/[id]` no longer exists. Migration pushed,
  `tsc`/lint clean, curl-level smoke tests pass — **not yet walked through in a browser**.
  2026-09-07/08.

- **Bug, "Join" section shown to people who don't need it** — Roman noticed a steward or
  approved resident visiting `/<code>` still saw the full "Join {block}" registration form below
  everything else, same as a stranger would. Now hidden whenever the viewer already has private
  access (steward or approved resident) — only a signed-out visitor or a not-yet-approved
  account sees it. 2026-09-08.

- **Copy, "block" → "community" in UI text** — Roman noticed the word "block" was everywhere and
  reading clunky (e.g. "create a block as a steward, or to see any blocks you're already a
  resident of"), and asked whether another term had ever been preferred. It had — flagged as an
  open question in `minimal-schema-proposal.md` since the schema doc's addition of apartment
  buildings as a first-class case, and his own `inbox.md` entries already said "community"
  unprompted every time. Renamed all UI copy, user-facing error strings, and forward-facing
  comments to "community"; left DB schema, code identifiers, route paths, and the "Block Roster"
  product name untouched (see `minimal-schema-proposal.md`'s Naming section for the exact
  boundary). 2026-09-08.

- **Feature, steward promotion replaces invite; move-out implemented** — Roman confirmed the
  browser build works (first rough pass, not a close look yet) and asked to move on to features.
  Picked from the "Not done yet" list: co-steward invite flow and `moveResidentOut`. On invite,
  Roman pushed back — "I don't know why we need invite" — so instead of building invite UI on
  top of the existing token/email schema, removed that schema entirely and added
  `promoteResidentToSteward`: a steward picks an already-approved resident and promotes them
  directly, reusing the `userId` they already have from registering. `moveResidentOut` (designed
  since the original schema, never built) is now real — resets contact visibility, re-derives
  residence status. Explicitly skipped `confirmResidentPresence` (annual reconfirmation) per
  Roman: a steward will notice and record move-outs manually for now. Migration pushed, `tsc`/
  lint clean, curl smoke tests pass — **not yet browser-tested**. 2026-09-08.

- **Feature batch: residence edit/delete, CSV export, resident self-service, map picker** —
  Roman confirmed the browser build works end to end (first rough pass) and asked for more
  feature ideas before the lending library. From that list, picked four plus the previously-
  deferred map: (1) `ResidenceControls` — inline rename/delete for a residence, steward-only,
  delete warns with the resident count if any. (2) CSV export (`GET /api/blocks/[id]/export`) —
  full roster for a steward, peer-safe (approved + `block_wide` only) for a resident, gated by a
  newly-exposed `resident_export_enabled` toggle in the Manage panel (the DB column existed
  since the original schema but nothing ever set it). (3) `MyInfoForm` — a signed-in approved
  resident edits their own freeform blurb (rendered inline in the directory) and toggles each
  contact method's visibility themselves, ownership-checked via the contact method's `userId`
  rather than steward-mediated. (4) `ResidenceShapeButton` (steward draws/edits a residence's
  shape, reusing `DrawableMap`) + `ResidenceMapPicker` (resident taps a shape to register,
  reading `lib/mapStyle.ts`'s shared basemap) — "tap your house on a map," standalone per
  Roman's earlier note but folded into this batch since the residence-shape PATCH route the
  edit/delete work added was a natural foundation for it. The plain-list dropdown stays as the
  always-available fallback for any residence without a shape yet. `tsc`/lint clean throughout
  (one React-refs lint error caught and fixed — a ref was being written during render instead of
  in an effect) — **none of these four have been opened in a browser at all**. 2026-09-08.

- **Feature, design system + landing page rewrite** — Roman liked local-block-app's
  look-and-feel and landing-page flow and asked for a comparison + next steps; after reviewing
  it (see `product-brief.md`'s "Community page" section for the one-page-not-two decision that
  came out of that same conversation), applied a *distinct* visual identity inspired by it, not
  copied: warm parchment background, terracotta/clay accent (vs. local-block-app's teal —
  deliberate, so this doesn't read as borrowed branding), serif (Lora) headings over sans
  (Manrope) body, pill buttons, rounded-2xl cards, tinted button shadows. Every component
  re-skinned off the old default-Tailwind blue/gray. Home page rewritten: a specific
  problem-contrast hook instead of generic copy, a 3-step "how it works," and a new
  `EnterCodeBox` — residents previously had no way to reach their block without a full link;
  now there's a "type your code" front door, matching local-block-app's core landing-page
  mechanic. `tsc`/lint clean, tokens/fonts confirmed present in compiled CSS —
  **not yet seen in an actual browser**. 2026-09-08.

- **Gap, resident members had no path back to their block from the home page** — Roman
  noticed the home page only ever told a signed-in visitor to "sign in as a steward to create a
  block," even if they were an approved resident (not a steward) of one — there was no listing
  for them at all, steward or not. Added `listApprovedResidentBlocks` (`lib/application.ts`) and
  moved "Your blocks" to the top of the home page, above the marketing/hook content, combining
  steward blocks and resident-membership blocks into one list with a "Steward"/"Resident" badge
  per row (a block you steward shows once, as "Steward," even if you're also an approved
  resident there). Sign-out copy now mentions both reasons to sign in. 2026-09-08.

- **Bug, every map has been watermarked all session** — Roman asked to bring over a CARTO
  basemap API key he'd registered from `geographic-community-webapp` (also good for
  `ourblock.community` + `localhost`). Investigating turned up why: CARTO started requiring a
  key on its basemap CDN around Aug 2026, and a keyless request gets a gray "API KEY REQUIRED"
  watermarked placeholder tile back instead of an error — easy to miss, and block-roster's
  `DrawableMap`/`ResidenceMapPicker` had been keyless (and thus watermarked) since they were
  built. Verified with a direct tile fetch (keyed: clean 26KB tile; unkeyed: 22KB watermarked
  one) before touching anything. Fixed `lib/mapStyle.ts` to match the corrected pattern
  `geographic-community-webapp` already worked out: bare `basemaps.cartocdn.com` host (dropped
  pointless `a./b./c.` subdomain sharding), `key=` not `api_key=`, falls back to the keyless tile
  if the env var is unset rather than a literal `key=undefined`. Key added to `.env.local` (real
  value) and `.env.local.example` (documented placeholder) — **requires restarting the
  long-running `next dev` process to take effect**, since `NEXT_PUBLIC_` vars are inlined at
  server start; not restarted automatically. 2026-09-08.

- **Inbox batch: map bugs + polish, seven items from real usage** — Roman filled `inbox.md`
  with concrete friction from actually drawing boundaries/shapes and managing residences.
  Resolved all seven:
  1. *Lost draw mode, no way back* — `MaplibreDraw`'s `controls` option only ever showed a
     trash icon (fresh draw) or nothing (editing) — no polygon button, so exiting draw mode
     (Escape, stray click) left no way back in except canceling. Now always shows both.
  2. *Accidental 3D tilt via trackpad* — `maxPitch: 0` on every map now blocks tilt from any
     input method; bearing rotation ("spinning the cardinal directions," which Roman wanted
     kept) is untouched.
  3. *Renaming the code didn't update the link* — turned out worse than described: the page
     itself lives at `/<old-code>`, so a plain refresh would 404. `BlockContentForm` now
     `router.push`es to the new URL when the code changes, not just `router.refresh()`.
  4. *Boring default codes* — `curious-otter`-style adjective-animal pairs replace the random
     alphanumeric default, per Roman's suggestion. Same day, Roman asked whether ~2,000
     combinations was enough — added a number suffix (`curious-otter-42`, ~200,000 combos) once
     the math showed word-word alone made scripting through every possible code (there's no rate
     limiting on the public route yet) trivial, not just a rare collision risk.
  5. *Maps should stay within the community* — new `boundary` prop on `DrawableMap` and
     `ResidenceMapPicker` (via `lib/mapStyle.ts`'s new `boundsOf()`, a turf `buffer`+`bbox`)
     clamps panning and fits the initial view to the block's boundary, for anything drawn
     *within* it (a residence shape) — not the boundary-drawing step itself, which has no
     boundary yet to constrain to.
  6. *No feedback after adding a residence, and it's off-screen* — `AddResidencesForm` shows a
     transient "✓ Added" confirmation; the Manage panel's layout now puts the add-form and the
     Residents list in a two-column grid on wide screens instead of stacked.
  7. *Pre-populate addresses from the boundary* — the biggest ask, and the one genuinely open
     question in the batch. Rather than guess a data source, tested OSM's free Overpass API
     directly against Roman's own real test boundary (a Minneapolis block) before proposing
     anything — 27 real addresses came back, no API key, same free-data philosophy as the
     existing Nominatim search. Built `lib/overpass.ts` + `SuggestedAddresses.tsx`: a
     click-to-add suggestion list shown next to the add-form whenever the block has a boundary,
     reusing the existing bulk-residences endpoint. Fails silently (hides itself) if Overpass is
     slow/down/sparse for that area — never blocks the manual add path.
  `tsc`/lint clean throughout — **none of these seven have been opened in a browser yet**.
  2026-09-08.

- **Feature, suggested addresses now include real shapes, not just labels** — Roman asked
  whether the residence *polygons* could be auto-drawn too, not just the address labels.
  Checked before promising anything: re-ran the Overpass query against the same real test
  boundary with `out geom` instead of `out center`, and all 27 addresses turned out to be
  closed OSM building ways with real geometry, not bare address points. `lib/overpass.ts` now
  returns a `shape` (GeoJSON polygon, built from the way's node ring) alongside each suggested
  label whenever OSM has one; `SuggestedAddresses.tsx` sets it automatically after creating the
  residence — one PATCH per shaped selection, matched back to its label by array order, reusing
  the existing per-residence PATCH route rather than a new endpoint. A suggestion without a
  matched shape (bare address node, or non-`way` element) still adds normally, just unshaped,
  same as typing the label by hand — labeled "(no shape found)" in the list so it's not a
  silent gap. 2026-09-08.

- **Feature, Residences List/Map toggle** — Roman asked to see the map while adding residences,
  and suggested renaming "Residents" to "Residences" with toggleable list/map views. Renamed
  the heading, and pulled the whole section into a new client component
  (`ResidencesSection.tsx` — the server page above it doesn't otherwise need interactivity, so
  the toggle state had to live somewhere new) wrapping the original list plus a new
  `ResidencesOverviewMap.tsx`: every residence with a drawn shape, color-coded by status
  (current/unreached/vacant), click for a popup with label/status/resident names — the
  product brief's "day one is a visible gap map" line, made literal instead of just a coverage
  count. Built with `setDOMContent` (real DOM nodes, `.textContent`) for the popup rather than
  string-interpolated `setHTML`, since residence labels and resident names are free-text a
  resident or steward controls — avoids an XSS opening a raw-HTML popup would've had. Toggle
  only appears when there's something to show a map of (a boundary, or at least one shape);
  residences without a shape are simply absent from Map view, with a count of how many, same
  graceful-degradation pattern as everywhere else this session. 2026-09-08.

- **Bug, boundary-clamped maps couldn't show tall/narrow communities** — Roman screenshotted
  the new Map view on a real north-south-elongated test community: only ~25% of it fit in a
  wide, short card, with dead space on the sides. Root cause was the `maxBounds` clamp added in
  the earlier inbox batch (to satisfy "prevent panning outside the community") — MapLibre's
  `maxBounds` requires the *viewport* (which has the container's aspect ratio) to fit inside the
  bounds on every axis, so a shape much taller than it is wide, inside a container much wider
  than it is tall, forces a zoom far higher than "show the whole thing" needs. Fixed by removing
  `maxBounds` everywhere it was derived from a boundary (`DrawableMap`, `ResidenceMapPicker`,
  `ResidencesOverviewMap`) — kept `bounds`/`fitBoundsOptions` for a sensible initial framing,
  traded the hard pan restriction for free pan/zoom. Considered a fancier fix (padding the
  tighter axis of the bounds box to match the container's live aspect ratio, computed from
  `clientWidth`/`clientHeight`) but didn't build it blind without being able to see the result —
  flagged to Roman as an option if the simpler fix isn't enough. `ResidenceMapPicker`'s `boundary`
  prop became fully unused by this fix and was removed rather than left dead, back through
  `ResidentIntakeForm` to its caller. 2026-09-08.

- **Inbox batch, second pass on the map/residence workflow** — four items:
  1. *Editing a residence's shape didn't center on it* — `DrawableMap` was framing on the whole
     community boundary even in edit mode. Now frames tightly on the residence's own shape
     (`boundsOf(initialGeojson, 0.01)`) when one exists; still frames the community boundary
     when drawing fresh (nothing else to center on yet).
  2. *Address suggestions re-fetched OSM on every page load* — Roman listed several options
     (caching, comparing against existing residences, creation-time-only, a manual button) and
     explicitly offered a button as one of them; picked that over caching since it needs no
     invalidation logic and gives the steward direct control over hitting a third-party API.
     `SuggestedAddresses` is now idle until a "Find addresses near your boundary" click, with
     loading/empty/failed(-retry) states instead of silently hiding on failure — appropriate now
     that it's a deliberate action, not a background nice-to-have.
  3. *Map view didn't reflect newly-added residences* — `ResidencesOverviewMap`'s data only
     loaded once, in the mount effect (deliberately, to avoid tearing down pan/zoom on every
     prop change). Added a second effect keyed on `entries` that calls `source.setData(...)` in
     place instead.
  4. *Copy*: "Found N addresses near your boundary" → "N potential new addresses found in your
     boundary."
  Two sub-asks from the same inbox entry weren't obviously one clear thing — drawing a new
  residence directly on the overview map, and highlighting a "checked" list row differently on
  the map — asked Roman rather than guess a UX for a real design decision. `tsc`/lint clean —
  **not yet opened in a browser**. 2026-09-08.

- **Feature, suggestion previews + draw-to-add on the overview map** — Roman's clarification on
  the two open sub-asks above: "checked in the list" meant a *suggested* address's checkbox
  (not a Residences-list row), and he wants draw-then-label-popup for adding a residence
  straight from the map. Built both. `SuggestedAddresses` and `ResidencesOverviewMap` are
  otherwise-unrelated server-rendered siblings (left/right columns), so sharing state between
  them needed a new client wrapper, `ResidencesWorkspace.tsx` — `SuggestedAddresses` reports its
  shaped suggestions + checked state up (`onPreviewChange`), the map renders them as a distinct
  blue layer (faint/dashed unchecked, solid/bolder checked — deliberately outside the
  green/gray/amber status palette, since these aren't real residences yet). Draw-to-add: a
  "Draw new residence" button drives a `MaplibreDraw` instance with no controls of its own (to
  avoid two competing button sets on one map); finishing a polygon swaps the button for a small
  label-entry bar; submitting reuses the same create-then-PATCH-shape pattern as
  `SuggestedAddresses`. Had to also fix `ResidencesSection`'s empty state, which previously
  short-circuited *before* checking which view was active — a community with a boundary but zero
  residences couldn't reach Map view at all, which would have silently broken drawing the very
  first residence. This is the most interaction-heavy, hardest-to-verify-blind piece built this
  session (mixing a read-only click-popup layer with an active draw tool on the same map) —
  `tsc`/lint clean, but flagged to Roman as the top priority to actually click through.
  2026-09-08.

- **Bug, "Maximum update depth exceeded" on every community page** — confirmed within minutes
  of the feature above shipping (Roman: not failing, but a console error on every open). Root
  cause: `ResidencesWorkspace` passed `existingLabels={(entries ?? []).map(...)}` inline — a
  fresh array every render, *including* the renders its own `onPreviewChange` callback caused.
  `SuggestedAddresses` memoized `visible` off that array's *reference*, so a "new" (but
  content-identical) `existingLabels` produced a "new" `visible`, re-firing the effect that
  calls `onPreviewChange` again — a self-sustaining loop, one call per render, forever. Fixed by
  memoizing `existingLabels` in `ResidencesWorkspace` off `entries` (the only prop that should
  actually invalidate it) instead of recomputing inline. General lesson for this codebase: a
  prop computed inline in JSX and consumed by a child's `useMemo`/`useEffect` dependency array is
  a loop risk the instant that child's effects can trigger the parent to re-render — worth
  grep'ing for `.map(`/`.filter(` inside JSX prop positions if this class of bug resurfaces
  elsewhere. 2026-09-08.

- **UX, side-by-side List/Map on wide screens + a copy tweak** — Roman: on an actual computer
  screen there's room for List and Map at once (map "more of a square," list doesn't need the
  full-width space it was getting). Reworked `ResidencesSection` so both panes always render,
  visibility controlled by Tailwind breakpoint classes keyed off the same `view` state that
  still drives the List/Map toggle below `lg` — the toggle buttons themselves go `lg:hidden`.
  Map's height is `h-96 lg:h-[22rem]`, roughly square at whatever width its grid column gets
  rather than a short full-bleed strip. Also: `SuggestedAddresses`'s idle button now reads
  "Suggest addresses within your community boundary" (was "Find addresses near your boundary").
  2026-09-08.

- **UX, map bigger than list + mutual highlighting** — Roman, looking at the side-by-side
  layout above: make the map wider / list narrower (opposite of what shipped), and can clicking
  (he offered hover as the ideal but click "if that's easier" — took the offer, click is far
  more robust than tracking hover across a MapLibre layer and a list simultaneously) a residence
  in one highlight it in the other. Grid ratio flipped to `[20rem_1fr]`, map height bumped to
  `lg:h-[28rem]`. Highlighting: `ResidencesOverviewMap` gained a dedicated
  `residences-selected` line layer whose `setFilter` flips to the clicked id (cheaper than
  rebuilding a `case` paint expression per click); List rows get `bg-accent-soft` and are
  click-selectable, with `scrollIntoView` when the *map* drives the selection (so a highlighted
  shape's row is never off-screen). Selecting from the List doesn't pan the map to match —
  Roman's ask was specifically about highlighting, and auto-panning on every click seemed more
  likely to disorient than help; easy to add later if wanted. Known minor side effect, not
  fixed: clicking Edit/Delete/Approve/etc. inside a row also toggles that row's highlight, since
  the whole `<li>` is the click target and those are nested buttons — harmless, but visible;
  fixing it means `stopPropagation` in five different button components for a cosmetic-only
  gain, not worth it unless it actually bothers Roman in practice. 2026-09-08.

- **Bug, "Couldn't reach OpenStreetMap" 6-7 times in a row** — Roman hit repeated failures on the
  address-suggestion fetch and asked for both a fix and better loading copy. Rather than guess,
  reproduced it: a standalone script confirmed `overpass.kumi.systems` (the only endpoint at the
  time) was actively returning HTTP 429 (rate-limited), most likely from all the same-session
  testing hitting it from one IP — not a code bug. `lib/overpass.ts` now tries two public mirrors
  in order, falling through to the next on any failure (timeout/non-2xx/network error):
  `overpass-api.de` first, `overpass.kumi.systems` second — ordered that way after confirming via
  direct curl that `-api.de` was healthy while `kumi.systems` was still 429'ing, so the known-good
  one goes first rather than wasting a round-trip on the known-bad one every time. Per-attempt
  timeout raised 15s→25s (just above the query's own `[timeout:20]`, so a slow-but-alive server
  gets a real chance before being aborted). Loading copy: "Looking for addresses within your
  community boundary…" (was "…near your boundary…"). `tsc`/lint clean — **not yet re-tested by
  Roman**, though the original failure was already resolving itself intermittently by the time
  this shipped (rate limits are transient), so the mirror fallback may not get a clean before/after
  comparison; the real test is whether repeated failures stop recurring over time. 2026-09-08.

- **Inbox batch, nine items — add-flow consolidation + shape editing moved to the big map** —
  the largest inbox pass yet. Quick fixes: `CreateBlockForm` shows "Enter a community name to
  continue" instead of the submit button just silently refusing to do anything; `AddResidencesForm`
  got a caption clarifying a residence can be a short label, not just a street address, and its
  post-add confirmation now says "Residences" (leftover "Residents" copy from the earlier rename).
  Two bigger items, both from the same complaint — "it takes up a lot of real estate... too many
  things on screen at once," plus a direct suggestion that "'Draw new residence', 'add a residence'
  by name, and 'find addresses within your boundary' could all be the same experience":
  1. *Add-residence tools collapsed behind one button* — new `AddResidenceTools.tsx` replaces the
     always-visible `AddResidencesForm` + `SuggestedAddresses` pair with a single "+ Add a
     residence" button; expanding it shows both, plus a third option, "Draw a shape directly on
     the map," that closes the panel and jumps straight into the map's draw tool (switches to Map
     view if needed, starts `draw_polygon` immediately) — the three ways to add a residence now
     read as one flow with one entry point, per Roman's suggestion, rather than three separate
     widgets competing for attention.
  2. *Shape editing moved onto the big map* — Roman: "'Draw a shape' should be on the big map, not
     create a little map," plus a related ask about whether editing a residence's name could also
     surface shape-editing right there rather than being disconnected. `ResidenceShapeButton` no
     longer renders its own small inline `DrawableMap`; it's now a plain button (sitting right next
     to the rename control in the same list row) that puts `ResidencesOverviewMap` itself into a
     new `editing-existing` mode — loads the residence's current shape for dragging via
     `direct_select`, or starts a fresh polygon draw if it had none — with a "Save shape" bar
     replacing the usual "Draw new residence" button while active.
  Both new triggers cross component boundaries (`AddResidenceTools` is nowhere near the map;
  `ResidenceShapeButton` sits in a list row, a sibling of the map) — implemented as a bumped
  counter / a `{nonce, residenceId, shape}` object read by `ResidencesOverviewMap`, using React's
  "compare against a mirrored previous prop value during render" pattern rather than calling
  `setState` inside a `useEffect`. That distinction mattered here: a newer ESLint rule
  (`react-hooks/set-state-in-effect`) flagged the first version of this (setState directly inside
  an Effect responding to the prop change) as a cascading-render risk, so the state reset and the
  actual MapLibre/Draw calls (external, imperative — genuinely belong in an Effect) got split into
  two separate hooks. One real tradeoff, not hidden: the map used to simply not render when a
  community had neither a boundary nor any shaped residence; now it renders anyway (a neutral
  world view) whenever a draw/edit request is in flight, so a boundary-less community can still
  get its first shape drawn at all — but with no location search to help find the right spot,
  unlike every other map in the app. Flagged rather than solved, since building real location
  search into this component was more scope than the inbox item asked for. `tsc`/lint clean —
  **none of this has been opened in a browser yet**, and the shape-editing rework is a materially
  different code path from what Roman last actually clicked through, so it's the top priority to
  verify closely. 2026-09-08.

- **Follow-up on the batch above, from a screenshot** — Roman tried it and sent a screenshot with
  five points. (1) A large scribbled red line plus a stray compass badge was occupying real space
  under the collapsed "+ Add a residence" button — flagged to Roman as most likely a stale
  MapLibre canvas orphaned by Next's Fast Refresh when `ResidenceShapeButton`'s old inline
  `DrawableMap` was deleted out from under an open browser tab (a known dev-mode gotcha with
  imperative WebGL libraries + React — Fast Refresh doesn't always run the old cleanup effect for
  a component whose whole render tree just changed shape), not a real bug in the new code; asked
  Roman to hard-refresh (or restart `next dev`) to confirm it's gone. (2) "Just 1 edit button, it
  does both the shape and the name" — `ResidenceShapeButton` deleted entirely; `ResidenceControls`'
  single "Edit" button now also fires the shape-edit request, so a residence row goes from two
  lines (Edit/Delete, then a separate Edit-shape link) to one. This is the actual, verifiable
  space savings for point (1) — a full line removed from every residence row, on top of the
  add-tools column already being collapsed. (3) "Slightly zoom the map and center that residence"
  when editing — added `map.fitBounds(boundsOf(shape, 0.05), { padding: 80, maxZoom: 19 })` when
  entering edit mode with an existing shape (a fresh/shapeless draw has no coordinates to center
  on, so no camera move for that case). (4) The thick black "selected" outline was sitting on top
  of Draw's small drag handles during an edit, since clicking "Edit" also selects that row —
  couldn't grab the vertices. Fixed by filtering the residence being edited out of the normal
  `residences-fill`/`residences-outline`/`residences-selected` layers entirely while its live copy
  is on top via Draw, restored when editing ends. (5) "Remove 'Draw a residence' from the map... we
  want all residence-adding to come through the one experience" — the map's own "Draw new
  residence" button (top-right of the map) is gone; drawing a new residence is now only reachable
  via `AddResidenceTools`' "draw it yourself" option, which still works exactly as before (bumps
  `drawRequest`, the map switches into draw mode with no button of its own needed). `startDrawing`
  and its stale doc comments describing an on-map button were removed along with it, since nothing
  calls it anymore — the map genuinely can't initiate a draw on its own now, only respond to a
  request from outside. `tsc`/lint clean — **still not opened in a browser**; items (3) and (4)
  especially depend on real click/drag testing to confirm they feel right, not just that they
  compile. 2026-09-09.

- **Bug, the actual "space still empty" cause found** — Roman refreshed and confirmed the
  scribble artifact was indeed stale (gone), but the space it had occupied stayed empty, and asked
  directly what was supposed to happen there. Root cause: `ResidencesWorkspace` still wrapped
  everything in a `grid lg:grid-cols-[380px_1fr]` — a layout that made sense when the left column
  held two always-visible components tall enough to look intentional next to the map, but once
  that collapsed to one short button, the grid still reserved the same 380px-wide column across
  the *full row height* (matching the much-taller Residences list/map on the right), leaving a
  tall blank rectangle under the button that had nothing to do with any component's own size — a
  shorter button doesn't save space if the layout around it still allocates the same footprint.
  Fixed by dropping the grid entirely: `AddResidenceTools` now sits full-width *above*
  `ResidencesSection` instead of beside it, so there's no second column to leave empty in the
  first place. Capped its own width (`max-w-sm` on the expanded panel, dropped `w-full` from the
  collapsed button) so it doesn't stretch into an oversized bar now that it's not confined to a
  380px column. This is the actual space-saving fix — the earlier "space not saved" report
  wasn't about the button's own size at all, it was about the layout around it. 2026-09-09.

- **UX, three more spacing/feedback tweaks on the same flow** — Roman: "ok much better," then
  three more asks from a follow-up screenshot.
  1. *Wide instead of tall* — the expanded "Add a residence" panel's three sections (by name,
     suggestions, draw-it-yourself) were stacked full-width rows even on a wide screen, undoing
     some of the space savings from the pass above. Dropped the `max-w-sm` cap and switched to a
     `lg:grid-cols-3` layout (divided by `divide-y`/`lg:divide-x`, which only draws a divider
     between whichever sections actually render — boundary/canDraw can each be false) — stacked
     below `lg`, side by side above it.
  2. *List felt cramped* — `ResidencesSection`'s two-column grid used a fixed `20rem` for the list
     and `1fr` for the map, so only the map actually grew with the viewport. Changed to
     `[1fr_2fr]` — both columns are now proportional shares of the available width, map still
     twice as wide as the list, but the list isn't stuck at a fixed narrow size on a big monitor.
  3. *Draw-new-residence should announce itself* — clicking "Draw a shape directly on the map"
     used to just quietly start the draw tool with no visual cue pulling attention to the map, and
     "Add a residence" stayed sitting there fully clickable the whole time (misleadingly, since
     starting a second add mid-draw would just abandon the first). Now: the map's own draw/edit
     mode is reported outward (`ResidencesOverviewMap`'s new `onModeChange` prop → `ResidencesSection`
     → `ResidencesWorkspace`) so both ends can react. While drawing a new residence: a green
     caption appears above the map ("Draw the new residence's shape on the map below..."), the
     map's border turns green, and a separate absolutely-positioned overlay (not a class on the
     map's own container — `animate-pulse` fades opacity, and that container also holds the live
     MapLibre canvas, which shouldn't itself flicker) pulses a green ring around it. Meanwhile
     `AddResidenceTools` collapses to a plain sentence instead of a clickable button — worded
     differently for `editing-existing` ("a residence's shape is being edited...") vs.
     `drawing-new`, since the same disable-and-hint treatment covers both cases now (started either
     from "draw it yourself" or from a row's Edit button), not just the one Roman explicitly asked
     about. `tsc`/lint clean — **still not opened in a browser**; the pulsing ring and the panel's
     column layout are both purely visual calls that are worth a direct look. 2026-09-09.

- **Inbox batch, eight items — address search polish + list/map save-cancel unification** —
  1. *Copy* — "Suggest addresses..." → "Search addresses..." (button, loading text); the
     add-a-residence caption now reads "A shortened address or any label neighbors would
     recognize (e.g. 'yellow house on hill')" (Roman's exact wording).
  2. *Cross-mirror/inconsistent-OSM-tagging duplicates* — Roman noticed the same real address
     coming back differently shaped ("4504 Longfellow Avenue South" vs "4504 Longfellow Avenue"),
     guessing it was a mirror thing; more likely just inconsistent `addr:street` tagging in OSM
     itself (mirrors relay the same underlying data, they don't reformat it) — either way, the
     fix is the same. New `normalizeAddressLabel()` in `lib/overpass.ts` strips a trailing
     direction and/or street-type word ("Avenue South" → gone), applied where suggestion labels
     are built (so "4504 Longfellow Avenue South" and "...Avenue" now collapse to the same
     "4504 Longfellow" before they even reach the dedup step) and on both sides of
     `SuggestedAddresses`' existing-label check (an existing residence might have been typed by
     hand with the full suffix, which wouldn't otherwise match a normalized suggestion).
  3. *Select all* — a Select all/Deselect all toggle above the suggestion list.
  4. *Rows, not checkboxes, colored like the map* — `PREVIEW_SELECTED`/`PREVIEW_UNSELECTED` moved
     from `ResidencesOverviewMap.tsx` into `lib/mapStyle.ts` so both the map's preview layer and
     `SuggestedAddresses`' list rows share the exact same two blues; each suggestion is now a
     clickable tinted/bordered row (whole row toggles, not just a checkbox) instead of a
     checkbox + label.
  5. *Cancel in the list didn't cancel on the map* — Roman: canceling a residence edit via the
     list's Cancel button left the map still saying "drag the shape's points to adjust it," and
     suggested moving Save/Cancel to the list entirely. Did exactly that: the map's own Save
     shape/✕ buttons during `editing-existing` mode are gone, replaced with a passive hint
     ("Drag the shape's points..."). `ResidenceControls`' existing Save/Cancel now double as the
     map's controls too, via a new `EditShapeCommand` channel (`{nonce, action: 'save'|'cancel'}`,
     the same request/response shape as `EditShapeRequest`) — guarded by a `shapeEditActive` check
     (only true for the one residence the map is actually mid-edit on right now) so Save/Cancel on
     a row that *isn't* the active map edit can't accidentally act on a different residence's
     in-progress shape. Fixed a latent bug in the same pass: `ResidenceControls`' old `handleSave`
     treated "name unchanged" as "just cancel," which would have silently skipped the shape-save
     too when a steward only touched the shape and not the name.
  6. *No way to tell if a residence has a shape without clicking through* — a small "On map"/"No
     shape" badge next to each residence's status in the list, geo_map communities only.
  7. *Hide "Unreached"/empty-registration noise* — Roman: not building resident-registration
     features yet, so the "Unreached" status pill (currently just noise — every residence starts
     there) and "No one has registered here yet." are hidden for now. `current`/`vacant` badges
     are untouched, only `unreached` is suppressed.
  `tsc`/lint clean — **not yet opened in a browser**, and item 5 in particular touches the same
  editing-existing code path from the last two passes, so worth re-checking end to end rather than
  assuming the earlier verification (there wasn't one yet) covers it. 2026-09-09.

- **Bug, confirmed and fixed — shape edits vanished after Save and never came back** — Roman: "For
  an existing residence, adding a shape or editing a shape isn't getting saved. Shape gets drawn,
  'save' gets clicked, and the shape just disappears and never comes back." Traced it rather than
  guessed: `ResidenceControls.handleSave` was calling `router.refresh()` unconditionally right
  after handing off to the new `EditShapeCommand` channel (previous pass) — but that command's own
  effect in `ResidencesOverviewMap` does the actual shape PATCH *asynchronously*, and calls its
  *own* `router.refresh()` once that PATCH resolves. Two refreshes racing: the first (premature)
  one re-fetched pre-save data while the drawn feature had already been cleared off the map
  (`deleteAll()` runs synchronously as soon as the command fires), so the shape had nowhere to
  render from — and the second, correctly-timed refresh apparently never got a chance to actually
  land after that. The underlying PATCH itself was almost certainly still succeeding server-side
  (`fetch` doesn't care about `router.refresh()` calls), so nothing was ever *lost* — the visible
  bug was the UI never showing it back. Fix: `handleSave` now only calls `router.refresh()` itself
  when it *isn't* handing off to a shape command — the map's own effect owns the single refresh in
  that case, timed correctly after its PATCH actually resolves. Root-caused and fixed the same
  session it was reported, not deferred — this is exactly the kind of thing worth verifying by
  hand once Roman's back in the browser, since it's now the second time this specific code path
  (introduced two passes ago) has needed a fix without ever having been clicked through. 2026-09-09.

- **Inbox batch, six more items** —
  1. *Status badges are noise* — Roman: "let's remove the 'Current' badge... anything related to
     whether a residence has residents is probably unnecessary. Users can see if there are
     residents or not [from the list itself]." Removed the whole Current/Vacant/Unreached status
     pill from the residence list (the "On map"/"No shape" badge from two passes ago stays — that's
     about geography, not residents).
  2. *Contact visibility at registration, not just after* — `ResidentIntakeForm` now has a
     "Visible to neighbors"/"Steward only" `<select>` next to both Email and Phone (mirroring
     `MyInfoForm`'s existing post-registration toggle), threaded through a new `emailVisibility`/
     `phoneVisibility` body field → the register route → `registerResident()` (`lib/application.ts`,
     signature changed to accept `visibility` on both the primary contact and the optional phone).
  3. *Highlight the searched address when creating a community* — Roman flagged this one as
     genuinely optional ("if this is at all clunky or complex we should skip it"). Turned out to be
     three lines: `DrawableMap`'s location search now drops a plain `maplibregl.Marker` at the
     found coordinates (replacing any previous one on a repeat search), on top of the existing
     `flyTo`.
  4. *Not obvious where to type the new residence's label* — the label-input pill that appears
     after finishing a fresh polygon now flashes a pulsing accent ring around itself for ~1.5s.
     Deliberately a separate absolutely-positioned overlay, not a class on the pill itself —
     `animate-pulse` fades opacity, and fading the actual `<input>` you're trying to type into
     would be actively unusable, not just distracting. Same "flash once, then stop" logic as the
     rest of this pass avoids the `set-state-in-effect` trap: the *start* of the flash is a
     render-time comparison against a mirrored previous value; only the *end* (via `setTimeout`)
     lives in an Effect, and that setState happens inside the timeout callback, not synchronously
     in the Effect body.
  5. *More explicit drawing instructions* — Roman suggested the literal copy: "Click to add a
     vertex" / "Click the first point to close the shape." Added a bottom-center caption to
     `DrawableMap` ("Click to add points, then click the first point again to close the shape"),
     shown only for a genuinely fresh draw (hidden once editing an existing shape, or once the
     first point's already down) — and updated `ResidencesOverviewMap`'s equivalent hints
     (draw-new and edit-with-no-shape-yet) to the same wording.
  `tsc`/lint clean, routes smoke-tested — **not yet opened in a browser**, though items 3-5 are
  small enough/independent enough that a partial look (just the map-drawing flows) would cover
  most of the risk in this batch. 2026-09-09.

- **Bug, likely root cause found — shape saves failing silently** — Roman re-tested and reported
  "saving an edited boundary [residence shape] seems to still not be working," explicitly asking
  to investigate carefully rather than guess-fix, and offering to test things himself. Re-read the
  whole edit-shape code path skeptically (not assuming the previous pass's race-condition fix was
  the whole story) and found something concrete: neither of the two places
  `ResidencesOverviewMap.tsx` PATCHes a residence's shape (`submitNewResidence`'s inner call, and
  the `editShapeCommand` effect's save) ever checked the response. A failed PATCH — auth hiccup,
  transient network error, anything — would be silently swallowed while the UI moved on as if it
  succeeded, which looks *exactly* like "the shape disappeared and never came back," independent
  of the earlier refresh-race bug. Confirmed there's no RLS or schema constraint that should
  reject a normal save (service-role client bypasses RLS entirely; `shape` is a plain unconstrained
  `jsonb` column), so this was purely a client-side error-handling gap, not a guess about server
  behavior. Fixed by checking `res.ok` in both places and surfacing a dismissible red error pill in
  the map's corner (the one place both call sites already render floating UI) instead of failing
  silently — `saveError` state, cleared at the start of every new draw/edit attempt. This doesn't
  *prove* a failing PATCH was the actual cause of what Roman saw (I can't reproduce it), but it's a
  strict improvement regardless, and if it *was* the cause, the next attempt will show a red error
  message instead of nothing — which itself is the useful diagnostic Roman offered to help gather.
  Asked him to retry and specifically report whether an error message now appears. 2026-09-09.

- **Inbox batch, two more residence-map cleanups** —
  1. *Current/Unreached in the map's click popup* — same reasoning as the list badge removal two
     passes ago: noise once the popup already lists residents (or doesn't). Removed both; kept
     Vacant, since that's a genuinely distinct signal (explicitly no one there) with nothing else
     in the popup to convey it.
  2. *Suggested-address rows looked pre-selected* — Roman: the light blue tint (reused from the
     map's preview layer two passes ago) made every row look already checked, even unchecked ones;
     the same blue reads fine on the map itself. Removed the blue from the list rows entirely —
     unselected is now a plain neutral row (border + hover), selected uses `bg-accent-soft` +
     accent border, the same selection language already used for List row selection in
     `ResidencesSection`. The map's preview layer is untouched.
  `tsc`/lint clean, routes smoke-tested. 2026-09-09.

- **Feature, community page split into tabs** — the big one: "right now it's just kinda a single
  page with all the things on it... turn it into different views or sections," with an explicit
  invitation to brainstorm, try something, and suggest alternatives with tradeoffs. Where the
  overload actually concentrates: a signed-out/pending visitor already sees very little (blurb +
  join form, unchanged by this pass); the steward view was the real offender, stacking a whole
  Manage panel on top of everything a resident already sees. New `CommunityTabs.tsx` (client
  component, takes pre-rendered content as props — the Server Component page still does every
  access check and just omits a section's prop when it doesn't apply) splits the private-access
  view into up to three tabs: **Community** (the Residences workspace + private notes — what a
  plain approved resident sees, and everyone's default landing tab), **My info** (only if
  `viewerResident` — the existing `MyInfoForm`), **Manage** (only if `isSteward` — `JoinLinkBox` +
  `BlockContentForm`). A signed-out/pending visitor sees no tab bar at all (unchanged single view);
  a plain approved resident gets two tabs; only a steward gets all three — the tab bar itself only
  renders once there's more than one tab to show. Deliberately did **not** split "Add a residence"
  out of the Community tab into Manage, even though it's steward-only — it's tightly coupled to
  the *same* live map instance (drawRequest/editShapeRequest both assume the map is already
  mounted and visible), and splitting them across tabs would mean the map isn't even visible while
  you're using the tool that draws on it. All tabs render simultaneously in the DOM (`hidden`/
  `block`, not conditional unmounting) for the same reason the List/Map toggle works that way —
  unmounting a MapLibre map on every tab switch would reset pan/zoom and re-fetch every tile; safe
  here since Community is the default (always-visible-first) tab, so the map is never constructed
  while hidden.

  **Alternatives considered, not built:**
  - *Separate sub-routes* (`/<code>/manage`, `/<code>/me`) instead of client-side tabs. Trades a
    bit of simplicity for real per-section URLs and native back/forward — but this app deliberately
    treats `/<code>` as the one pseudo-secret front door everyone shares (steward, resident,
    visitor alike); multiple bookmarkable URLs for one community cuts against that, and it's more
    restructuring for a benefit (deep-linking to "Manage") nobody's asked for yet. Worth revisiting
    if a steward specifically wants to bookmark/share a direct link to Manage.
  - *Accordion/collapsible sections on one page* instead of tabs — no navigation model to learn at
    all, everything still reachable by scrolling. Weaker fit here specifically because the sections
    aren't really "peers to skim" (you're either configuring the community, checking your own
    info, or looking at residents — three different *modes*, not one continuous document), and an
    always-partially-expanded page doesn't reduce the steward's cognitive load as much as this
    inbox item was asking for.
  - *Keep one page, but reorder/visually demote Manage* (e.g. move it below the fold, collapse it
    by default) — the smallest possible change, but doesn't really solve "different views," just
    rearranges the same one. Didn't build this since Roman's ask was explicitly for actual
    sections/views, not just reordering.
  `tsc`/lint clean, routes smoke-tested — **not opened in a browser at all**, and this is the
  riskiest/highest-value item in this batch to actually click through, especially as a steward
  (all three tabs) and as a plain approved resident (two tabs) on both desktop and mobile widths.
  2026-09-09.

- **Bug, confirmed from a screenshot — residence list rows overflowing horizontally** — a long
  address (or a resident's name + email + Make-steward/Move-out buttons) didn't wrap, spilling
  past the card's right edge instead. Root cause: the relevant flex rows (`ResidencesSection`'s
  per-residence header row, `ResidenceControls`' label+Edit+Delete row, the per-resident row) had
  no `flex-wrap`, and the label/name+email spans had nothing telling them they were allowed to
  shrink/wrap (a long single "word" like an email address just pushed the row wider instead).
  Added `flex-wrap` to all three rows and `break-words` to the text spans. 2026-09-09.

- **UX, Edit/Delete hidden until a residence is selected** — Roman: "selecting a residence doesn't
  really do anything" (right after building mutual List/Map highlighting), suggesting Edit/Delete
  only appear once a row is actually selected, both to give selection a purpose and declutter the
  list, with a different style for the two buttons under this paradigm. `ResidencesSection` now
  only renders `ResidenceControls` (which is where Edit/Delete live) when
  `residence.id === selectedResidenceId`; otherwise just the plain label, same as a non-steward
  viewer sees. This surfaced a real conflict, not just a cosmetic one: the whole row is *also* a
  click target that toggles selection, so without a fix, clicking Edit (or Delete, or even just
  clicking into the rename input) would immediately toggle selection back off — and since
  `ResidenceControls` now only exists *because* the row is selected, that would unmount it
  mid-click instead of the harmless highlight-flicker this bubbling caused before. Fixed by wrapping
  `ResidenceControls` in a `stopPropagation` div. Restyled Edit/Delete from bare muted text links to
  bordered pill buttons, matching the weight of other deliberate secondary actions elsewhere in the
  app — appropriate now that they're a deliberate reveal rather than something always sitting
  there. 2026-09-09.

- **UX, Vacant also dropped from the map's click popup** — follow-up to dropping Current/Unreached
  a pass ago; Roman asked for Vacant to go too. The popup no longer shows a status line at all —
  the fill color already carries it on the map itself. 2026-09-09.

- **UX, long resident blurbs were blowing up row height — first attempt didn't actually clamp
  anything** — screenshot showed a multi-paragraph blurb making one row dominate the list, with a
  "Show more" link that (per Roman) did nothing since "everything is showing" already. Bug in the
  first fix: the blurb `<span>` had both `block` and `line-clamp-2` in its className at once —
  `line-clamp-2` itself sets `display: -webkit-box`, and having `block` also present meant whichever
  utility happens to come later in Tailwind's generated stylesheet (not the order written in
  `className`) wins the `display` property; `block` won, so the clamp never took effect and there
  was nothing for "Show more" to reveal. Rather than patch that, went further per Roman's actual
  ask: don't show *any* resident info unless the row is selected at all, with a small always-visible
  "N residents" badge (next to the existing "On map" one) as the only hint, unselected, that
  anyone's registered there. The whole resident sub-list — name, email, blurb, Approve/Promote/
  Move-out — now only renders when `residence.id === selectedResidenceId`, same mechanism as
  Edit/Delete two passes ago. That reintroduced the same bubbling hazard: Approve/Promote/Move-out
  are plain buttons (not stateful components with something to lose), but clicking one would still
  visually collapse the whole section out from under the click without `stopPropagation` on the
  sub-list. Added it. No more per-blurb clamp/toggle needed — opening the row via selection is now
  the single reveal mechanism, so once open, the full blurb just shows. 2026-09-09.

- **Feature, a steward can register as a resident too, auto-approved** — follow-up to the gap found
  last pass: a founding steward gets no resident record, and the join form was hidden for any
  steward regardless. Roman asked for a recommendation rather than picking silently; recommended
  and built: the **My info** tab now shows for *any* signed-in steward, not just ones with an
  existing resident record — if they have one, it's `MyInfoForm` as before; if not, it's the same
  `ResidentIntakeForm` everyone else uses, with a short explanation of why it's showing there. The
  one real design decision: should a steward's own registration go through the normal
  pending→steward-approves cycle? No — `app/[code]/complete/page.tsx` now auto-approves via
  `approveResident` immediately after the email-verification step succeeds, *if* the verifying user
  resolves to an active steward of that residence's block. Deliberately still requires the normal
  magic-link verification (not skipped) — that step is what sets `ContactMethod.userId`, which is
  what `resolveApprovedResident`/`listApprovedResidentBlocks` actually key off; skipping it would
  make the new resident row invisible to those lookups even after "approval." Success copy on that
  page now differs (mentions the auto-approval) when this path was taken. `tsc`/lint clean, routes
  smoke-tested — **not yet opened in a browser**. 2026-09-09.

- **Copy, phone field caption trimmed** — `ResidentIntakeForm`'s phone label dropped "— for the
  steward, not verified," keeping just "(optional)" — redundant now that the visibility select
  right next to it already says who sees it. 2026-09-09.

- **Gap found and fixed — no way to add *or edit* a phone number** — Roman noticed phone missing
  from "My info" and asked whether that was a bug. Checked the database directly rather than
  assume: neither test resident has a `contact_methods` row of type `phone` at all — not a display
  bug, phone is optional at registration and neither had provided one. That surfaced two gaps at
  once, addressed together since they share the same route: `MyInfoForm` only ever let you toggle
  *visibility* of contacts you already have, with no way to add one you'd skipped, and (Roman's
  immediate follow-up) no way to fix a typo/change your number afterward either. New
  `POST /api/residents/:id/phone` (add, rejects if one already exists) and
  `PATCH /api/residents/:id/phone` (edit the existing one's value) — both ownership-checked the
  same way as blurb/visibility, via the resident's own verified contact's `userId`. Needed a new
  repository method, `contactMethods.setValue(id, value)` (added to the interface and the Supabase
  adapter — no other adapters exist yet to update). `MyInfoForm` gained an add-phone row (shown
  only when there's no phone yet) and an inline Edit for an existing phone (input + Save/Cancel,
  same pattern as `ResidenceControls`' rename). Deliberately did **not** extend this to email —
  email's value is tied to identity (`markVerified`'s `userId` link is proven against it via magic
  link); editing it without a re-verification round-trip would break that, so there's still no edit
  path for it anywhere in this app, by design. 2026-09-09.

## Resolved

- **Bug, confirmed fixed by Roman — shape edits weren't saving (four reports)** — root cause: a
  wrong assumption about how this file's whole "render-time comparison instead of an Effect"
  pattern behaves. Calling `setState` synchronously *during render* doesn't just schedule a future
  render the way an Effect-triggered update does — React detects it and immediately re-invokes the
  component function right then. The `editShapeCommand` render-time reset nulls
  `pendingShape`/`editingResidenceId` to end the edit session, and the save Effect further down the
  *same* render captured its closure from that re-invocation, after the null — not from the user's
  actual drag. Confirmed via temporary `console.log`s (added, then removed once the cause was
  found) showing the save Effect reading `pendingShape: null` right as it ran. Fixed with a ref
  (`pendingEditSnapshotRef`) mirroring the *last non-null* shape/residenceId via a guarded Effect —
  not written during render, which this repo's lint rule flags outright. Also fixed along the way,
  not confirmed as related: `ResidencesSection` switching between a `<div>`/`<span>` at the same
  tree position on selection, which forced an unmount/remount of `ResidenceControls` on any
  incidental `selectedResidenceId` change. Roman: "It worked!" 🎉 2026-09-09.

(moved here once Roman confirms an in-progress item actually works)
