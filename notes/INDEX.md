# Notes Index

Three tiers, arrived at by trial and error (see `../inbox.md`'s own history — it used to live
in here, moved out after a real edit conflict): `../inbox.md` is Roman's, raw, read-only for
Claude. `philosophy.md` is Claude's, but small and durable enough to auto-load every session via
`CLAUDE.md`'s `@import` — a new philosophy earns that treatment; a one-off decision or status
update doesn't. Everything else below is Claude's too, but read on demand (checked at the start
of a task) rather than always-loaded, and can be as long/detailed as useful.

- [../inbox.md](../inbox.md) — Roman's notes, lives outside this folder on purpose. Read-only for Claude, always — never write or edit it, even to triage or clear it. Check it every session; copy anything actionable into the relevant note here instead.
- [philosophy.md](philosophy.md) — Durable UX/code philosophies. Auto-loaded every session via `CLAUDE.md` — not something to look up here, listed for completeness.
- [scaffold-status.md](scaffold-status.md) — **Start here.** What's built and running vs. just designed, and what's left.
- [minimal-schema-proposal.md](minimal-schema-proposal.md) — The schema (v3), implemented — `residences`, decoupled shape/geometry, open-by-default visibility, all data access through application functions.
- [product-brief.md](product-brief.md) — Product concept: philosophy, core features, out of scope, open questions.
- [user-journeys.md](user-journeys.md) — Twelve end-to-end journeys used to validate the schema; useful as a regression checklist going forward.
- [schema-journey-evaluation.md](schema-journey-evaluation.md) — Historical design-process record, superseded by the schema doc — short pointer only.
- [data-model-draft.md](data-model-draft.md) — Superseded, original pre-rework schema draft — short pointer only.
- [system-architecture.md](system-architecture.md) — Why this repo exists separately from geographic-community-webapp and local-block-app, and how the three pieces relate.
- [geographic-community-webapp-assessment.md](geographic-community-webapp-assessment.md) — What was and wasn't reused from that codebase, and why.
- [ux-feedback.md](ux-feedback.md) — Claude-maintained triage log of UX/product feedback (fed by ../inbox.md). Check for open items before touching UI code.
- [lending-library.md](lending-library.md) — The Lending Library feature: steward-togglable, resident-owned items, informal borrowing (no in-app tracking), code-only categories. Scope decisions and data model for the first optional/extensible feature beyond the core skeleton.
