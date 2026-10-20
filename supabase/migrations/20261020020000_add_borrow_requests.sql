-- "Ask to borrow" on Lending Library items, off by default. When on, a resident can request a
-- neighbor's item; the owner is emailed if they have an email on file (see requestToBorrow in
-- lib/application.ts). One row per item per requester; a repeat request refreshes requested_at.

ALTER TABLE blocks ADD COLUMN borrow_requests_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE borrow_requests (
  item_id      uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, requester_id)
);
CREATE INDEX borrow_requests_requester_id_idx ON borrow_requests (requester_id);

ALTER TABLE borrow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "borrow_requests_read_own" ON borrow_requests
  FOR SELECT USING (requester_id = verified_resident_id());
