-- Block Roster — schema v3, initial migration
-- Applied via `supabase db push` against the linked project. This file is the single source
-- of truth for the DB schema — no separate schema.sql.
--
-- Entities and their rationale live in notes/minimal-schema-proposal.md and
-- notes/product-brief.md. This is the second full schema for this project — the first
-- (addresses/declined/stale/self_declared_flags, a direct port of geographic-community-webapp's
-- shape) was dropped entirely and replaced with this one on 2026-08-06, since no real
-- application data existed yet to migrate. Future schema changes are new migration files
-- under supabase/migrations/, not edits to this one — once applied, treat it as immutable.

CREATE TABLE blocks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  -- Governs how boundary/canvas_background and every residences.shape in this block are
  -- interpreted. First build only exercises geo_map — image/none exist in the schema for
  -- later, not yet built in the UI.
  canvas_type             text NOT NULL DEFAULT 'geo_map'
                            CHECK (canvas_type IN ('geo_map', 'image', 'none')),
  boundary                jsonb, -- geojson polygon when canvas_type = 'geo_map'
  canvas_background       jsonb, -- image URL + dimensions when canvas_type = 'image'; JSON key
                                 -- structure still needs pinning down before that mode is built
  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'live', 'archived')),
  -- Steward-controlled: gates the bulk/CSV export route for non-stewards. Doesn't affect
  -- per-field visibility rules underneath — see "Data access" section below.
  resident_export_enabled boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- One row per residence, pre-populated at block setup so day one is "complete but empty" (the
-- brief's "visible gap map" philosophy). shape's format depends on the parent block's
-- canvas_type: geojson polygon (geo_map), normalized 0-1 image-space polygon (image), or
-- absent (none/list-only) — nothing enforces that pairing at the DB level, the application
-- write path is responsible for it.
CREATE TABLE residences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id          uuid NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  label             text NOT NULL, -- freeform: "123 Main St", "Apt 435", "Floor 4, Room 35"
  shape             jsonb,
  -- Fully derived by the application write path (see "Data access") — no manual steward
  -- override. "Stale" is a computed read-time flag off last_confirmed_at's age, not a fourth
  -- stored value here.
  status            text NOT NULL DEFAULT 'unreached'
                      CHECK (status IN ('unreached', 'current', 'vacant')),
  last_confirmed_at timestamptz,
  sort_order        integer, -- optional; mainly useful for canvas_type = 'none' list ordering
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz, -- set by the application write path, not a DB trigger — see
                                 -- "Data access" below for why
  UNIQUE (block_id, label)
);
CREATE INDEX residences_block_id_idx ON residences (block_id);
CREATE INDEX residences_status_idx ON residences (status);

-- Multiple residents per residence is structurally free (renters, roommates, multi-unit
-- buildings all sharing one residence_id).
CREATE TABLE residents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id uuid NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  name         text NOT NULL,
  -- No "declined" state: a resident who doesn't want to be listed simply never registers.
  -- See notes/product-brief.md's Philosophy section for the reasoning and the parked
  -- "steward note" idea if an explicit decline signal ever turns out to be needed.
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'moved_out')),
  approved_by  uuid, -- REFERENCES stewards(id), added after stewards below to avoid a forward ref
  approved_at  timestamptz,
  -- Freeform, always block-wide, no per-field visibility choice — replaces the earlier idea of
  -- curated true/false flags (has_truck, has_generator, etc.) entirely.
  blurb        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz, -- set by the application write path (blurb is editable post-creation)
  CHECK (status != 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX residents_residence_id_idx ON residents (residence_id);

CREATE TABLE contact_methods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('phone', 'email')),
  value        text NOT NULL,
  verified_at  timestamptz, -- set once OTP succeeds
  -- Set alongside verified_at: the auth.users row Supabase Auth creates for the OTP session,
  -- so the application layer can resolve a session back to a resident (verified_resident_id()
  -- below is a read-side/RLS-backstop convenience — the application write path does the same
  -- resolution itself for every resident-scoped route).
  user_id      uuid REFERENCES auth.users(id),
  -- Default block_wide per the revised visibility philosophy (product-brief.md, 2026-08-06) —
  -- resident can narrow a specific contact method to steward_only if they want.
  visibility   text NOT NULL DEFAULT 'block_wide'
                 CHECK (visibility IN ('steward_only', 'block_wide')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz, -- set by the application write path (visibility is editable)
  CHECK ((verified_at IS NULL) = (user_id IS NULL))
);
CREATE INDEX contact_methods_resident_id_idx ON contact_methods (resident_id);
CREATE INDEX contact_methods_user_id_idx ON contact_methods (user_id);

CREATE TABLE stewards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id          uuid NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id), -- null until an invited steward accepts
  added_by          uuid REFERENCES stewards(id), -- null for founding steward(s)
  -- Feeds the ~6-month orphan-claim trigger (product-brief.md "Succession") — that subsystem
  -- itself is explicitly deferred (see minimal-schema-proposal.md), last_active_at just avoids
  -- a field that can't be backfilled later.
  status            text NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'active', 'inactive')),
  invited_email     text, -- holds the invite target before user_id exists
  invite_token      text, -- binds "invitee signs in" back to this specific row; cleared on accept
  invite_expires_at timestamptz,
  last_active_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, user_id)
);
CREATE INDEX stewards_block_id_idx ON stewards (block_id);
CREATE INDEX stewards_user_id_idx ON stewards (user_id);
-- Stops duplicate outstanding invites to the same address within a block.
CREATE UNIQUE INDEX stewards_block_invited_email_idx ON stewards (block_id, invited_email)
  WHERE status = 'invited';

