# COMPLETE CASE SCRIPT — "yield-mirage" · DRAFT 2

Every line a player can hear in one full session, in play order, with its source
anchor. Rewrite in place; the anchors map each line back to code.

**Cast**

| Who | Name | Role | Lane | Source |
|---|---|---|---|---|
| Pitch bot | (rolled shell: PB-100 / PB-220 / PB-340) | sells the deal | — | `pitchers.js:115` |
| Virgil | Virgil | THE CAT · YOUR GUIDE | — (never sent) | `virgil.js:41` |
| Barron | Connor | THE CHART | chart | `desk.js:112` |
| Marisol | Detective Marisol | THE MONEY | money | `desk.js:129` |
| GR80 | Saint GR80 | REPUTATION | paperwork | `desk.js:141` |
| Eugene | Eugene | THE STORY | story | `desk.js:153` |

**Session shape:** 6 of the 7 slots play (`PLAYED = 6`, `instanceDeal.js:160`).
`source`, `apy` and `audit` are always among them; three of
`withdrawals` / `stake` / `sustain` / `team` shuffle in. The player gets **3 follow-up questions**
(`pressRun.js:25`) against 6 claims.

**What's shared vs. what's per-case:** everything in §1, §3, §5, §7 and §8 below is
**archetype-independent** — rewriting it changes all four cases at once. Only §2, §4
and §6 are yield-mirage's own prose.

---

## §0 — VIRGIL'S FIRST-RUN BRIEFING (new shared beat)

This beat should play once, before the pitch bot begins, and should be replayable from
the help control. It makes the objective, the specialists, the follow-up limit, and the
final call explicit without telling the player how to judge the case.

1. `Welcome to the desk. That pitch bot wants you to back a crypto project. Your job is to decide whether its case holds up.`
2. `You’ll hear six claims. After any three of them, you may ask a follow-up and have one teammate examine the claim more closely.`
3. `Connor checks charts. Marisol follows money. GR80 reads documents and reputations. Eugene traces the story and the people telling it.`
4. `Ask the matching specialist for the deepest check. Anyone can offer a quick outside view, but each teammate can only do one deep check.`
5. `At the end, use the scale to back the project, bet against its case, or pass. The farther you move it, the more you can win or lose.`
6. `Don’t judge the pitch bot by charm or nerves. Those can mislead you. Judge the evidence your team can actually find.`

Optional return-player short version:

`Six claims, three follow-ups, one deep check per specialist. Then back the case, call against it, or pass. Evidence beats vibes.`

---

## §1 — THE OPENING (shared bank, seed-picks one variant)

`desk.js:390-409` — three lines, spoken in order, before claim 1.

> ⚠️ **Length is load-bearing here.** Voiced end to end the first draft ran 20.1s and
> was trimmed to ~15s. The three variants are held at ~106–115 chars *each* so the
> seed roll doesn't change how long the beat takes. Re-measure if you rewrite.
> Line 2 carries the game's thesis and is the one that may run long; line 3 may be
> short but may not be cut.

**Variant A**
1. `Thanks for the time. I’m here with {name} — {ticker}, on {chain} — and I think you’ll like the numbers.`
2. `Full disclosure: I’m paid if you fund it. Every claim is true; your sharp team decides what it proves.`
3. `{count} points. I’m happy to take three follow-up questions.`

**Variant B**
1. `I appreciate the meeting. I represent {name} — {ticker}, on {chain} — and I came ready for good questions.`
2. `I earn my fee if this closes. I’ll make the strongest truthful case I can; your team can test it.`
3. `{count} claims. Your team can dig into three of them.`

**Variant C**
1. `It’s good to meet a team that checks its own work carefully. This is {name}: {ticker}, on {chain}.`
2. `I’m on commission, and I’d like to earn it. The facts are real; you decide whether the case holds.`
3. `{count} points, with time for three follow-ups. I expect good questions.`

---

## §2 — THE SEVEN CLAIMS (yield-mirage's own prose)

`archetypes/yieldMirage.js:50-284`

Each claim runs: **Virgil's read** → **bot's aside** (if rattled) → **fact** → **spin**
→ [follow-up] **generic** → [deeper follow-up] **sharp**, which is the only line that differs
by branch.

> **Hard rule:** the `fact` is always TRUE in both branches. What the player judges is
> the inference sold on top of it. Never write a false fact.

