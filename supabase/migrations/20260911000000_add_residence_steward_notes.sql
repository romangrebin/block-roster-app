-- Steward-only scratch notes on a residence ("4 people live here inc. 1 vegan. dog named
-- Fido") — never shown to residents, not even an approved one of that exact residence. Plain
-- text, no constraint; visibility is enforced entirely at the application layer (same posture
-- as the rest of this schema — see notes/minimal-schema-proposal.md's "Data access" section),
-- not by RLS or a DB trigger.

ALTER TABLE residences ADD COLUMN steward_notes text;
