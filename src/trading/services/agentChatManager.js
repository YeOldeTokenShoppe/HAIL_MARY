// Client-side Agent Chat Manager
// Handles periodic agent triggering and chat interactions

class AgentChatManager {
  constructor() {
    this.isActive = false;
    this.intervals = {};
    this.lastTriggerTimes = {};
    this.scoringMode = false; // Enable scoring mode by default when ready

    // Sequential agent workflow configuration (EMO → TEKNO → MACRO → RL80)
    this.agentConfig = {
      'EMO': {
        interval: 3600000, // 1 hour - sentiment analysis first
        priority: 1,
        next: 'TEKNO',
        description: 'Sentiment Analysis & Market Psychology'
      },
      'TEKNO': {
        interval: 3600000, // 1 hour - technical analysis after EMO
        priority: 2,
        next: 'MACRO',
        description: 'Market Analysis & Technical Signals',
        waitForPrevious: true
      },
      'MACRO': {
        interval: 3600000, // 1 hour - macro analysis after TEKNO
        priority: 3,
        next: 'RL80',
        description: 'Macroeconomic Analysis & Global Events',
        waitForPrevious: true
      },
      'RL80': {
        interval: 3600000, // 1 hour - final trading decision
        priority: 4,
        next: null,
        description: 'Trading Decisions & Portfolio Management',
        waitForPrevious: true
      }
    };
    
    // Track workflow state
    this.workflowState = {
      currentAgent: null,
      lastWorkflowStart: null,
      agentResponses: {
        'EMO': null,
        'TEKNO': null,
        'MACRO': null,
        'RL80': null
      },
      // Scoring mode outputs
      agentScores: {
        'EMO': null,
        'TEKNO': null,
        'MACRO': null
      },
      lastDecision: null,
      isWorkflowRunning: false
    };
  }

