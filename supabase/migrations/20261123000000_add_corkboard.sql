-- Corkboard: a steward-togglable board of short notes any approved resident can pin, like a
-- lobby corkboard. Neighbors who aren't the author can mark themselves "Interested" on a note
-- (a heart, on a photo).
-- See notes/corkboard.md.

ALTER TABLE blocks ADD COLUMN corkboard_enabled boolean NOT NULL DEFAULT false;

-- Like items, a note belongs to a resident, not a residence, and has no block_id of its own.
-- A note is either text or a photo, never both. image_path is the file's path in the private
-- corkboard-photos bucket below.
-- The board shows notes by ascending position, and anyone can rearrange it (which rewrites
-- positions as 0, 1, 2, …). The default puts a new note before everything already there.
CREATE TABLE corkboard_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  text        text,
  image_path  text,
  position    double precision NOT NULL DEFAULT -extract(epoch FROM now()),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  CONSTRAINT corkboard_note_is_text_or_photo CHECK ((text IS NULL) <> (image_path IS NULL))
);
CREATE INDEX corkboard_notes_resident_id_idx ON corkboard_notes (resident_id);

-- A neighbor's raised hand on a text note, shown as a heart on a photo note.
CREATE TABLE corkboard_interests (
  note_id     uuid NOT NULL REFERENCES corkboard_notes(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, resident_id)
);
CREATE INDEX corkboard_interests_resident_id_idx ON corkboard_interests (resident_id);

ALTER TABLE corkboard_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE corkboard_interests ENABLE ROW LEVEL SECURITY;

-- Same read policies as items: the author, approved peers in the same block, and the block's
-- stewards.
CREATE POLICY "corkboard_notes_read_own" ON corkboard_notes
  FOR SELECT USING (resident_id = verified_resident_id());
CREATE POLICY "corkboard_notes_read_block_peers" ON corkboard_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residents
      WHERE residents.id = corkboard_notes.resident_id
        AND residents.status = 'approved'
        AND residents.residence_id IN (
          SELECT id FROM residences WHERE block_id = verified_resident_block_id()
        )
    )
  );
CREATE POLICY "corkboard_notes_read_own_block_stewards" ON corkboard_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM residents
      JOIN residences ON residences.id = residents.residence_id
      WHERE residents.id = corkboard_notes.resident_id
        AND is_active_steward_of(residences.block_id)
    )
  );

-- Whoever can read a note can see who's interested in it (the subquery is itself filtered by
-- corkboard_notes' policies above).
CREATE POLICY "corkboard_interests_read_with_note" ON corkboard_interests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM corkboard_notes WHERE corkboard_notes.id = corkboard_interests.note_id)
  );

-- Private: with no storage policies, only the server's service-role client can read or write
-- it. Members see photos through short-lived signed URLs made at page render.
INSERT INTO storage.buckets (id, name, public)
VALUES ('corkboard-photos', 'corkboard-photos', false)
ON CONFLICT (id) DO NOTHING;
