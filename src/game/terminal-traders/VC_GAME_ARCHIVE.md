# VC_GAME — ARCHIVE

*Post-mortems and superseded reasoning lifted out of [VC_GAME.md](./VC_GAME.md)
so that file can go back to describing the game as it is rather than how it got
here. Nothing in this file is current design. It is kept because the REASONS
are load-bearing — several of these mistakes are the kind that get made twice,
and a rule with its argument attached survives contact with a future rewrite in
a way a bare assertion does not.*

*Rules that came out of these episodes and are still in force live in VC_GAME.md
§4 under "Authoring rules". If the two ever disagree, VC_GAME.md wins.*

---

## 8. The acceptance test — failed, then fixed

**2026-07-28. The test the whole redesign rests on, run for the first time, and
it failed.** Measured across both archetypes: on **14 of 14 slots** the
`generic` block and the `sharp` block discriminated *identically* between the
rug and legit branches. Sending a specialist told you exactly as much about
which branch you were in as pressing the seller — more detail, better drama, no
better verdict. And because Barron is unlimited and lane-free while the
specialists are one-use and lane-locked, **three presses on him weakly dominated
the entire four-seat desk.**

**The cause was one field in the wrong place.** `backing` was authored PER
BRANCH — `VIBES` when rug, `HARD` when legit — and `resolvePress` zeroes every
receipt on VIBES. So the rug branch returned nothing to *anyone*, specialist
included: the whole signal lived one level above where depth could reach it.
Rewriting the receipts alone would not have touched it.

**The fix, and why it also improves the fiction.** `backing` and `generic` are
both hoisted to the SLOT. A claim either has a receipt to be had or it doesn't —
that's a property of the claim, not of whether the deal is rotten — and the
seller's shallow answer is now one shared script that *cannot* differ by branch,
because there is only one copy of it. He is confident, technically true, and
stops exactly short of the question that settles it, which is what selling is.
Previously he handed you the evidence against his own deal.

Measured after (500 seeds/archetype):

| | seller can settle | specialists can settle | route A lands | route B lands |
|---|---|---|---|---|
| backdoor-fork | 4.22 → **1.00** | 4.22 | 3.00 → **1.00** | **2.22** |
| yield-mirage | 5.28 → **2.00** | 5.28 | 3.00 → **2.00** | **2.28** |

Harness: `scratchpad/acceptance.mjs`, a session-scoped scratch file that is
**gone** — reconstruct it from the five assertions below if the measurement is
ever wanted again. Those five now pin the result permanently in
`verify-press-run.mjs` —
backing is never per-branch; no non-loadBearing slot lets the seller give away
the branch; the loadBearing claim IS still free (invariant 1); specialists must
settle *strictly more* than the seller; and at least one claim must let a
specialist prove a negative.

**One regression the fix caused, and the assertion that caused it.** Replacing
every null rug receipt with a documented-absence receipt killed `NOTHING ON
FILE` outright — it fired nowhere in backdoor-fork and in *both* branches of
yield-mirage, carrying no information. My own assertion ("every non-VIBES slot
returns a real deep receipt in BOTH branches") had forbidden the very pattern
that produces it. A null **sharp** receipt in one branch only is legitimate and
discriminating, because `generic` still supplies the shallow answer. Restored on
`ops` and `team`, where the absence *is* the finding, and the assertion now
requires it rather than banning it.

**Three content contradictions caught by adversarial verification**, all in
fields the authoring pass had been told not to touch: `stake`'s floor FACT
("same terms as you'd get") pre-answered the question the deep look exists to
settle; `apy`'s rug finding was arithmetically incompatible with the shared
generic pinning a realised trailing-30 rate; and `withdrawals`' rug answer key
described a test nobody had run, which the specialist can now run.

**`miss` blocks are now fully dead** — `instanceDeal` no longer assembles them
and `resolvePress` never read them. Delete on sight.