  /**
   * Enable or disable scoring mode
   * @param {boolean} enabled - Whether to enable scoring mode
   */
  setScoringMode(enabled) {
    this.scoringMode = enabled;
    console.log(`🎯 Scoring mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Start the agent chat system with sequential workflow
  start() {
    if (this.isActive) {
      console.log('Agent Chat Manager already running');
      return;
    }

    this.isActive = true;
    console.log('🤖 Starting Sequential Agent Chat Manager...');
    console.log('📋 Workflow: EMO → TEKNO → MACRO → RL80 (every hour)');

    // Start the main workflow interval (every hour)
    this.startWorkflowTimer();

    // Trigger initial workflow immediately
    this.startWorkflow();
  }

  // Stop the agent chat system
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    this.workflowState.isWorkflowRunning = false;
    console.log('🛑 Stopping Sequential Agent Chat Manager...');

    // Clear all intervals
    Object.keys(this.intervals).forEach(agent => {
      if (this.intervals[agent]) {
        clearInterval(this.intervals[agent]);
        delete this.intervals[agent];
      }
    });
  }

  // Start the main workflow timer (every hour)
  startWorkflowTimer() {
    // Clear existing interval
    if (this.intervals.main) {
      clearInterval(this.intervals.main);
    }

    // Start hourly workflow
    this.intervals.main = setInterval(() => {
      if (this.isActive && !this.workflowState.isWorkflowRunning) {
        this.startWorkflow();
      }
    }, 3600000); // 1 hour

    console.log('⏰ Workflow timer started (every 1 hour)');
  }

  // Start the sequential agent workflow: EMO → TEKNO → MACRO → RL80
  async startWorkflow() {
    if (this.workflowState.isWorkflowRunning) {
      console.log('⚠️ Workflow already running, skipping...');
      return;
    }

    const workflowType = this.scoringMode ? 'Scoring' : 'Sequential';
    console.log(`🔄 Starting ${workflowType} agent analysis workflow...`);
    this.workflowState.isWorkflowRunning = true;
    this.workflowState.lastWorkflowStart = Date.now();

    // Reset agent responses and scores
    Object.keys(this.workflowState.agentResponses).forEach(agent => {
      this.workflowState.agentResponses[agent] = null;
    });
    Object.keys(this.workflowState.agentScores).forEach(agent => {
      this.workflowState.agentScores[agent] = null;
    });

    try {
      if (this.scoringMode) {
        await this.runScoringWorkflow();
      } else {
        await this.runSequentialWorkflow();
      }

      console.log('✅ Agent workflow completed successfully!');

    } catch (error) {
      console.error('❌ Agent workflow failed:', error);
    } finally {
      this.workflowState.isWorkflowRunning = false;
      this.workflowState.currentAgent = null;
    }
  }

  // Run scoring mode workflow
  async runScoringWorkflow() {
    // Step 1: EMO (Sentiment Analysis with Scoring)
    console.log('📍 Step 1/4: EMO starting sentiment analysis (scoring mode)...');
    this.workflowState.currentAgent = 'EMO';
    const emoResult = await this.triggerAgentWithScoring('EMO');
    this.workflowState.agentResponses.EMO = emoResult?.message;
    this.workflowState.agentScores.EMO = emoResult?.scoreOutput;

    await this.delay(30000);

    // Step 2: TEKNO (Technical Analysis with Scoring)
    console.log('📍 Step 2/4: TEKNO starting technical analysis (scoring mode)...');
    this.workflowState.currentAgent = 'TEKNO';
    const teknoResult = await this.triggerAgentWithScoring('TEKNO');
    this.workflowState.agentResponses.TEKNO = teknoResult?.message;
    this.workflowState.agentScores.TEKNO = teknoResult?.scoreOutput;

    await this.delay(30000);

    // Step 3: MACRO (Macroeconomic Analysis with Scoring)
    console.log('📍 Step 3/4: MACRO starting macro analysis (scoring mode)...');
    this.workflowState.currentAgent = 'MACRO';
    const macroResult = await this.triggerAgentWithScoring('MACRO');
    this.workflowState.agentResponses.MACRO = macroResult?.message;
    this.workflowState.agentScores.MACRO = macroResult?.scoreOutput;

    await this.delay(30000);

    // Step 4: RL80 (Final Trading Decision using all scores)
    console.log('📍 Step 4/4: RL80 making final trading decision (scoring mode)...');
    this.workflowState.currentAgent = 'RL80';
    const rl80Result = await this.triggerRL80WithScores();
    this.workflowState.agentResponses.RL80 = rl80Result?.message;
    this.workflowState.lastDecision = rl80Result?.decisionOutput;
  }

  // Run original sequential workflow (non-scoring)
  async runSequentialWorkflow() {
    // Step 1: EMO (Sentiment Analysis)
    console.log('📍 Step 1/4: EMO starting sentiment analysis...');
    this.workflowState.currentAgent = 'EMO';
    const emoResponse = await this.triggerAgent('EMO', true);
    this.workflowState.agentResponses.EMO = emoResponse;

    await this.delay(30000);

    // Step 2: TEKNO (Technical Analysis)
    console.log('📍 Step 2/4: TEKNO starting technical analysis...');
    this.workflowState.currentAgent = 'TEKNO';
    const teknoResponse = await this.triggerAgent('TEKNO', true);
    this.workflowState.agentResponses.TEKNO = teknoResponse;

    await this.delay(30000);

    // Step 3: MACRO (Macroeconomic Analysis)
    console.log('📍 Step 3/4: MACRO starting macro analysis...');
    this.workflowState.currentAgent = 'MACRO';
    const macroResponse = await this.triggerAgent('MACRO', true);
    this.workflowState.agentResponses.MACRO = macroResponse;

    await this.delay(30000);

    // Step 4: RL80 (Final Trading Decision)
    console.log('📍 Step 4/4: RL80 making final trading decision...');
    this.workflowState.currentAgent = 'RL80';
    const rl80Response = await this.triggerAgentWithContext('RL80', {
      emoAnalysis: this.workflowState.agentResponses.EMO,
      teknoAnalysis: this.workflowState.agentResponses.TEKNO,
      macroAnalysis: this.workflowState.agentResponses.MACRO
    });
    this.workflowState.agentResponses.RL80 = rl80Response;
  }

  // Trigger agent with scoring mode
  async triggerAgentWithScoring(agent) {
    try {
      const now = Date.now();

      console.log(`🎯 Triggering ${agent} agent (scoring mode)...`);

      const response = await fetch('/api/agent-chat-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent,
          force: true,
          scoringMode: true
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ ${agent} scored:`, result.scores?.length, 'assets');
        this.lastTriggerTimes[agent] = now;

        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('agentChatUpdate', {
          detail: {
            agent,
            message: result.message,
            type: result.type,
            sentiment: result.sentiment,
            timestamp: result.timestamp,
            scores: result.scores,
            scoringMode: true
          }
        }));

