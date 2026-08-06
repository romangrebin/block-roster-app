# System Architecture — Three-Piece Picture (decided 2026-08-05, in local-block-app)

This repo (Block Roster) is one of three pieces decided during planning that happened in `local-block-app`'s conversation history and notes (see that repo's `notes/system-architecture.md` for the original, local-block-app-centric version of this note).

## The decision

1. **geographic-community-webapp** (existing, live at geographic.community) stays the public discovery layer, unchanged in scope except one small planned addition: when its point-in-polygon lookup hits a registered block, surface a *light* entry — block name + a public contact method only. No roster data, no steward identity beyond how to reach them. Confirms "yes, something exists here, go ask" without leaking anything this app considers private. Needs a public-contact field distinct from the steward's private login email, which doesn't clearly exist there yet.

2. **Block Roster (this repo)** — the actual product going forward, replacing local-block-app/Our Block. Address-anchored resident roster; see `product-brief.md` for the full concept and `data-model-draft.md` for the schema rationale. Built fresh on Next.js + Supabase, lifting *patterns* (not code — no fork/shared history) from geographic-community-webapp: repository-adapter data layer, polygon-draw + geometry validation UI, magic-link auth setup. Primary entry path is a semi-private QR/link, not public map discovery — that's deliberately geographic-community-webapp's job, not this app's.

3. **local-block-app / Our Block** — superseded. No further feature investment planned there. Its domain will likely be reused for this app once it reaches parity; that repo stays untouched as reference/fallback until then.

## Why this repo wasn't built inside geographic-community-webapp

That repo is a live product with real deployed data. Its RLS/schema defaults assume public-by-default (public read, owner-gated write) — the opposite of this app's "no public directory" principle (see `product-brief.md`'s Philosophy section). Building inside it would couple release cycles and fight the schema's grain in one direction or the other. See `geographic-community-webapp-assessment.md` for the detailed comparison and what was/wasn't reused.

## Open items carried into this repo

- Public-contact field for org steward in geographic-community-webapp (small, not urgent, lives in that repo not this one).
- No hard technical integration planned between the two apps beyond the light lookup above — a block can exist in the geographic-community-webapp directory without ever adopting this app, and there's no automated sync of steward contact info for now.
- Exact timing of local-block-app retirement / domain cutover — deferred until this app has parity.
