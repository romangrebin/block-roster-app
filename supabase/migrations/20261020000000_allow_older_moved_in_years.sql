-- The Bodie demo community's seeded residents moved in around 1879. The app's own year
-- dropdown and validation still start at 1940 (EARLIEST_MOVED_IN_YEAR); only the database floor
-- is lowered, since the demo seed script writes these rows directly.
alter table residents drop constraint residents_moved_in_year_check;
alter table residents
  add constraint residents_moved_in_year_check check (moved_in_year between 1850 and 2100);
