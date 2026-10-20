# Durable Philosophies

Loaded into every session automatically via `CLAUDE.md` — not something Claude has to remember
to go read. Keep this file short; if it needs sections and subsections, it's stopped being a
philosophy and become a spec, which belongs in `notes/` instead.

- Simplest, most intuitive UX flow possible — minimize clicks.
- Smallest reasonable amount of code — keep it simple, add complexity only when a feature
  actually needs it.
- Self-documenting code — clear naming and small, focused functions carry the meaning.
  Comments describe the code as it is now, with at most a brief *why* when the code would
  otherwise look wrong or surprising — never restating *what* the next line already says, and
  never history (what changed, what it used to do); that belongs in git. Roman is an experienced
  programmer but new to JS/TS — code should read clearly on its own, not lean on prose to
  explain itself.