        return result;
      } else {
        console.warn(`⚠️ ${agent} scoring failed:`, result.error);
        return null;
      }

    } catch (error) {
      console.error(`❌ Error triggering ${agent} (scoring):`, error);
      return null;
    }
  }

  // Trigger RL80 with collected scores
  async triggerRL80WithScores() {
    try {
      const now = Date.now();

      console.log('🎯 Triggering RL80 with analyst scores...');

      const response = await fetch('/api/agent-chat-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: 'RL80',
          force: true,
          scoringMode: true,
          analystScores: this.workflowState.agentScores,
          portfolioState: {} // Could be populated with actual portfolio data
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ RL80 decision:`, result.decision?.summary);
        this.lastTriggerTimes['RL80'] = now;

        // Dispatch custom event with trading decision
        window.dispatchEvent(new CustomEvent('agentChatUpdate', {
          detail: {
            agent: 'RL80',
            message: result.message,
            type: result.type,
            sentiment: result.sentiment,
            timestamp: result.timestamp,
            isTradingDecision: true,
            decision: result.decision,
            scoringMode: true
          }
        }));

        return result;
      } else {
        console.warn('⚠️ RL80 decision failed:', result.error);
        return null;
      }

    } catch (error) {
      console.error('❌ Error triggering RL80 with scores:', error);
      return null;
    }
  }

  // Helper method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Trigger a specific agent
  async triggerAgent(agent, force = false) {
    try {
      const now = Date.now();
      const lastTrigger = this.lastTriggerTimes[agent] || 0;
      const config = this.agentConfig[agent];

      // Rate limiting check
      if (!force && (now - lastTrigger) < config.interval * 0.8) {
        console.log(`⏰ ${agent} rate limited`);
        return;
      }

      console.log(`🎯 Triggering ${agent} agent...`);

      const response = await fetch('/api/agent-chat-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent,
          force
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ ${agent} responded:`, result.message?.substring(0, 100) + '...');
        this.lastTriggerTimes[agent] = now;
        
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('agentChatUpdate', {
          detail: {
            agent,
            message: result.message,
            type: result.type,
            sentiment: result.sentiment,
            timestamp: result.timestamp
          }
        }));
      } else {
        console.warn(`⚠️ ${agent} failed:`, result.error);
      }

    } catch (error) {
      console.error(`❌ Error triggering ${agent}:`, error);
    }
  }

  // Trigger RL80 agent with context from other agents
  async triggerAgentWithContext(agent, context = {}) {
    try {
      const now = Date.now();
      const config = this.agentConfig[agent];

      console.log(`🎯 Triggering ${agent} agent with team context...`);

      const response = await fetch('/api/agent-chat-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent,
          context,
          teamAnalysis: context, // Pass team analysis to RL80
          isSequentialWorkflow: true
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ ${agent} made final decision:`, result.message?.substring(0, 100) + '...');
        this.lastTriggerTimes[agent] = now;
        
        // Dispatch custom event for UI updates with trading decision flag
        window.dispatchEvent(new CustomEvent('agentChatUpdate', {
          detail: {
            agent,
            message: result.message,
            type: result.type,
            sentiment: result.sentiment,
            timestamp: result.timestamp,
            isTradingDecision: agent === 'RL80',
            teamAnalysis: context
          }
        }));

        return result.message;
      } else {
        console.warn(`⚠️ ${agent} failed:`, result.error);
        return null;
      }

    } catch (error) {
      console.error(`❌ Error triggering ${agent} with context:`, error);
      return null;
    }
  }

  // Manually trigger a specific agent
  async manualTrigger(agent) {
    return this.triggerAgent(agent, true);
  }

  // Get status of all agents
  async getStatus() {
    try {
      const response = await fetch('/api/agent-chat-service');
      const result = await response.json();
      
      if (result.success) {
        return result.agents;
      }
      
      throw new Error(result.error || 'Failed to get status');
    } catch (error) {
      console.error('Error getting agent status:', error);
      return {};
    }
  }

  // Trigger a conversation between agents (advanced feature)
  async triggerConversation(topic) {
    console.log(`🗣️ Starting agent conversation about: ${topic}`);
    
    // Trigger agents in order of priority with the topic context
    const agents = Object.entries(this.agentConfig)
      .sort(([,a], [,b]) => a.priority - b.priority)
      .map(([agent,]) => agent);

    for (const agent of agents) {
      await this.triggerAgent(agent, true);
      // Wait 30 seconds between agents to allow responses
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  // Check if manager is running
  isRunning() {
    return this.isActive;
  }

  // Get current configuration
  getConfig() {
    return { ...this.agentConfig };
  }

  // Update agent intervals
  updateAgentInterval(agent, newInterval) {
    if (this.agentConfig[agent]) {
      this.agentConfig[agent].interval = newInterval;

      // Restart the agent with new interval
      if (this.isActive) {
        this.startAgent(agent);
      }

      console.log(`🔄 Updated ${agent} interval to ${newInterval/1000}s`);
    }
  }

  // Get last decision (scoring mode)
  getLastDecision() {
    return this.workflowState.lastDecision;
  }

  // Get all agent scores from last workflow
  getAgentScores() {
    return this.workflowState.agentScores;
  }

  // Check if scoring mode is enabled
  isScoringModeEnabled() {
    return this.scoringMode;
  }

  // Get workflow state summary
  getWorkflowStateSummary() {
    return {
      isRunning: this.workflowState.isWorkflowRunning,
      currentAgent: this.workflowState.currentAgent,
      lastStart: this.workflowState.lastWorkflowStart
        ? new Date(this.workflowState.lastWorkflowStart).toISOString()
        : null,
      hasScores: Object.values(this.workflowState.agentScores).some(s => s !== null),
      hasDecision: this.workflowState.lastDecision !== null,
      scoringMode: this.scoringMode
    };
  }

  // Manually trigger scoring workflow
  async triggerScoringWorkflow() {
    if (!this.scoringMode) {
      this.setScoringMode(true);
    }
    return this.startWorkflow();
  }
}

// Export singleton instance
export const agentChatManager = new AgentChatManager();

// Auto-start in development mode (comment out for production)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Auto-start after page load
  setTimeout(() => {
    if (!agentChatManager.isRunning()) {
      console.log('🚀 Auto-starting Agent Chat Manager in development mode');
      agentChatManager.start();
    }
  }, 5000);
}

export default agentChatManager;