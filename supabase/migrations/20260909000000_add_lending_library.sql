-- Lending Library — a steward-togglable optional feature (item name, description, category, all
-- belonging to a resident, not a residence — a person's stuff, not their address). See
-- notes/lending-library.md for the product decisions behind this shape.

ALTER TABLE blocks ADD COLUMN lending_library_enabled boolean NOT NULL DEFAULT false;

-- category is a plain string, deliberately with no CHECK constraint (unlike canvas_type/status/
-- visibility elsewhere in this schema, which are real fixed enums load-bearing for app logic).
-- Roman: "I *REALLY* don't want extra, unused categories" but also wants adding a new one to be
-- cheap — the fixed starter set (tool/book/game/other) lives in lib/types.ts's ITEM_CATEGORIES
-- and is enforced by the UI offering only those options, not by the database. Changing the set
-- later is a one-line code change, not a migration.
CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'other',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);
CREATE INDEX items_resident_id_idx ON items (resident_id);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Mirrors residents'/contact_methods' read policies: the owner always sees their own; approved
-- peers in the same block see everyone's (items are meant to be browsed, unlike contact info,
-- so there's no block_wide/steward_only visibility split here); stewards see everything in
-- their own block.
CREATE POLICY "items_read_own" ON items
  FOR SELECT USING (resident_id = verified_resident_id());
CREATE POLICY "items_read_block_peers" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residents
      WHERE residents.id = items.resident_id
        AND residents.status = 'approved'
        AND residents.residence_id IN (
          SELECT id FROM residences WHERE block_id = verified_resident_block_id()
        )
    )
  );
CREATE POLICY "items_read_own_block_stewards" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residents
      JOIN residences ON residences.id = residents.residence_id
      WHERE residents.id = items.resident_id
        AND is_active_steward_of(residences.block_id)
    )
  );
