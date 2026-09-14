-- Steward-togglable auto-approval of new joiners, off by default (approval stays the trust gate
-- unless a steward explicitly opts out of it). See notes/join-friction.md.

ALTER TABLE blocks ADD COLUMN auto_approve_joins boolean NOT NULL DEFAULT false;
