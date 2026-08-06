# Scaffold Status

What's built and actually running vs. just designed, and what's left.

## Environment

Default Node (via `nvm`) is 18.20.4; Next.js 16.3.0 needs ≥20.9.0. `.nvmrc` pins `22.7.0` — **run `nvm use` before any `npm`/`next`/`tsc` command**, or things fail in confusing ways (e.g. `next typegen` silently not populating `.next/types/`).

## Before writing more app code

Read `node_modules/next/dist/docs/` — Next 16 has breaking changes from most training data. Everything ported so far typechecks/lints clean, but that doesn't guarantee every App Router pattern used is still idiomatic.

## What's built

- **Scaffold**: `create-next-app` (TypeScript, Tailwind v4, App Router, no `src/`, ESLint), same conventions as geographic-community-webapp.
- **Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`, `@turf/turf`, `maplibre-gl`, `maplibre-gl-draw`, `@vercel/analytics`, `slugify`, `vitest` (dev).
- **`lib/geometryValidation.ts`** — polygon validation (validity, self-intersection via `kinks()`), two area-cap presets (`MAX_BLOCK_AREA_KM2`, `MAX_PARCEL_AREA_KM2`).
- **`components/DrawableMap.tsx`** — single-polygon draw/edit map.
- **Auth chain** (`lib/supabase-browser.ts`, `lib/supabase-server.ts`, `lib/auth.ts`, `app/api/auth/callback/route.ts`, `components/StewardAuthButton.tsx`) — magic-link auth, ported from geographic-community-webapp.
- **`lib/types.ts`, `lib/repository.ts`** — domain types + per-entity repository interfaces matching schema v3 (`minimal-schema-proposal.md`). Interfaces and types only — no adapters, no shared application-layer functions yet.
- **`supabase/migrations/20260806000000_initial_schema.sql`** — schema v3, the single source of truth for the DB (no separate `schema.sql` — that was a duplicate copy, removed). Live on the provisioned Supabase project. 6 tables (`blocks`, `residences`, `residents`, `contact_methods`, `stewards`, `confirmation_log`). RLS enabled as a defense-in-depth backstop only — the application layer is the primary enforcement.
- **Supabase project**: `our-block-roster`, ref `cqhkswfwlzrttqtsgmve`, region `us-east-2`, org `romangrebin's Org`. `.env.local` has the real URL/anon key/service role key (gitignored). DB password was shown once at creation, not stored anywhere — reset via the Supabase dashboard if needed. Future schema changes are new files in `supabase/migrations/`.

## Not done yet

1. **No repository adapters or application-layer functions.** Need `lib/adapters/{mock,json-file,supabase}.ts`, a `lib/db.ts` selector, and the functions that own cross-table logic (`createBlock`, `registerResident`, `approveResident`, `moveResidentOut`, `confirmResidentPresence` — see `minimal-schema-proposal.md`).
2. **No UI beyond scaffold defaults + the auth callback.** No steward setup, no resident intake, no roster view.
3. **No resident intake selection UI** — `DrawableMap` only handles one polygon; "tap your house" is a different, unbuilt interaction.
4. **OTP/SMS delivery mechanism not decided.** Supabase's free-tier email is rate-limited to a handful per hour — would break a block-party-scale simultaneous signup. Phone OTP needs a paid SMS provider, not yet chosen. Decide before building intake UI.
5. **No tests.** `vitest` is installed, nothing written — also the only real way to verify the adapters actually behave identically to each other.
6. **Unaddressed**: image storage for floor-plan uploads, abuse/spam protection on the public intake route, data-retention/deletion posture (see `product-brief.md` Open Questions).
7. Committed to git, no GitHub remote yet.

## Next steps, in order

1. Decide the OTP/SMS delivery mechanism.
2. Write the `mock` adapter + `vitest` tests against it.
3. Build the steward setup flow (sign in → create block → draw boundary → pre-populate residences), `geo_map` canvas only — `image`/`none` modes deferred to a later build.
4. Resident intake API route — can run in parallel, same adapters, no dependency on the steward UI.
5. Trailing: image storage, rate limiting, a written data-retention stance.
