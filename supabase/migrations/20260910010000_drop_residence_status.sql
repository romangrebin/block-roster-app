-- Drop residence lifecycle tracking.
--
-- `status` (unreached/current/vacant) was a *derived* label — redundant with "does this
-- residence have a registered resident," which the app shows directly (a resident is listed, or
-- isn't). Roman's call: someone choosing not to sign in isn't a gap to track. `last_confirmed_at`
-- fed a never-built annual reconfirmation cycle. Both are already removed from the application
-- layer (no more `residences.setStatus`, `ResidenceStatus`, or the coverage count); this drops
-- them from the schema too. Move-out is unaffected — it still flips the *resident's* status and
-- re-locks their contact visibility, it just no longer recolours the house.

ALTER TABLE residences DROP COLUMN status;            -- residences_status_idx drops with it
ALTER TABLE residences DROP COLUMN last_confirmed_at;