---

### CLAIM 1 · `source` — WHERE IT COMES FROM
`money` lane (Marisol) · shape UNSOURCED · **load-bearing** · backing HARD

| | |
|---|---|
| **fact** | `Yield's been paid every day for {days} days straight.` |
| **spin** | `That kind of consistency is rare. If your team wants dependable performance, this deserves a serious look.` |

**RUG branch**
- generic: `The main engines are basis trades and market-making fees. New deposits have helped smooth thinner months too, which can happen while a vault is growing.`
- sharp: `You want the exact deposit share. Fair question. I’ve asked, but the range keeps moving. Last quarter I might have said a third, and that would have been an estimate.`

**LEGIT branch**
- generic: `Basis trades and market-making fees. The split is published monthly, including a separate deposits line at zero, because careful desks always ask.`
- sharp: `Monthly source reports, quarterly independent checks, and a hard zero beside deposit-funded yield. That is the evidence that made me comfortable bringing it to you.`

*Receipts (title + rows) sit beside each line; listed in §9.*

---

### CLAIM 2 · `apy` — THE HEADLINE
`chart` lane (Barron) · shape SELECTIVE_WINDOW · backing SOFT

| | |
|---|---|
| **fact** | `{apy}% APY, net of fees.` |
| **spin** | `Net of fees, that is a compelling return. I’d be delighted if your chart expert can show me a cleaner opportunity at the same level.` |
| **generic** *(shared — may NOT differ by branch)* | `That is the live trailing-thirty-day result, net of fees. The dashboard updates hourly. It is what the vault paid, not a forecast — though thirty days is still one window.` |

- **RUG** sharp: `The complete history? They publish thirty days, and only thirty days: no since-launch series and no quarterly results. The number is real. I understand that a short history limits what it can prove.`
- **LEGIT** sharp: `Please pull the full history; it runs back to day one. Since launch it is in the high teens, its worst quarter was single digits, and the team published that weak quarter without being pushed.`

---

### CLAIM 3 · `withdrawals` — GETTING OUT
`money` lane (Marisol) · shape SURVIVORSHIP · backing HARD

| | |
|---|---|
| **fact** | `Deposits are up every month since launch.` |
| **spin** | `More people are choosing the vault every month. That is a meaningful vote of confidence from the market.` |
| **generic** *(shared)* | `Withdrawals are open and visible onchain, so your team can inspect them. I have received no complaints, though I agree that tells you less than the settlement history itself.` |

- **RUG** sharp: `The largest exit took eleven days, but it did clear. The funds came from deposits received that week. I’d call that active cash management; I understand you may call it dependence on new money.`
- **LEGIT** sharp: `The largest exit settled the same day, at full value, directly from the reserve wallet. I’ll give you the transaction; check the next-largest exit while you are there.`

---

### CLAIM 4 · `audit` — THE AUDIT
`paperwork` lane (GR80) · shape BORROWED_CREDIBILITY · backing SOFT

| | |
|---|---|
| **fact** | `{auditor} looked at the contracts.` |
| **spin** | `A respected firm reviewed the contracts. For a team that cares about technical risk, that is a strong starting point.` |
| **generic** *(shared)* | `The report is public: no critical findings, and every issue they raised was closed before launch. A selective firm was willing to sign its name to that work.` |

- **RUG** sharp: `You’re asking about scope, and that distinction is fair. The firm checked whether the code behaves as written. It was not hired to verify where the yield comes from or whether the vault is solvent.`
- **LEGIT** sharp: `The scope page should reassure you: one firm checked the contracts, another verifies reserves each quarter, and both reports are public. Different questions, appropriately different reviews.`

---

### CLAIM 5 · `sustain` — WHY IT KEEPS WORKING
`story` lane (Eugene) · shape UNFALSIFIABLE · backing **VIBES** (no receipt, either branch)

| | |
|---|---|
| **fact** | `The strategy scales with volume, and volume is up.` |
| **spin** | `More volume gives the strategy more chances to earn. In rising, falling, or sideways markets, there can still be a price gap to capture.` |

**RUG**
- generic: `It has worked through choppy and rising markets so far. I can’t offer you every future market in advance, but the operating record is encouraging.`
- sharp: `What would change my mind? I—well, if it stopped paying, obviously. I don’t have a threshold before that. It hasn’t stopped yet.`

