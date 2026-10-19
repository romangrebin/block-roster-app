-- Optional sign-up prompts that give neighbors a reason to browse each other's entries. All
-- nullable, all block-wide like blurb. A year, not a duration, so "here since" never goes stale.
alter table residents
  add column moved_in_year smallint check (moved_in_year between 1900 and 2100),
  add column favorite_spot text,
  add column count_me_in_for text,
  add column ask_me_about text;