ALTER TABLE residents ADD CONSTRAINT residents_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES stewards(id);

-- Supports the annual reconfirmation cycle with a real audit trail, not just the
-- residences.last_confirmed_at scalar. resident_id lets a self-confirm be attributed to a
-- specific resident at a multi-resident residence — whether one resident's confirm should
-- refresh the whole residence, or every resident needs to confirm individually, is still an
-- open product question (see minimal-schema-proposal.md); this column just makes the data
-- available to decide it later without a schema change.
CREATE TABLE confirmation_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id  uuid NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  resident_id   uuid REFERENCES residents(id),
  confirmed_by  uuid REFERENCES stewards(id), -- null = resident self-confirmed
  confirmed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmation_log_residence_id_idx ON confirmation_log (residence_id);

-- ── Data access ────────────────────────────────────────────
--
-- All reads and writes go through Next.js API routes calling shared application-layer
-- functions (createBlock, registerResident, approveResident, moveResidentOut,
-- confirmResidentPresence, etc.) — not direct client Supabase calls, and not database
-- triggers. Reason: lib/repository.ts's mock/json-file/supabase adapters are meant to behave
-- identically, and both a DB trigger and an RLS policy only exist for the real Postgres
-- instance — relying on either for correctness would mean mock/json-file (built specifically
-- for fast local dev without Supabase) silently behave differently. So cross-table invariants,
-- authorization, and even updated_at bookkeeping are the application's job, done once above
-- the adapter boundary, not Postgres's.
--
-- RLS below stays enabled as a defense-in-depth backstop only — cheap insurance if a bug ever
-- lets a raw client call slip through — the application never relies on it as the primary
-- enforcement. Full reasoning: notes/minimal-schema-proposal.md, "Data access" section.

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE stewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_active_steward_of(target_block_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM stewards
    WHERE block_id = target_block_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Resolves the calling session's auth.uid() to the resident_id it verified, via whichever
-- contact_methods row was used to sign in.
CREATE OR REPLACE FUNCTION verified_resident_id()
RETURNS uuid AS $$
  SELECT resident_id FROM contact_methods WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Resolves the calling session to the block_id of the residence it belongs to, for
-- "any verified resident of my own block" read policies below.
CREATE OR REPLACE FUNCTION verified_resident_block_id()
RETURNS uuid AS $$
  SELECT residences.block_id
  FROM residents
  JOIN residences ON residences.id = residents.residence_id
  WHERE residents.id = verified_resident_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "stewards_read_own_block" ON blocks
  FOR SELECT USING (is_active_steward_of(id));
CREATE POLICY "residents_read_own_block" ON blocks
  FOR SELECT USING (id = verified_resident_block_id());

CREATE POLICY "stewards_read_own_block_residences" ON residences
  FOR SELECT USING (is_active_steward_of(block_id));
CREATE POLICY "residents_read_own_block_residences" ON residences
  FOR SELECT USING (block_id = verified_resident_block_id());

CREATE POLICY "stewards_read_own_block_stewards" ON stewards
  FOR SELECT USING (is_active_steward_of(block_id));

CREATE POLICY "residents_read_own" ON residents
  FOR SELECT USING (id = verified_resident_id());
-- Peers only see approved residents — pending/moved_out stay private to the resident
-- themselves and to stewards.
CREATE POLICY "residents_read_block_peers" ON residents
  FOR SELECT USING (
    status = 'approved'
    AND residence_id IN (SELECT id FROM residences WHERE block_id = verified_resident_block_id())
  );
CREATE POLICY "stewards_read_own_block_residents" ON residents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residences
      WHERE residences.id = residents.residence_id
        AND is_active_steward_of(residences.block_id)
    )
  );

CREATE POLICY "contact_methods_read_own" ON contact_methods
  FOR SELECT USING (resident_id = verified_resident_id());
-- Peers only see block_wide contacts belonging to a currently-approved resident — defense in
-- depth alongside the application's visibility-cascade-on-moved_out logic, not a replacement
-- for it.
CREATE POLICY "contact_methods_read_block_peers" ON contact_methods
  FOR SELECT USING (
    visibility = 'block_wide'
    AND EXISTS (
      SELECT 1 FROM residents
      WHERE residents.id = contact_methods.resident_id
        AND residents.status = 'approved'
        AND residents.residence_id IN (
          SELECT id FROM residences WHERE block_id = verified_resident_block_id()
        )
    )
  );
CREATE POLICY "contact_methods_read_own_block_stewards" ON contact_methods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residents
      JOIN residences ON residences.id = residents.residence_id
      WHERE residents.id = contact_methods.resident_id
        AND is_active_steward_of(residences.block_id)
    )
  );

-- confirmation_log: no policies yet — reads go through the API route, same as writes.
