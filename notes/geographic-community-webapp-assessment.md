# Assessment: geographic-community-webapp (sibling project)

Source: /Users/roman/dev/github/geographic-community-webapp
Date: 2026-08-05

## What it is

A public, map-first *directory* of geographically-defined community organizations. Click anywhere on a MapLibre map to see what organization claims that location; anyone can draw a polygon to register a new one; a "steward" claims/verifies a listing via magic-link auth. No feed, no posts, no member accounts beyond one steward per community, no invite codes. This is discovery/directory infrastructure across *many* communities — structurally the opposite of local-block-app, which is one private, invite-gated space per block.

## Stack & maturity

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, MapLibre GL + maplibre-gl-draw + Turf.js, Supabase (Postgres + RLS + magic-link), deployed on Vercel. ~4,700 LOC / 42 files, 29 commits over ~4 months. Has a live production deployment and a DB backup script — further toward "real users" than local-block-app, but narrower in scope. Test suite (`__tests__/`, ~300 lines, covers geometry validation + repository layer) is currently **broken at the vitest config-load step** — not verified by the actual runner recently; changes have been checked via `tsc --noEmit` + manual review instead.

## Architecture pattern

`lib/repository.ts` defines a `CommunityRepository` interface with three swappable adapters: `supabase.ts` (prod), `json-file.ts` (local dev, no DB needed), `mock.ts` (tests) — selected by env var in `lib/db.ts`. Same idea as local-block-app's `DataClient` interface, but cleaner: split into small per-backend files instead of one 798-line flat object, and ships with two free throwaway backends for local dev/testing.

Auth model differs sharply from local-block-app: API routes (`app/api/...`) resolve the caller server-side via Supabase SSR cookies, then the Supabase adapter uses a **service-role key** to bypass RLS — ownership checks happen in the API route layer, not the DB layer. RLS itself is thin (public read/insert; update/delete gated by `claimed_by = auth.uid()`). This is the inverse of local-block-app, where nearly all authorization lives in a 237-line Firestore rules file because there's no server layer at all.

Client state: a single `useReducer` state machine (`app/useMapPageState.ts`) for draw/edit/panel UI — no direct realtime DB listeners from the client (contrast with AppState's multiple `onSnapshot` subscriptions).

## Geo capability — real but not yet exploited

Point-in-polygon lookup (`lib/geo.ts`, Turf `booleanPointInPolygon`) currently fetches *all* communities and filters in JS — not a spatial DB query. Schema stores `geojson` as a plain `jsonb` column with only a slug index. PostGIS (`geometry(MultiPolygon,4326)` + GIST index + `ST_Intersects`) is explicitly deferred — commented-out migration path, not implemented. So "Postgres is better for geo" is true in principle (schema readiness) but not realized in the current code; `getCommunitiesInViewport` is a stub that throws "not implemented."

## Relevant to the local-block-app decision

- **Reusable if we go that direction**: repository-adapter pattern as a model for restructuring local-block-app's data layer; polygon draw/edit UX; geometry validation (self-intersection guard, area capping — has a documented real bug fix for a bowtie-polygon exploit); magic-link auth flow; API-route-mediated writes as an alternative to Firestore-rules-only authorization.
- **Costs if we go that direction**: entirely different stack (Next.js/Postgres/Supabase vs. Vite/React/Firebase) — no shared code, a real migration, not a merge. Zero content/social/membership features — the "richer content within a block" half of the new feature-set direction has no counterpart here. Test suite currently non-functional. The specific "Postgres enables real geo queries" advantage isn't built yet, so adopting this codebase wouldn't hand us working spatial search for free.

See [[feature-planning]] — this assessment feeds the architecture/data-model section of the eventual product spec once the feature-set doc is done.