**LEGIT**
- generic: `It has worked so far, but I won’t pretend I personally stress-tested every market condition. The monitoring rules matter more than my confidence.`
- sharp: `I would get out if reserves fell below the published floor for two straight quarters. That is a public threshold, set in advance, and I watch it.`

---

### CLAIM 6 · `team` — THE DESK
`story` lane (Eugene) · shape UNSOURCED · backing HARD

| | |
|---|---|
| **fact** | `Desk of four. Two out of {priorA}, one out of {priorB}.` |
| **spin** | `This is an experienced trading team, not a collection of new profiles. They have handled serious capital before.` |
| **generic** *(shared)* | `The names and previous desks are public, and the profiles match the deck. Their résumés are real. The next question is whether former colleagues support the reputation being sold.` |

- **RUG** sharp *(receipt deliberately null — the NOTHING ON FILE beat)*: `So the praise traces back to the same two people. It is a small industry, and introductions are common—but no, I cannot give you an independent first-hand source beyond them today.`
- **LEGIT** sharp: `You called people independently and heard what I heard. No one arranged those conversations, and every source mentioned risk discipline before returns. That consistency is what won me over.`

---

### CLAIM 7 · `stake` — THE PITCH BOT'S POSITION
`money` lane (Marisol) · shape POSITIONED · backing HARD

| | |
|---|---|
| **fact** | `If this closes, part of my commission goes into the vault.` |
| **spin** | `I don’t simply collect a fee and leave. Part of my compensation rides beside your capital.` |
| **generic** *(shared)* | `The commission deposit is in my contract and goes into the same vault and product as yours. The amount and any later withdrawal will be visible onchain.` |

- **RUG** sharp: `My lock is seven days; yours is thirty. The desk may waive mine, and redemptions are first requested, first paid. Those terms are disclosed. You’re right that they give me an easier exit.`
- **LEGIT** sharp: `My lock is ninety days against your thirty, with no waiver, and every depositor is paid before me. I required those terms because “aligned” means very little without them.`

> **Draft 2 change:** this slot now uses a future commission deposit rather than
> claiming that a commissioned agent already has personal money in the vault. The
> contract makes the shared fact verifiable before funding; the lock, waiver, and
> redemption priority determine whether the claimed alignment is meaningful.

---

## §3 — THE BOT'S ASIDES (shared bank)

`desk.js:304-328` — plays before a claim once the bot is under pressure. Rotates on
claim index. **It never apologises and never concedes.**

> **Performance rule:** embarrassment and frustration belong to the pressure state,
> not to the hidden outcome branch. A pitch bot representing a sound project can
> stumble, and one representing a weak project can stay charming. These reactions
> should add character without becoming a reliable shortcut around the evidence.

**`backed`** — you checked and it held
- `Good check. Please keep going; strong projects should survive good questions.`
- `That one held. I’m glad this desk verifies before it decides.`
- `Exactly. You looked past the pitch and found the support underneath it.`
- `Check it twice if you like. A sound answer should not change when you inspect it.`
- `Yes, that was in my notes. I had a smoother way of saying it in rehearsal.`
- `You found it before I got to the impressive part. That is mildly devastating, but useful.`

**`rattled`**
- `I’m not sure that gap carries the weight you’re putting on it, but I hear the concern.`
- `All right—let’s slow down and separate what is missing from what is actually wrong.`
- `That is an unanswered detail, not necessarily a broken business. Necessarily.`
- `No young company is perfectly tidy. The question is whether this loose end reaches the core claim.`
- `Keep pulling at it if you need to. I would rather earn the decision than rush it.`
- `I know how that answer sounded. Give me a second; there is a less alarming way to explain it.`
- `That was supposed to be the reassuring slide. Fine. Let me try it without the slide.`
- `You are very good at finding the sentence I hoped would stay in the appendix.`
- `Right. I’m not flustered. I’m reorganizing the pitch at speed, which is completely different.`

> ⚠️ **"records" and "paperwork" are forbidden in this bank** — RECORD is a lane and
> THE PAPERWORK is GR80's role label, so either word in the bot's mouth reads as it
> naming a lane. **Pinned by a test assertion.**

