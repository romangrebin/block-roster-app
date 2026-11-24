-- Corkboard notes now remember which of the board's three columns they're in, so a note can be
-- moved to any column and stays there. `position` orders notes within their column.
-- See notes/corkboard.md.

ALTER TABLE corkboard_notes
  ADD COLUMN board_column smallint NOT NULL DEFAULT 0
  CONSTRAINT corkboard_note_board_column_range CHECK (board_column BETWEEN 0 AND 2);

-- Existing notes keep the spots they had when columns were dealt round-robin from the board
-- order: the 1st note to column 0, the 2nd to column 1, and so on, per community.
UPDATE corkboard_notes
SET board_column = dealt.board_column
FROM (
  SELECT corkboard_notes.id,
         (row_number() OVER (PARTITION BY residences.block_id ORDER BY corkboard_notes.position) - 1) % 3 AS board_column
  FROM corkboard_notes
  JOIN residents ON residents.id = corkboard_notes.resident_id
  JOIN residences ON residences.id = residents.residence_id
) AS dealt
WHERE corkboard_notes.id = dealt.id;
