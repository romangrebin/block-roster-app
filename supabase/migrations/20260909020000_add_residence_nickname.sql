-- A resident-facing nickname for a residence, separate from its official address-based label
-- (e.g. "Yellow house on the corner" vs "4504 Longfellow Avenue"). Plain nullable text, same
-- unconstrained-by-design pattern as items.category — no format rules, just a friendlier name.
alter table residences add column nickname text;
