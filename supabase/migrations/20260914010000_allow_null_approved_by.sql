-- Auto-approval (blocks.auto_approve_joins, previous migration) had been attributing approval to
-- an arbitrary active steward, since the original CHECK below required a real steward id. That
-- was a fiction — nobody actually clicked anything. Relax it to only require approved_at, so
-- verifyAndMaybeAutoApprove can leave approved_by NULL to mean "auto-approved, no steward
-- involved" instead. The approved_by -> stewards(id) FK is untouched and already allows NULL.
-- See notes/join-friction.md.

ALTER TABLE residents DROP CONSTRAINT residents_check;
ALTER TABLE residents ADD CONSTRAINT residents_check
  CHECK (status != 'approved' OR approved_at IS NOT NULL);