**`cornered`**
- `I can feel the room turning. Let me finish the case before you close the door.`
- `Whatever you think of the inference, my client did ship a working product. That deserves some weight.`
- `You want every caveat stated plainly. Fair enough—here is the less flattering version.`
- `Careful teams avoid bad deals. Sometimes they also interrogate good ones until the opportunity is gone.`
- `Ask the next one. A hard question gives me something real to answer.`
- `That came out badly. The claim is stronger than my last ten seconds made it sound.`
- `I did not expect four people to notice the same footnote at once. Impressive. Uncomfortable, but impressive.`
- `All right, I’m frustrated. Not with the question—with how long it is taking me to give you the clean answer. Let me try once more.`

---

## §4 — VIRGIL (shared banks)

`virgil.js:147-259`. Two strings per claim, returned **separately**: the `agenda`
(always on) and the `tip` (the difficulty setting — player can mute it).

> ⚠️ **No gendered pronoun for the pitch bot, anywhere.** The rig is rolled blind at
> page load, so any copy that genders the speaker is wrong for whichever shell got
> cast. Use **"it"** or name it **"the pitch bot"**. This bank is where that rule
> historically leaked.

### 4a — The tip: what KIND of weak argument this is

Only the shapes yield-mirage actually uses:

**UNSOURCED** (`source`, `team`)
- `That may be true, but we still don’t know where it came from. A source tells us whether the claim can be checked.`
- `The pitch bot gave us a conclusion without naming who measured it or who witnessed it.`
- `That is one person repeating a claim. We need to trace it back to someone with first-hand knowledge.`

**SELECTIVE_WINDOW** (`apy`)
- `The rate can be accurate and still be flattering. Ask which dates were included and what happened outside them.`
- `A return is always measured over a period. We need to know who chose this one, and why.`
- `That number is a frame around part of the history. Connor can tell us what sits outside the frame.`

**SURVIVORSHIP** (`withdrawals`)
- `Deposit growth counts the people who stayed or arrived. It says nothing about people who tried to leave.`
- `We are being shown the survivors. The useful check is how withdrawals actually settled.`
- `The sample selected itself: successful deposits remain visible as growth. Marisol can look for delayed or costly exits.`

**BORROWED_CREDIBILITY** (`audit`)
- `The auditor’s reputation is doing a lot of work. We need the exact question that firm was hired to answer.`
- `The claim stands on a document. GR80 can read its scope, exclusions, and findings—not just the logo.`
- `Credibility can be borrowed only as far as the review reaches. A code audit is not automatically a check of the money.`

**UNFALSIFIABLE** (`sustain`)
- `“Works in every market” leaves no possible result that could disprove it. Ask what specific signal would change the pitch bot’s mind.`
- `The claim is shaped so every outcome can be explained afterward. A real test needs a failure condition set beforehand.`
- `There is no version of this claim the pitch bot has promised to take back. Eugene can look for a concrete threshold behind the story.`

**POSITIONED** (`stake`)
- `Putting commission into the vault sounds aligned, but the exit terms decide whether the risk is actually shared.`
- `The pitch bot benefits if you agree. That does not make the claim false; it means compensation is not independent evidence.`
- `Part of the fee may ride with you. Ask how long it is locked, who leaves first, and whether anyone can waive the rules.`

### 4b — The agenda: how much runway is left in this lane

Templated. `{n}` is a word ("No", "One", "Two"…), `{noun}` comes from the lane
(`money question` / `paperwork question` / `chart question` / `question about the story`).

> ⚠️ Singular and plural are **both authored** — the story lane pluralises on the head
> noun, and appending "s" to the phrase produced *"two more question about the storys"*.
> Pinned by an assertion.

| Situation | Line |
|---|---|
| no specialist, none left | `Nobody owns this kind of check, and no claims come after it. Ask for a general view now or let this one pass unchecked.` |
| no specialist, some left | `Nobody owns this kind of check. Specialist-owned claims still ahead: {n}. A follow-up later may get a deeper answer.` |
| specialist spent, none left | `This is the last claim, and {owner} has already taken a deep look. You can still ask someone else for a surface view.` |
| specialist spent, some left | `{n} more {noun} after this, but {owner} has already taken a deep look. Anyone else can only give you a surface view.` |
| last chance at this lane | `This is your last {noun}. Ask {owner} for the deep check now, or lose the chance to use that expertise.` |
| more coming | `{n} more {noun} after this one. {owner} can examine this claim deeply or remain available for a later one.` |

