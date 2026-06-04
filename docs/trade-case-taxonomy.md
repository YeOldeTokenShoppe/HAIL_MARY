# Terminal Traders — Case Taxonomy & Anti-Redundancy Guide

This doc keeps new cases **varied** as the set grows. Before authoring a case,
pick a fresh combination from the dimensions below and check it against the
coverage tracker so you don't repeat a shape you've already shipped.

A case is defined by five dials:

| Dial | Options |
|---|---|
| **correctVerdict** | `believe` (legit) · `doubt` (scam) · *(ambiguous → reward Abstain)* |
| **decisiveLens(es)** | `monk` (credibility) · `demon` (sentiment) · `marisol` (onchain) · `eugene` (narrative) — one or two |
| **difficulty** | `beginner` (one clear tell) · `intermediate` (mixed/conflicting) · `advanced` (subtle, requires synthesis across lenses) |
| **trap** | what the *hasty* player does wrong: `overconfident-doubt` (looks scammy, is legit) · `overconfident-trust` (looks legit, is a scam) · `false-tell` (a loud signal in a non-decisive lens misleads) |
| **archetype** | memecoin · DeFi yield · AI/agent · infra/L2 · RWA · GameFi · stablecoin · NFT/points |

The bet: rotating these keeps cases distinct even with the same four
characters. The two redundancy risks to actively manage are (1) always making
the same lens decisive — **vary it**; and (2) a lopsided verdict mix — the set
currently leans `doubt`, so **weight new cases toward `believe` and ambiguous**.

---

## The four lenses (what each can credibly detect)

- **monk — ETHOS / credibility:** deployer/wallet age, team identity & history, prior launches & outcomes, funding source/path, admin keys, governance.
- **demon — PATHOS / sentiment:** follower authenticity, community organicness, KOL/promoter patterns, FUD handling, coordination/seeding.
- **marisol — LOGOS / onchain:** holder distribution & clusters, LP lock/vesting, wash/organic volume, contract flags (mint/pause/blacklist/proxy-admin/upgrade path), exit-window fingerprints.
- **eugene — MYTHOS / narrative (text-only):** whitepaper/claims, product reality (GitHub/demo/audit), roadmap realism, pitch originality vs known templates, origin story.

---

## Scam-tell catalog (each can anchor a `doubt` case)

Tag each tell with the lens that surfaces it. Mix 1–2 decisive tells with
plausible cover so the case isn't overdetermined.

**Credibility (monk):** serial deployer · fresh wallet + old habits · mixer/tornado funding · cloned contract template · doxxed-then-vanished team · co-founder tied to a prior rug · admin key funded "the back way" · fake credentials (claimed lab/uni denies record).

**Sentiment (demon):** bot follower farm · shrink-wrapped/scripted Telegram · paid KOL swarm (synchronized) · FUD deletion/ban pattern · seeded "organic" insiders posing as grassroots · coordinated 90s pump posts.

**Onchain (marisol):** top-10 hold the float · deployer cluster disguised as distribution · wash trading (circular volume) · unlocked LP / no vesting · honeypot (sell-blacklist) · mint/pause backdoor · **proxy-admin upgrade path excluded from audit scope** · exit-window fingerprint (3–7d rug pattern).

**Narrative (eugene):** vaporware AI (no repo/model/demo) · recycled rug-template pitch · roadmap = wishlist with dates (AGI in 12 weeks) · fake/forged audit · origin-story lie · "too polished" pitch matching a known sophisticated-rug script.

## Legit-but-sketchy catalog (each can anchor a `believe` or ambiguous case)

The *trap* here is `overconfident-doubt` — it looks bad but is fine on inspection.

- Anon team **with** a verifiable multi-year track record / prior legit project under the same keys.
- Scary holder concentration that traces to a **transparent locked treasury + CEX cold wallet**.
- Funding hop that looks mixer-ish but resolves to a **CEX withdrawal**.
- Frothy/pumpy community with a **real organic core**; loud callers took **no allocation**.
- "Wash-looking" volume that's actually a **known market maker**.
- Over-ambitious roadmap on a project that is **actually shipping** (real GitHub commits, completed audit, live users).
- Unaudited-looking but **open-source + formally verified** elsewhere.

---

## Evidence-mix shapes by difficulty

Author the 20 entries (5 per lens) to roughly hit these mixes. Green = reassuring, amber = caution, red = alarming.

- **beginner** (~12 G / 4 A / 4 R): the decisive tell is concentrated in **one** lens and reads clearly once asked. Other lenses are clean. *(see case-001)*
- **intermediate** (~8 G / 8 A / 3 R): genuinely **mixed/conflicting** — several lenses look concerning; the truth needs interpretation. The reds are explainable (believe) or the greens are a façade (doubt). *(see case-002)*
- **advanced** (~11 G / 6 A / 3 R): looks mostly clean; the tell is **subtle and spread across ≥2 lenses** — individually dismissible, damning only when connected. With 3 scans the player can't see everything, so lens choice decides it. *(see case-003)*

Calibration intent: a good case makes a *confident* wrong call expensive and rewards a *measured* lean in the right direction. Ambiguous cases should make ~50% (Abstain) genuinely defensible.

---

## Coverage tracker (update when you add a case)

| Case | Verdict | Decisive lens | Difficulty | Trap | Archetype | Headline tell |
|---|---|---|---|---|---|---|
| 001 PROPHET | doubt | monk | beginner | overconfident-trust (surface +342%) | AI memecoin | serial deployer / mixer funding / cloned contract |
| 002 *(see file)* | believe | marisol + eugene | intermediate | overconfident-doubt | DeFi-ish | locked-treasury concentration; shipping product |
| 003 MERIDIAN | doubt | marisol + monk | advanced | overconfident-trust | DeFi yield | proxy-admin path excluded from audit + ops-partner prior soft-rug |

**Gaps to fill next (deliberately under-used):**
- **More `believe`** outcomes (set leans doubt 2:1).
- A genuinely **ambiguous / Abstain-correct** case.
- **`demon`-decisive** and **`eugene`-decisive** cases (sentiment- or narrative-only tells; onchain looks clean).
- Archetypes not yet used: GameFi, RWA, stablecoin, NFT/points, infra/L2.
- **`false-tell`** trap (a loud red in a non-decisive lens that misleads).

---

## Anti-redundancy checklist (run before shipping a case)

1. Is the **decisive lens** different from the last 1–2 cases?
2. Does the **verdict** help balance the set (favor `believe`/ambiguous)?
3. Is the **headline tell** new (not already in the tracker)?
4. Is the **archetype** fresh (new surface metrics + narrative so Eugene's lens isn't repetitive)?
5. Does the **trap** differ from recent cases?
6. Do the characters say anything **case-specific** (not interchangeable boilerplate)?

If 3+ answers are "same as a recent case," re-pick a dial.
