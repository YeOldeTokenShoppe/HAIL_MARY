# /hailmary Admin Cheat-Sheet

Personal how-to. Get in: **`/hailmary?mode=admin`** → password prompt (remembered in this browser via `oil_admin_pw`).

---

## New-season runbook (do these in order)

1. **RESET BOARD** (TEST TOOLS) — wipes plots, rigs, gushers, timeline, the FIELD DISPATCH polaroid feed (docs **and** their Storage blobs), community tank, **and the whole fairness state** (commitment + anchor + reveal + server seed). Banked scores (`totalCollected`) survive — that's the next step. Page drops to the "map does not exist yet" state — no countdown.
2. **ZERO SCORES** (TEST TOOLS) — erases every rig's banked `totalCollected` (plus drain bookkeeping). Kept separate from RESET BOARD on purpose: a mid-season glitch wipe must never destroy earned money. Skip only if scores should carry over.
3. **Phase → REGISTRATION** — PHASE buttons in the field sidebar (these keep `gameEnded` in sync) or PHASE OVERRIDE in the lobby.
4. **GRID SIZE** (PARAMETERS) — size it for expected demand **now**: frozen once the first plot is claimed, never resize after anchor.
5. **START DATE + SEASON LENGTH** (PARAMETERS, or lobby GAME START DATE / START NOW) — drives "SEASON STARTS IN" and the season clock / GAME DAY.
6. **COMMIT** (PROVABLE FAIRNESS console) — set lead ≈ seconds-until-start ÷ 2 (1d ≈ 43,200 · 3d ≈ 129,600 · 7d ≈ 302,400 blocks; empty = 30 ≈ 1 min, fine for testing). Starts the public anchor countdown. Claims are open while there's no anchor hash.
7. **During registration** — RUN QUALIFICATION SNAPSHOT (lobby) re-checks holders against their token floor; watch the waitlist count in the status banner.
8. **Season start** — once the anchor block mines: **ANCHOR** then **phase → ACTIVE**, promptly and together (anchor closes first-plot claims and enables strikes; the map is computable from the moment it's anchored).
9. **Season end** — strike-tick auto-flips to ended at the buzzer (auto-banks tanks, auto-reveals the seed). Manual fallback: the red **END GAME** button (sets `gameEnded` + phase ended together, triggers the reveal), then **REVEAL** in the console if it didn't auto-publish.

## Field sidebar panels

- **PHASE row** — REGISTRATION / ACTIVE / ENDED (+ BACK TO LOBBY during registration).
- **PARAMETERS** — DEPOSITS · HELL POCKETS · PRIZE POOL · GRID SIZE · HIT RATE · START DATE · SEASON LENGTH · GAME DAY (read-only — pace via start date/length).
- **TEST TOOLS**
  - VIEW AS PLAYER — hide seed data, see what players see.
  - SEED + REVEAL FIELD — 30 fake rigs + backfill reveals (needs a committed+anchored seed).
  - REMOVE TEST BOTS — clears `fake_*` docs only.
  - CLEAR DEMON — kills the active demon/blockade.
  - RESET BOARD — see runbook step 1; reminds you to COMMIT after.
  - ZERO SCORES — erases all banked `totalCollected` (confirm dialog; runbook step 2). The "VALUE ≈ $X" readouts convert banked oil at pot ÷ field ($500 ÷ 500,000 = $0.001/unit), so stale test scores show as real-looking money until you zero them.
  - CLAIM SELECTED — claim the selected survey-map cell (you, or `admin_test` if signed out).
  - FORCE STRIKE — selected rig (auto-claims if unowned) or all rigs if nothing selected; DEEP selector = layers per strike. Errors `no_seed` until COMMIT + ANCHOR.
  - BANK TANK — sweep the selected rig's tank to banked score.
  - Tester code: SET CODE / SHOW + **TESTING ON/OFF** — kill-switch; while OFF the code is inert. ON also exempts testers from registration locks. Turn OFF for live play.
- **DRILL DEMO** — PLAY/PAUSE/RESET a demo drill day; CAPTURE ON TEST = Test Gusher/Hell also pop the Polaroid (preview only, not fed).
- **💥 TEST GUSHER / 🔥 TEST HELL** — visual effects on the selected rig (local preview; Test Gusher fakes a full tank).
- **PROVABLE FAIRNESS (ADMIN)** — COMMIT (lead input shows wall-clock) → ANCHOR → REVEAL, plus state readout + verify. Also mounted in the lobby.
- **FIELD DISPATCH** — moderate pending Polaroids: APPROVE / REJECT per item, APPROVE ALL (reject deletes the blob).
- **GEOLOGICAL SURVEY** — as authed admin you see the live map. Never screen-share this view mid-season.

## Lobby ADMIN CONTROLS (registration phase)

Fairness console · RUN QUALIFICATION SNAPSHOT · GAME START DATE / START NOW · PHASE OVERRIDE.

## Gotchas

- `ticket_sale` is the stored value behind the **REGISTRATION** label.
- A leftover `anchorBlockHash` silently blocks all first-plot claims — RESET BOARD now clears it, but if claims ever 403 during registration, check this first.
- The **lobby** PHASE OVERRIDE sets only `gamePhase`; the **field sidebar** buttons also sync `gameEnded`. Leaving ENDED? Use the sidebar (or RESET BOARD, which clears `gameEnded` too).
- Order matters at start: ANCHOR + phase flip together — a long gap means the operator (you) knowably holds the map while claims are still open-looking.
- Changing DEPOSITS / HELL POCKETS / GRID SIZE re-rolls the local preview; the real map only comes from the committed seed.