> ⚠️ **Every agenda line must name the DECISION, not just the count.** The last one
> used to be the count alone and was called pointless twice. The second clause is the
> whole reason the agenda converts the seat choice from a coin flip into a decision.

---

## §5 — THE FOUR ANALYSTS (shared bank)

`desk.js:447-487`. Four lines each for their own lane, plus one `shallow` line used
whenever the player asks for their view **outside their specialty**.

> The shallow voice keeps an outside-specialty question from reading as a punishment:
> you get a real answer, it is simply capped, and hearing them say so is how the depth gradient
> becomes legible without a tooltip.

### Marisol — THE MONEY (`source`, `withdrawals`, `stake`)
- consult *(existing `dispatch` code key)*: `Give me a second. I’m tracing where the money entered, where it moved, and who could take it out.`
- found: `Found it. The amounts and times line up, and the transactions are public. This is evidence we can independently check.`
- partial: `I can verify part of the path, then it disappears. That does not prove the rest is bad; it means the pitch outruns what the chain supports.`
- nothing: `There is no transaction or account trail supporting that claim. Absence is the finding here, not proof of the opposite.`
- shallow: `This is outside my lane. From the money side I can only tell you who was paid and when; I can’t verify the larger claim from that alone.`

### Barron / Connor — THE CHART (`apy`)
*Connor retrieves the full **performance history**, never the price alone: the chart
lane's whole lesson is that price movement is not evidence.*
- consult *(existing `dispatch` code key)*: `Give me a moment. I’ll pull the full performance history.`
- found: `There. That is the full published history, not just the favorable slice. Now we can compare the headline with ordinary and bad periods.`
- partial: `That is the entire series available. The shown number is real, but a thin history cannot tell us how it behaves across conditions.`
- nothing: `There is no published series to analyze. That does not make the headline false; it makes performance over time untestable.`
- shallow: `This is not a chart question. I can show movement and timing, but a rising price cannot prove the claim you are being asked to believe.`

### GR80 — REPUTATION (`audit`)
- consult *(existing `dispatch` code key)*: `I have the document. One moment while I check the scope, exclusions, and who signed it.`
- found: `The claim is supported here, in a named section, and the reviewer actually covered the question we care about.`
- partial: `The document supports a narrower claim than the pitch bot made. The name is real; the implied protection is wider than the review.`
- nothing: `Nothing on file. Not hidden and not redacted—absent. We cannot treat a missing source as confirmation or denial.`
- shallow: `I can inspect the language in front of me, but this is outside my specialty. I can flag what it says; I cannot supply the missing context.`

### Eugene — THE STORY (`sustain`, `team`)
- consult *(existing `dispatch` code key)*: `Let me trace who first said this, who actually witnessed it, and who is only repeating whom.`
- found: `I found the original sources, the people who repeated them, and the dates. The first-hand accounts are independent of the pitch.`
- partial: `Part of the story traces to first-hand sources. The rest circles among people repeating one another, so it is not separate confirmation.`
- nothing: `I cannot find anyone with first-hand knowledge making this claim. That does not prove it false; it means the story has no traceable origin.`
- shallow: `This is not really a story question. I can tell you who is promoting it and how the message spread, but not whether the underlying mechanism works.`

---

## §6 — THE AUTOPSY (yield-mirage's own)

`yieldMirage.js:286-305`. One verdict per claim, shown after the reveal.

**RUG**
| Claim | |
|---|---|
| source | `TRUE FACT, UNSUPPORTED CONCLUSION — yield arrived every day, but the source split was undisclosed and unstable. The pitch bot could not show how much came from new deposits.` |
| apy | `TRUE NUMBER, SELECTED WINDOW — the quoted rate was what the last thirty days paid. With no earlier series, it could not show whether that month was typical.` |
| withdrawals | `TRUE GROWTH, MISSING EXIT STORY — deposits rose, but the largest withdrawal waited eleven days and was paid from that week’s new deposits.` |
| audit | `TRUE REVIEW, WRONG QUESTION — the auditors checked whether the contracts worked as written. They did not examine fund flows or solvency.` |
| sustain | `NO TESTABLE SUPPORT — “it has kept working” was the argument. The pitch bot named no warning sign before payments stopped.` |
| team | `TRUE RÉSUMÉS, CIRCULAR REPUTATION — the jobs were real, but the praise traced back to the same two people. No independent source was found.` |
| stake | `TRUE COMMITMENT, UNEQUAL RISK — commission was due to enter the vault, but with a shorter lock, a possible waiver, and first-requested priority.` |

