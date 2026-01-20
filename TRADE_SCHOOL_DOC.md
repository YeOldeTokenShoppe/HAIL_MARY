Trade School

How the RL80 trading system thinks

Welcome to Trade School.

This page explains how the RL80 trading system works, what you’re seeing on the trading dashboard, and—most importantly—how decisions are made. The system is built and operated in public so that trading decisions can be observed, questioned, and learned from.

Trade School is not about predicting markets.
It’s about understanding process, discipline, and uncertainty.

⸻

TL;DR

Trade School is a transparent, multi-agent AI trading experiment.

Three specialist agents analyze the market from different perspectives—
macro conditions, market sentiment, and technical price action—
and report to an executive agent (RL80) that decides whether a trade is justified.

The system:
	•	collects market, sentiment, and macro data continuously
	•	evaluates conditions on a scheduled cadence (currently hourly)
	•	applies confidence thresholds and strict risk limits
	•	may execute a trade only when conditions align
	•	logs every decision and outcome for review

Most of the time, the system does nothing—by design.

⸻

Important disclaimer

This project is for education, research, and entertainment only. Nothing here is financial advice or a recommendation to trade. Perpetual futures are high-risk instruments and can result in rapid losses.

Unless explicitly stated otherwise, all trading occurs on Lighter DEX testnet.

⸻

The core idea: a small investment committee

Instead of a single model attempting to do everything, the system is structured like a mini investment committee:
	•	MACRO looks at the big picture
	•	EMO listens to the crowd
	•	TEKNO studies price behavior
	•	RL80 makes the final call

Each agent has a clear role and a different natural time horizon.

⸻

The agents and their roles

🧭 MACRO — the regime reader

Model: Claude (Anthropic)

MACRO focuses on the environment markets are operating in:
	•	volatility
	•	rates
	•	dollar strength
	•	broader risk appetite

Its job is not to time trades, but to answer:
“Is this a market where risk even makes sense?”

Macro conclusions tend to matter for days or weeks.

⸻

🌊 EMO — the sentiment reader

Model: Grok (xAI)

EMO tracks crowd psychology:
	•	fear vs greed
	•	attention shifts
	•	narrative momentum
	•	social and prediction-market signals

Sentiment often changes faster than fundamentals and is most useful for understanding volatility and pressure, not precise direction.

⸻

📐 TEKNO — the chart reader

Model: OpenAI (GPT-4-class)

TEKNO analyzes:
	•	price structure
	•	indicators (RSI, MACD, Bollinger Bands)
	•	support and resistance
	•	short-term setups

It doesn’t care why price is moving—only how and where.

⸻

🎛 RL80 — the executive

Model: Claude (Anthropic)

RL80 aggregates all specialist inputs and decides whether to act.

Its responsibilities include:
	•	weighing conflicting opinions
	•	applying confidence thresholds
	•	enforcing risk limits
	•	deciding to trade—or not trade
	•	explaining the decision clearly afterward

RL80 does not blindly follow any single agent.

⸻

Why multiple models?

Different AI models excel at different kinds of reasoning—and fail in different ways.

By mixing models and forcing them to disagree:
	•	blind spots are reduced
	•	overconfidence is exposed
	•	decisions become more interpretable

Disagreement is a feature, not a bug.

⸻

Timing, cadence, and freshness of signals

Not all information ages at the same speed.

A chart pattern can be stale in minutes.
A macro regime can matter for weeks.

The system is designed around that reality.

⸻

Continuous data collection

A background service continuously updates raw inputs:
	•	prices and candles
	•	technical indicators
	•	sentiment feeds
	•	macro context

Agents always analyze the latest snapshot, not yesterday’s news.

⸻

Scheduled analysis (“the meeting”)

Rather than reacting to every tick, the system holds a structured review:
	•	Frequency: once per hour
	•	Sequence: EMO → TEKNO → MACRO → RL80
	•	Duration: a few minutes end-to-end

Think of it as a trading desk check-in.

⸻

Different clocks, different weights

Even though agents run together, they think on different horizons:
	•	MACRO: weeks → months
	•	EMO: hours → days
	•	TEKNO: minutes → hours

