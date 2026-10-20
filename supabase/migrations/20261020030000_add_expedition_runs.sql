-- Completed runs of the Bodie demo's Expedition game (lib/expedition.ts), listed as "Past
-- expeditions" in its tab. failures is computed server-side from party and items.
CREATE TABLE expedition_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  party       text[] NOT NULL,
  items       text[] NOT NULL,
  failures    smallint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expedition_runs_resident_id_idx ON expedition_runs (resident_id);

ALTER TABLE expedition_runs ENABLE ROW LEVEL SECURITY;