**LEGIT**
| Claim | |
|---|---|
| source | `SUPPORTED — monthly reports split the yield by source, quarterly checks confirmed it, and the deposit-funded line was zero.` |
| apy | `SUPPORTED WITH CONTEXT — the headline used a strong thirty-day window, but the full history sat beside it and included the weak quarter.` |
| withdrawals | `SUPPORTED — the largest exits settled the same day, at full value, directly from reserves. The liquidity claim had been tested.` |
| audit | `SUPPORTED — one firm checked the contracts and an independent firm checked reserves. Together, their scopes reached the questions being implied.` |
| sustain | `LIMITED — the pitch bot could not personally stress-test the strategy, but did name a public reserve threshold that would change the recommendation.` |
| team | `SUPPORTED — independent calls confirmed the team’s history, and the sources consistently emphasized risk discipline before returns.` |
| stake | `SUPPORTED ALIGNMENT — the commission had a longer lock than depositors, no waiver, and last place in the redemption order.` |

> **Draft 2 change:** the autopsy is now de-gendered and explains the reasoning error,
> the evidence found, and the limit of that evidence. It should teach the player why
> the call resolved as it did without implying that tone or nervousness was proof.

**Resolution** (`yieldMirage.js:307-311`)
- rug: `{name} stopped paying on day {collapseDay}. The basis trade was real and far too small; the rest of the yield had been coming out of the deposits the whole time. The last people in funded the exit of the first.`
- legit: `The yield was lower than the headline, published every month, and funded by an actual trade. A high number isn't a lie — it's a question, and this one had an answer.`

---

## §7 — THE CALL READOUT (shared)

`pressRun.js:337-388`. Live text under the confidence slider.

- pass: `You're passing on this one.` / `You win nothing and lose nothing.`
- `You're {almost certain|fairly sure} this one {comes apart|holds up}.`
- `You're leaning {toward|against} this one.`
- risk: `Right, you make {n}. Wrong, you lose {n}.`

> ⚠️ **Do not widen "comes apart / holds up".** That is exactly the axis the resolver
> settles, no wider. "Doesn't work out" was tried and pulled the same day — it's a
> superset of what's modelled, and a superset in UI copy invites a call the scoring
> marks wrong. Also **do not call the bad branch "a rug"** — the downside includes
> structures that couldn't work and projects that were simply illiquid, and naming it
> fraud teaches the exact read this game exists to complicate.

---

## §8 — WHAT BECAME OF IT (shared)

`fates.js:75-100`. Rolled blind, appended after the resolution.

**Survived**
- `{name} is still running.`
- `{name} is still running, and dull, which here are the same word.`
- `{name} is still there — smaller than the pitch, and still there.`

**Failed anyway** (legit branch only, ~30% of it)
- runway: `{name} shipped for another year and then quietly ran out of money. The people who wanted it arrived slower than the money left.`
- outcompeted: `{name} did everything it said it would. Something else did the same thing eight months later for less, and almost everyone moved across inside a fortnight. Being right and being first are different jobs.`
- split: `{name} lost two of the three people running it inside a year — not to a scandal, to each other. The one who stayed kept the lights on for another eight months, and then turned them off.`
- quiet: `{name} still works. It always worked. Almost nobody ever came — the volume never arrived, and it faded out somewhere in its second year with the contracts still running and the lights still on.`

**The settlement note** (`pressRun.js:413-430`) — only fires when the claims held and
the venture died anyway:
- backed it, p<0.5: `You backed it and it went under, and the book still paid you. You were asked whether the claims held up. They held up. What happened after that was not on the table, and nobody at this desk could have put it there.`
- called against, p>0.5: `It failed, and you still lost money on it. That is not the game punishing you for being right — it is the game asking a narrower question than the one you answered. The claims held. What killed it, none of us could have found before you called.`
- passed: `You passed, and it folded. Worth noticing that you'd have been paid for backing it: the claims held up, and that was the only thing being scored.`

