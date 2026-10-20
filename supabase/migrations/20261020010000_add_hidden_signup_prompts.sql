-- Steward-chosen sign-up questions. Stores the prompts a community *hides* at sign-up (keys like
-- 'movedInYear', 'blurb'), so the empty default keeps every existing community unchanged. Only
-- affects which prompts a resident is asked; anything a resident already filled in still shows.
-- Unconstrained text[] for the same reason items.category is unconstrained text: the valid keys
-- live in code (SIGNUP_PROMPT_KEYS in lib/validation.ts).
alter table blocks add column hidden_signup_prompts text[] not null default '{}';