RL80 takes these implied timelines into account when deciding whether a trade makes sense right now.

⸻

Belief decay

Older conclusions lose influence over time unless refreshed:
	•	technical signals decay quickly
	•	sentiment signals decay moderately
	•	macro signals decay slowly

This prevents stale conviction from driving action.

⸻

Execution timing

When RL80 posts a decision:
	1.	The execution service validates it immediately
	2.	Risk checks are enforced
	3.	A trade is executed—or explicitly rejected

There is no hidden reinterpretation after that point.
What you see is what the system believed at the moment of action.

⸻

Adjusting cadence as the system evolves

Hourly evaluation is a starting point, not a ceiling.

As interest grows and the system matures, assessment intervals may be shortened:
	•	moving to every 30 minutes
	•	or adding lightweight checks between full reviews

Any increase in frequency will be deliberate and transparent.

The goal is not to trade more often, but to check more often when it’s justified.

What will not change:
	•	separation between analysis, decision, and execution
	•	risk limits and safety rails
	•	full logging and auditability

⸻

Why sentiment is treated differently

Sentiment is powerful—but noisy.

In this system, sentiment often acts as a volatility modifier:
	•	euphoria → wider targets, tighter controls
	•	fear spikes → reduced size, higher caution
	•	rising attention with flat price → breakout pressure

This helps avoid treating social media as a crystal ball.

⸻

Safety first: when the system refuses to trade

Even if RL80 wants to trade, execution may be blocked.

Default safety features include:
	•	trading disabled by default
	•	maximum position size
	•	daily trade and loss limits
	•	minimum confidence threshold
	•	cooldown periods
	•	allowed symbols only

Skipping a trade is a valid outcome.

⸻

Transparency and logs (“glass walls”)

Every step leaves a trail:
	•	market snapshots
	•	agent scores and summaries
	•	RL80 decisions and reasoning
	•	execution results and trade history

Trade School is meant to be reviewed like game tape.

⸻

What you’re seeing on the trading page

Each screen reflects one role:
	•	EMO: crowd mood and attention
	•	TEKNO: price structure and indicators
	•	MACRO: risk context and regime
	•	RL80: consensus, confidence, and outcomes

Together, they show how a decision emerged—or why none did.

⸻

Confidence ≠ certainty

Confidence is a tool:
	•	it gates execution
	•	influences position size
	•	tightens or loosens controls

Persistent high confidence is a warning sign.
Self-doubt is healthy.

⸻

What we’re still learning

This is an evolving system. Areas of active learning include:
	•	better weighting based on recent agent performance
	•	clearer regime gating (“don’t trade” conditions)
	•	improved belief decay handling
	•	expanded—but cautious—asset support

Trade School exists so these lessons are visible.

⸻


A note on prediction markets (parimutuel pools)

You may notice a button on the Trade page for simple parimutuel prediction markets.

These pools are separate from the AI trading system.

They are included as a learning tool: a way to observe how collective belief, probability, and incentives interact in a market-like setting.

What they are
	•	Small, parimutuel-style pools
	•	Outcomes are determined by participation, not an order book
	•	Odds emerge from how participants allocate belief
	•	No leverage, no liquidations, no execution engine

What they are not
	•	They are not used directly by the trading agents
	•	They are not signals or recommendations
	•	They do not influence RL80 decisions
	•	They are not financial advice or forecasts

Think of them as a belief laboratory, not a trading venue.

⸻

Why include them at all?

Prediction markets are useful for learning because they:
	•	expose how narratives compete
	•	reveal confidence vs conviction
	•	show how probabilities shift as information arrives

They complement Trade School’s core idea:

markets are as much about belief and coordination as they are about price.

In the future, aggregated signals from prediction markets may be studied as contextual data—but for now, they exist purely as an educational side experiment.

⸻

Relationship to the trading system

To be explicit:
	•	AI agents do not trade these pools
	•	Trades on Lighter DEX do not depend on pool outcomes
	•	Pool participation does not affect agent confidence or sizing

The separation is intentional.
Learning works best when experiments don’t contaminate each other.


⸻

Final thought

Most hours, nothing happens.

That’s not a failure—it’s restraint.

If you’re reading this, you’re already enrolled in Trade School.


