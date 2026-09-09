-- Adds the "community code" and the two new content tiers to blocks.
--
-- code: a pseudo-secret slug for the public/private landing page at /<code>. Steward-editable
-- (vanity slug), defaults to a random unguessable string at block creation (lib/blockCode.ts).
-- Deliberately not exposed via any "list all blocks" endpoint — knowing the code is the only
-- way in, same trust model as the old /blocks/[id]/join link this replaces.
--
-- public_blurb: shown to anyone who knows the code, no sign-in required.
-- private_notes: shown only to a signed-in approved resident or active steward of this block —
-- see resolveApprovedResident/getResidentDirectory in lib/application.ts.

ALTER TABLE blocks ADD COLUMN code text;
ALTER TABLE blocks ADD COLUMN public_blurb text;
ALTER TABLE blocks ADD COLUMN private_notes text;

-- Backfill the rows that predate this column before enforcing NOT NULL/UNIQUE below.
UPDATE blocks SET code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) WHERE code IS NULL;

ALTER TABLE blocks ALTER COLUMN code SET NOT NULL;
ALTER TABLE blocks ADD CONSTRAINT blocks_code_format CHECK (code ~ '^[a-z0-9-]{3,32}$');
ALTER TABLE blocks ADD CONSTRAINT blocks_code_key UNIQUE (code);
