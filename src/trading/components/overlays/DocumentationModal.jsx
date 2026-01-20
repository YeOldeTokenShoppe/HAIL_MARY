import React from 'react';

const DocumentationModal = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(10px)',
      padding: '10px'
    }}>
      {/* Modal Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '900px',
        height: '90vh',
        maxHeight: '90vh',
        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.98) 0%, rgba(0, 10, 30, 0.98) 100%)',
        border: '2px solid #00c8ff',
        borderRadius: '20px',
        boxShadow: '0 0 50px rgba(0, 200, 255, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '2px solid #00c8ff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 200, 255, 0.1)',
          flexShrink: 0
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 'bold',
            color: '#00c8ff',
            fontFamily: 'monospace'
          }}>
            📜 Trade School
          </h1>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid #ff0000',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ff0000',
              fontSize: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 0, 0, 0.4)';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 0, 0, 0.2)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          padding: '20px',
          color: '#ffffff'
        }}>
          <div style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6',
            fontSize: '16px'
          }}>
            {/* Subtitle */}
            <p style={{
              fontSize: '20px',
              color: '#00ff88',
              fontStyle: 'italic',
              marginTop: 0,
              marginBottom: '30px'
            }}>
              How the RL80 trading system thinks
            </p>

            <p style={{ color: '#cccccc' }}>
              Welcome to Trade School.
            </p>

            <p style={{ color: '#cccccc' }}>
              This page explains how the RL80 trading system works, what you're seeing on the trading dashboard, and—most importantly—how decisions are made. The system is built and operated in public so that trading decisions can be observed, questioned, and learned from.
            </p>

            <p style={{ color: '#cccccc' }}>
              Trade School is not about predicting markets.<br />
              It's about understanding process, discipline, and uncertainty.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* TL;DR Section */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              TL;DR
            </h2>

            <p style={{ color: '#cccccc' }}>
              Trade School is a transparent, multi-agent AI trading experiment.
            </p>

            <p style={{ color: '#cccccc' }}>
              Three specialist agents analyze the market from different perspectives—macro conditions, market sentiment, and technical price action—and report to an executive agent (RL80) that decides whether a trade is justified.
            </p>

            <p style={{ color: '#cccccc' }}>The system:</p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>collects market, sentiment, and macro data continuously</li>
              <li>evaluates conditions on a scheduled cadence (currently hourly)</li>
              <li>applies confidence thresholds and strict risk limits</li>
              <li>may execute a trade only when conditions align</li>
              <li>logs every decision and outcome for review</li>
            </ul>

            <p style={{ color: '#cccccc', fontWeight: 'bold' }}>
              Most of the time, the system does nothing—by design.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Important disclaimer */}
            <h2 style={{ color: '#ff6666', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Important disclaimer
            </h2>

            <p style={{ color: '#cccccc' }}>
              This project is for education, research, and entertainment only. Nothing here is financial advice or a recommendation to trade. Perpetual futures are high-risk instruments and can result in rapid losses.
            </p>

            <p style={{ color: '#ffaa00', fontWeight: 'bold' }}>
              Unless explicitly stated otherwise, all trading occurs on Lighter DEX testnet.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* The core idea */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              The core idea: a small investment committee
            </h2>

            <p style={{ color: '#cccccc' }}>
              Instead of a single model attempting to do everything, the system is structured like a mini investment committee:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li><strong>MACRO</strong> looks at the big picture</li>
              <li><strong>EMO</strong> listens to the crowd</li>
              <li><strong>TEKNO</strong> studies price behavior</li>
              <li><strong>RL80</strong> makes the final call</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Each agent has a clear role and a different natural time horizon.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* The agents */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              The agents and their roles
            </h2>

            {/* MACRO */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              🧭 MACRO — the regime reader
            </h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '5px' }}>
              Model: Claude (Anthropic)
            </p>
            <p style={{ color: '#cccccc' }}>
              MACRO focuses on the environment markets are operating in:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>volatility</li>
              <li>rates</li>
              <li>dollar strength</li>
              <li>broader risk appetite</li>
            </ul>
            <p style={{ color: '#cccccc' }}>
              Its job is not to time trades, but to answer:<br />
              <em>"Is this a market where risk even makes sense?"</em>
            </p>
            <p style={{ color: '#cccccc' }}>
              Macro conclusions tend to matter for days or weeks.
            </p>

            {/* EMO */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              🌊 EMO — the sentiment reader
            </h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '5px' }}>
              Model: Grok (xAI)
            </p>
            <p style={{ color: '#cccccc' }}>
              EMO tracks crowd psychology:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>fear vs greed</li>
              <li>attention shifts</li>
              <li>narrative momentum</li>
              <li>social and prediction-market signals</li>
            </ul>
            <p style={{ color: '#cccccc' }}>
              Sentiment often changes faster than fundamentals and is most useful for understanding volatility and pressure, not precise direction.
            </p>

            {/* TEKNO */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              📐 TEKNO — the chart reader
            </h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '5px' }}>
              Model: OpenAI (GPT-4-class)
            </p>
            <p style={{ color: '#cccccc' }}>
              TEKNO analyzes:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>price structure</li>
              <li>indicators (RSI, MACD, Bollinger Bands)</li>
              <li>support and resistance</li>
              <li>short-term setups</li>
            </ul>
            <p style={{ color: '#cccccc' }}>
              It doesn't care why price is moving—only how and where.
            </p>

            {/* RL80 */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              🎛 RL80 — the executive
            </h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '5px' }}>
              Model: Claude (Anthropic)
            </p>
            <p style={{ color: '#cccccc' }}>
              RL80 aggregates all specialist inputs and decides whether to act.
            </p>
            <p style={{ color: '#cccccc' }}>
              Its responsibilities include:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>weighing conflicting opinions</li>
              <li>applying confidence thresholds</li>
              <li>enforcing risk limits</li>
              <li>deciding to trade—or not trade</li>
              <li>explaining the decision clearly afterward</li>
            </ul>
            <p style={{ color: '#cccccc' }}>
              RL80 does not blindly follow any single agent.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Why multiple models */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Why multiple models?
            </h2>

            <p style={{ color: '#cccccc' }}>
              Different AI models excel at different kinds of reasoning—and fail in different ways.
            </p>

            <p style={{ color: '#cccccc' }}>
              By mixing models and forcing them to disagree:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>blind spots are reduced</li>
              <li>overconfidence is exposed</li>
              <li>decisions become more interpretable</li>
            </ul>

            <p style={{ color: '#cccccc', fontWeight: 'bold' }}>
              Disagreement is a feature, not a bug.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Timing and cadence */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Timing, cadence, and freshness of signals
            </h2>

            <p style={{ color: '#cccccc' }}>
              Not all information ages at the same speed.
            </p>

            <p style={{ color: '#cccccc' }}>
              A chart pattern can be stale in minutes.<br />
              A macro regime can matter for weeks.
            </p>

            <p style={{ color: '#cccccc' }}>
              The system is designed around that reality.
            </p>

            {/* Continuous data collection */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Continuous data collection
            </h3>

            <p style={{ color: '#cccccc' }}>
              A background service continuously updates raw inputs:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>prices and candles</li>
              <li>technical indicators</li>
              <li>sentiment feeds</li>
              <li>macro context</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Agents always analyze the latest snapshot, not yesterday's news.
            </p>

            {/* Scheduled analysis */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Scheduled analysis ("the meeting")
            </h3>

            <p style={{ color: '#cccccc' }}>
              Rather than reacting to every tick, the system holds a structured review:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li><strong>Frequency:</strong> once per hour</li>
              <li><strong>Sequence:</strong> EMO → TEKNO → MACRO → RL80</li>
              <li><strong>Duration:</strong> a few minutes end-to-end</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Think of it as a trading desk check-in.
            </p>

            {/* Different clocks */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Different clocks, different weights
            </h3>

            <p style={{ color: '#cccccc' }}>
              Even though agents run together, they think on different horizons:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li><strong>MACRO:</strong> weeks → months</li>
              <li><strong>EMO:</strong> hours → days</li>
              <li><strong>TEKNO:</strong> minutes → hours</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              RL80 takes these implied timelines into account when deciding whether a trade makes sense right now.
            </p>

            {/* Belief decay */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Belief decay
            </h3>

            <p style={{ color: '#cccccc' }}>
              Older conclusions lose influence over time unless refreshed:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>technical signals decay quickly</li>
              <li>sentiment signals decay moderately</li>
              <li>macro signals decay slowly</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              This prevents stale conviction from driving action.
            </p>

            {/* Execution timing */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Execution timing
            </h3>

            <p style={{ color: '#cccccc' }}>
              When RL80 posts a decision:
            </p>
            <ol style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>The execution service validates it immediately</li>
              <li>Risk checks are enforced</li>
              <li>A trade is executed—or explicitly rejected</li>
            </ol>

            <p style={{ color: '#cccccc' }}>
              There is no hidden reinterpretation after that point.<br />
              What you see is what the system believed at the moment of action.
            </p>

            {/* Adjusting cadence */}
            <h3 style={{ color: '#00ff88', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>
              Adjusting cadence as the system evolves
            </h3>

            <p style={{ color: '#cccccc' }}>
              Hourly evaluation is a starting point, not a ceiling.
            </p>

            <p style={{ color: '#cccccc' }}>
              As interest grows and the system matures, assessment intervals may be shortened:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>moving to every 30 minutes</li>
              <li>or adding lightweight checks between full reviews</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Any increase in frequency will be deliberate and transparent.
            </p>

            <p style={{ color: '#cccccc' }}>
              The goal is not to trade more often, but to check more often when it's justified.
            </p>

            <p style={{ color: '#cccccc' }}>
              <strong>What will not change:</strong>
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>separation between analysis, decision, and execution</li>
              <li>risk limits and safety rails</li>
              <li>full logging and auditability</li>
            </ul>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Why sentiment is different */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Why sentiment is treated differently
            </h2>

            <p style={{ color: '#cccccc' }}>
              Sentiment is powerful—but noisy.
            </p>

            <p style={{ color: '#cccccc' }}>
              In this system, sentiment often acts as a volatility modifier:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>euphoria → wider targets, tighter controls</li>
              <li>fear spikes → reduced size, higher caution</li>
              <li>rising attention with flat price → breakout pressure</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              This helps avoid treating social media as a crystal ball.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Safety first */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Safety first: when the system refuses to trade
            </h2>

            <p style={{ color: '#cccccc' }}>
              Even if RL80 wants to trade, execution may be blocked.
            </p>

            <p style={{ color: '#cccccc' }}>
              Default safety features include:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>trading disabled by default</li>
              <li>maximum position size</li>
              <li>daily trade and loss limits</li>
              <li>minimum confidence threshold</li>
              <li>cooldown periods</li>
              <li>allowed symbols only</li>
            </ul>

            <p style={{ color: '#cccccc', fontWeight: 'bold' }}>
              Skipping a trade is a valid outcome.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Transparency */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Transparency and logs ("glass walls")
            </h2>

            <p style={{ color: '#cccccc' }}>
              Every step leaves a trail:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>market snapshots</li>
              <li>agent scores and summaries</li>
              <li>RL80 decisions and reasoning</li>
              <li>execution results and trade history</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Trade School is meant to be reviewed like game tape.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* What you're seeing */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              What you're seeing on the trading page
            </h2>

            <p style={{ color: '#cccccc' }}>
              Each screen reflects one role:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li><strong>EMO:</strong> crowd mood and attention</li>
              <li><strong>TEKNO:</strong> price structure and indicators</li>
              <li><strong>MACRO:</strong> risk context and regime</li>
              <li><strong>RL80:</strong> consensus, confidence, and outcomes</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Together, they show how a decision emerged—or why none did.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Confidence */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Confidence ≠ certainty
            </h2>

            <p style={{ color: '#cccccc' }}>
              Confidence is a tool:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>it gates execution</li>
              <li>influences position size</li>
              <li>tightens or loosens controls</li>
            </ul>

            <p style={{ color: '#cccccc', fontWeight: 'bold' }}>
              Persistent high confidence is a warning sign.<br />
              Self-doubt is healthy.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* What we're learning */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              What we're still learning
            </h2>

            <p style={{ color: '#cccccc' }}>
              This is an evolving system. Areas of active learning include:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>better weighting based on recent agent performance</li>
              <li>clearer regime gating ("don't trade" conditions)</li>
              <li>improved belief decay handling</li>
              <li>expanded—but cautious—asset support</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              Trade School exists so these lessons are visible.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Prediction markets */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              A note on prediction markets (parimutuel pools)
            </h2>

            <p style={{ color: '#cccccc' }}>
              You may notice a button on the Trade page for simple parimutuel prediction markets.
            </p>

            <p style={{ color: '#cccccc' }}>
              These pools are separate from the AI trading system.
            </p>

            <p style={{ color: '#cccccc' }}>
              They are included as a learning tool: a way to observe how collective belief, probability, and incentives interact in a market-like setting.
            </p>

            <h3 style={{ color: '#00ff88', fontSize: '18px', marginTop: '25px', marginBottom: '15px' }}>
              What they are
            </h3>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>Small, parimutuel-style pools</li>
              <li>Outcomes are determined by participation, not an order book</li>
              <li>Odds emerge from how participants allocate belief</li>
              <li>No leverage, no liquidations, no execution engine</li>
            </ul>

            <h3 style={{ color: '#00ff88', fontSize: '18px', marginTop: '25px', marginBottom: '15px' }}>
              What they are not
            </h3>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>They are not used directly by the trading agents</li>
              <li>They are not signals or recommendations</li>
              <li>They do not influence RL80 decisions</li>
              <li>They are not financial advice or forecasts</li>
            </ul>

            <p style={{ color: '#cccccc', fontStyle: 'italic' }}>
              Think of them as a belief laboratory, not a trading venue.
            </p>

            <h3 style={{ color: '#00ff88', fontSize: '18px', marginTop: '25px', marginBottom: '15px' }}>
              Why include them at all?
            </h3>

            <p style={{ color: '#cccccc' }}>
              Prediction markets are useful for learning because they:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>expose how narratives compete</li>
              <li>reveal confidence vs conviction</li>
              <li>show how probabilities shift as information arrives</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              They complement Trade School's core idea:
            </p>

            <p style={{ color: '#cccccc', fontStyle: 'italic' }}>
              markets are as much about belief and coordination as they are about price.
            </p>

            <p style={{ color: '#cccccc' }}>
              In the future, aggregated signals from prediction markets may be studied as contextual data—but for now, they exist purely as an educational side experiment.
            </p>

            <h3 style={{ color: '#00ff88', fontSize: '18px', marginTop: '25px', marginBottom: '15px' }}>
              Relationship to the trading system
            </h3>

            <p style={{ color: '#cccccc' }}>
              To be explicit:
            </p>
            <ul style={{ color: '#cccccc', paddingLeft: '20px' }}>
              <li>AI agents do not trade these pools</li>
              <li>Trades on Lighter DEX do not depend on pool outcomes</li>
              <li>Pool participation does not affect agent confidence or sizing</li>
            </ul>

            <p style={{ color: '#cccccc' }}>
              The separation is intentional.<br />
              Learning works best when experiments don't contaminate each other.
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid #00c8ff', margin: '40px 0' }} />

            {/* Final thought */}
            <h2 style={{ color: '#00c8ff', fontSize: '24px', marginTop: '40px', marginBottom: '20px' }}>
              Final thought
            </h2>

            <p style={{ color: '#cccccc', fontSize: '18px' }}>
              Most hours, nothing happens.
            </p>

            <p style={{ color: '#cccccc', fontSize: '18px' }}>
              That's not a failure—it's restraint.
            </p>

            <p style={{ color: '#cccccc', fontSize: '18px', fontWeight: 'bold', marginBottom: '60px' }}>
              If you're reading this, you're already enrolled in Trade School.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
