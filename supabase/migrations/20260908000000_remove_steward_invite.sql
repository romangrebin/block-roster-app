-- Removes the steward invite round-trip (invited_email/invite_token/invite_expires_at, the
-- 'invited' status) in favor of promoting an already-registered, approved resident directly to
-- steward — see promoteResidentToSteward in lib/application.ts. Decided 2026-09-08: a
-- co-steward candidate is someone already known and registered, not a cold email invite.
-- Nothing in the UI ever called invite()/acceptInvite(), and no 'invited' rows exist in
-- production (confirmed by direct query before writing this migration).

DROP INDEX IF EXISTS stewards_block_invited_email_idx;

ALTER TABLE stewards DROP COLUMN invited_email;
ALTER TABLE stewards DROP COLUMN invite_token;
ALTER TABLE stewards DROP COLUMN invite_expires_at;

-- Drop the old inline CHECK constraint by lookup rather than a hardcoded name, since Postgres
-- auto-generates it and the exact name was never recorded.
DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'stewards' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%status%';
  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE stewards DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE stewards ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE stewards ADD CONSTRAINT stewards_status_check CHECK (status IN ('active', 'inactive'));
