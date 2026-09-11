# Our Block

A tool for neighborhood stewards to build and maintain an accurate, **resident-owned** directory
for their block or building. Not a communication tool — this is about *persistence*:
knowing who lives here, and still knowing it in five years.

The directory anchors on **residences**, not people. People churn; a residence is fixed — that's
what keeps it from going stale when whoever's running it moves away.

## How it works

1. **A steward sets up the community** — draws the boundary, lists the addresses (by hand or
   from OpenStreetMap). Day one starts with every address in place, no residents yet.
2. **Neighbors join with a code, not a public link.** Pick your residence, verify your email.
   The code (`/<code>`, e.g. `curious-otter-42`) isn't listed anywhere.
3. **A steward approves you**, and then it's your community too — see your neighbors, read what
   your steward posted, export anytime.

Optional: a per-community **Lending Library** (tools, books, games) a steward can switch on.

## Tech

- **Next.js 16** (App Router) + React 19, TypeScript strict.
- **Supabase** — Postgres + Auth (magic-link, no passwords). All data access goes through
  Next.js API routes calling shared application-layer functions
  (`lib/application.ts`); the routes enforce authorization by resolving the caller's session to
  a steward/resident row. The DB uses a service-role key server-side, with Row Level Security
  enabled as a defense-in-depth backstop. See `notes/minimal-schema-proposal.md`.
- **MapLibre GL** + CARTO/OpenStreetMap basemap for boundary and residence shapes; Nominatim
  for geocoding, Overpass for address suggestions (all keyless OSM services).
- **Tailwind v4** design tokens in `app/globals.css`.

## Local development

```bash
nvm use                       # Node 22 (see .nvmrc); Next 16 needs ≥ 20.9
npm install
cp .env.local.example .env.local   # then fill in the values (see that file's comments)
npm run dev                   # http://localhost:3000
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CARTO_API_KEY`. Optional: `ADMIN_EMAILS`,
`RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `SITE_URL` (steward notification emails). Full notes
are in `.env.local.example`.

Database schema lives in `supabase/migrations/` (the single source of truth — no `schema.sql`).
Apply changes with `supabase db push`.

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Project layout

| Path | What's there |
|---|---|
| `app/` | Routes — `page.tsx` (landing), `[code]/` (the one community page for everyone), `admin/`, `api/` |
| `components/` | Client components — forms, maps, the residences workspace |
| `lib/` | `application.ts` (cross-table logic), `repository.ts` + `adapters/` (data access), `auth.ts`, `validation.ts`, map/CSV/geometry helpers |
| `supabase/migrations/` | Schema |

## License

MIT — see [LICENSE](LICENSE).