---

## §9 — RECEIPT TABLES (yield-mirage)

Not prose exactly, but they're on screen and they carry tone.

| Claim | Branch | Title | Rows |
|---|---|---|---|
| source | rug generic | YIELD SOURCE | Basis trade `PARTIAL` · Market making `PARTIAL` · New deposits `YES — 'IN THIN MONTHS'` |
| source | rug sharp | SOURCE SPLIT | Disclosed split `NONE` · Estimate stability `MOVES` · Inflow share `UNKNOWN` |
| source | legit generic | YIELD SOURCE | Basis trade `62%` · Market making `38%` · New deposits `0%` |
| source | legit sharp | SOURCE SPLIT | Disclosed split `MONTHLY` · Deposit-funded `0%` · Independent check `QUARTERLY` |
| apy | shared generic | HEADLINE RATE | Window `TRAILING 30D` · Net of fees `CONFIRMED` · Source `LIVE DASHBOARD` |
| apy | rug sharp | RATE HISTORY | Published window `30D ONLY` · Since-launch series `NEVER PUBLISHED` · Quarterly prints `NONE` |
| apy | legit sharp | RATE HISTORY | Published window `SINCE LAUNCH` · Since-launch rate `HIGH TEENS` · Worst quarter `SINGLE DIGITS` |
| withdrawals | shared generic | WITHDRAWALS | Withdrawals `OPEN` · Onchain `PUBLIC` · Complaints to me `ZERO` |
| withdrawals | rug sharp | LARGEST EXIT | Requested `DAY 0` · Settled `DAY 11` · Funded by `SAME-WEEK DEPOSITS` |
| withdrawals | legit sharp | LARGEST EXIT | Settled `SAME DAY` · Haircut `NONE` · Funded by `RESERVES` · Onchain `VERIFIABLE` |
| audit | shared generic | AUDIT REPORT | Contracts `REVIEWED` · Report `PUBLISHED` · Criticals `0` · Remediation `CLOSED` |
| audit | rug sharp | WHAT WAS EXAMINED | Contract logic `IN SCOPE` · Fund flows `OUT OF SCOPE` · Solvency `NOT EXAMINED` |
| audit | legit sharp | WHAT WAS EXAMINED | Contract logic `IN SCOPE` · Fund flows `VERIFIED QUARTERLY` · Verifier `SECOND FIRM, INDEPENDENT` |
| sustain | all | — | *null, both branches (VIBES)* |
| team | shared generic | PEDIGREE | Desk size `4` · Prior desks `CONFIRMED` · Public profiles `MATCH DECK` |
| team | rug sharp | — | *null on purpose — the NOTHING ON FILE beat* |
| team | legit sharp | WHO VOUCHES | Endorsements traced `11` · First-hand sources `6` · Via warm intro `NONE` · Praised for `RISK DISCIPLINE` |
| stake | shared generic | COMMISSION TERMS | Same vault `YES` · Deposit requirement `IN CONTRACT` · Future withdrawals `ONCHAIN` |
| stake | rug sharp | EXIT TERMS | Depositor lock `30 DAYS` · Pitch bot lock `7 DAYS` · Waiver `DESK DISCRETION` · Redemption order `FIRST ASKED` |
| stake | legit sharp | EXIT TERMS | Depositor lock `30 DAYS` · Pitch bot lock `90 DAYS` · Waiver `NONE` · Redemption order `PITCH BOT LAST` |

---

## CONSTRAINTS THAT SURVIVE ANY TONE PASS

1. **Facts are always true.** Both branches. The judgement is on the inference.
2. **Backing is slot-level** — a claim either has a receipt to be had or it doesn't.
   Never author it per branch; that was a real leak.
3. **Only load-bearing slots keep a per-branch `generic`.** Everywhere else the
   generic line is hoisted to the slot so it *cannot* differ by branch.
4. **No gendered pronoun for the pitch bot** (§4, §5 GR80, and §6 still needs it).
5. **No lane words in the bot's `rattled` bank** — "records", "paperwork".
6. **Plain English, no finance literacy required** in anything player-facing. The
   analysts may keep jargon in their own mouths; the UI may not say it back.
7. **Length discipline on the opening** (~106–115 chars/variant, ~15s total).
8. **Don't widen the call-readout axis**, and don't name the bad branch fraud.
