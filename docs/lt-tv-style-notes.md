# House notes

Standing corrections for whoever writes an episode — the model, on both shows.
Every rule under **Rules** below is added to the writer's instructions on every
future episode, so a fault you fix here you never have to fix again.

This is the difference between deleting a bad line and getting rid of it.
Deleting fixes one episode; a rule here means the next one is not written that
way in the first place.

## How to add one

Write one sentence as a bullet under **Rules**. Say what to do or not do, not
why — the writer does not need the history, and a short rule survives being one
of thirty.

Two ways to get a rule in here:

- Type it in yourself, below.
- Mark a line in the studio with `#!` instead of `#` when you ask for a
  rewrite. The rewrite fixes that line and the note lands here as a rule. See
  `docs/lt-tv.md`.

Only the bullets under **Rules** are sent to the writer. Everything else on
this page, including this sentence, is for you.

## Rules

## What does not belong here

Anything about one episode. "Cut the bit about the ETF" is a note on that
script, not a standing rule — make it in the screenplay and apply it.

Anything the code already enforces. Runtime windows, word targets, the
character budget per recording block and the list of valid reaction cues are
checked in `scripts/lt-tv-format.mjs` and reported as warnings, so a rule
repeating one of them only adds noise to the prompt.
