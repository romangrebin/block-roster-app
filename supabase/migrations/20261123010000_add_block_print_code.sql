-- print_code: the permanent key behind printed QR codes. A QR code encodes /c/<print_code>,
-- which redirects to the community page at /<code>. Stewards can rename `code`; print_code
-- never changes, so paper printed years ago still lands on the right page.
--
-- Same pseudo-secret trust model as `code`. Ten hex characters from gen_random_uuid() (a strong
-- random source) is ~1 trillion combinations, short enough to keep the QR code small. The
-- default is volatile, so Postgres computes a different value for every existing row.

ALTER TABLE blocks
  ADD COLUMN print_code text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

ALTER TABLE blocks ADD CONSTRAINT blocks_print_code_key UNIQUE (print_code);
