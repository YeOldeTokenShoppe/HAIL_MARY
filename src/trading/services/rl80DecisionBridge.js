// RL80 Decision Bridge
// Connects JS RL80 analysis to Python execution agent via Firebase

import { db, doc, setDoc, serverTimestamp } from '@/lib/firebaseClient';

class RL80DecisionBridge {
  constructor() {
    this.lastDecision = null;
    this.decisionHistory = [];
  }

  /**
   * Post a trading decision to Firebase for the Python agent to execute
   */
  async postTradingDecision({
    action = 'HOLD',          // BUY, SELL, HOLD
    symbol = 'ETH',           // Trading symbol
    confidence = 0.5,         // 0-1 confidence level
    reasoning = '',           // Why this decision was made
    position_size = null,     // Optional position size override
    stop_loss = null,         // Optional stop loss
    take_profit = null        // Optional take profit
  }) {
    if (!db) {
      console.error('Firebase not initialized for RL80 decision posting');
      return false;
    }

    try {
      const decision = {
        action,
        symbol,
        confidence,
        reasoning,
        position_size,
        stop_loss,
        take_profit,
        timestamp: Date.now(),
        created_at: serverTimestamp(),
        agent_version: 'JS_RL80_v1'
      };

      // Post to Firebase for Python agent to read
      await setDoc(doc(db, 'agentDecisions', 'RL80'), decision);
      
      // Also log to decisions history
      await setDoc(doc(db, 'agentDecisions', `RL80_${Date.now()}`), decision);

      console.log('RL80 decision posted to Firebase:', {
        action,
        symbol,
        confidence: confidence.toFixed(2),
        reasoning: reasoning.substring(0, 50) + (reasoning.length > 50 ? '...' : '')
      });

      this.lastDecision = decision;
      this.decisionHistory.push(decision);

      return true;

    } catch (error) {
      console.error('Failed to post RL80 decision to Firebase:', error);
      return false;
    }
  }

  /**
   * Enhanced decision posting with market context
   */
  async postEnhancedDecision({
    action,
    symbol = 'ETH',
    confidence,
    reasoning,
    marketContext = {},      // BTC price, fear/greed, etc.
    teamConsensus = null,    // Result from team analysis
    riskLevel = 'normal',    // Risk assessment
    position_size = null
  }) {
    const enhancedReasoning = this.buildDetailedReasoning({
      reasoning,
      marketContext,
      teamConsensus,
      riskLevel
    });

    return this.postTradingDecision({
      action,
      symbol,
      confidence,
      reasoning: enhancedReasoning,
      position_size,
      // Add metadata
      market_context: marketContext,
      team_consensus: teamConsensus,
      risk_level: riskLevel
    });
  }

  /**
   * Build detailed reasoning string
   */
  buildDetailedReasoning({ reasoning, marketContext, teamConsensus, riskLevel }) {
    const parts = [reasoning];

    if (marketContext.btcPrice) {
      parts.push(`BTC: $${Math.floor(marketContext.btcPrice / 1000)}k`);
    }

    if (marketContext.fearGreed !== undefined) {
      parts.push(`F&G: ${marketContext.fearGreed}`);
    }

    if (teamConsensus) {
      parts.push(`Team: ${teamConsensus}`);
    }

    if (riskLevel !== 'normal') {
      parts.push(`Risk: ${riskLevel}`);
    }

    return parts.filter(Boolean).join(' | ');
  }

  /**
   * Post a "no action" decision to keep the Python agent informed
   */
  async postNoAction(reasoning = 'Waiting for better setup') {
    return this.postTradingDecision({
      action: 'HOLD',
      confidence: 0.3,
      reasoning
    });
  }

  /**
   * Emergency stop - tells Python agent to halt all trading
   */
  async emergencyStop(reason = 'Manual emergency stop') {
    return this.postTradingDecision({
      action: 'EMERGENCY_STOP',
      confidence: 1.0,
      reasoning: `EMERGENCY: ${reason}`
    });
  }

  /**
   * Get the last decision posted
   */
  getLastDecision() {
    return this.lastDecision;
  }

  /**
   * Get decision history
   */
  getDecisionHistory() {
    return this.decisionHistory;
  }
}

// Export singleton instance
export const rl80DecisionBridge = new RL80DecisionBridge();
export default rl80DecisionBridge;