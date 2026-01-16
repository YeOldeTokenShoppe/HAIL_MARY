// Client-side Agent Chat Manager
// Handles periodic agent triggering and chat interactions

class AgentChatManager {
  constructor() {
    this.isActive = false;
    this.intervals = {};
    this.lastTriggerTimes = {};
    
    // Agent configuration with different intervals
    this.agentConfig = {
      'TEKNO': {
        interval: 180000, // 3 minutes
        priority: 1,
        description: 'Market Analysis & Technical Signals'
      },
      'EMO': {
        interval: 240000, // 4 minutes
        priority: 2,
        description: 'Sentiment Analysis & Market Psychology'
      },
      'MACRO': {
        interval: 300000, // 5 minutes
        priority: 3,
        description: 'Macroeconomic Analysis & Global Events'
      },
      'RL80': {
        interval: 360000, // 6 minutes
        priority: 4,
        description: 'Trading Decisions & Portfolio Management'
      }
    };
  }

  // Start the agent chat system
  start() {
    if (this.isActive) {
      console.log('Agent Chat Manager already running');
      return;
    }

    this.isActive = true;
    console.log('🤖 Starting Agent Chat Manager...');

    // Start each agent on their own schedule
    Object.keys(this.agentConfig).forEach(agent => {
      this.startAgent(agent);
    });

    // Initial trigger for all agents (staggered)
    this.triggerInitialMessages();
  }

  // Stop the agent chat system
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    console.log('🛑 Stopping Agent Chat Manager...');

    // Clear all intervals
    Object.keys(this.intervals).forEach(agent => {
      if (this.intervals[agent]) {
        clearInterval(this.intervals[agent]);
        delete this.intervals[agent];
      }
    });
  }

  // Start a specific agent's periodic messaging
  startAgent(agent) {
    if (this.intervals[agent]) {
      clearInterval(this.intervals[agent]);
    }

    const config = this.agentConfig[agent];
    if (!config) {
      console.error(`Unknown agent: ${agent}`);
      return;
    }

    console.log(`🚀 Starting ${agent} agent (every ${config.interval/1000}s)`);

    this.intervals[agent] = setInterval(() => {
      if (this.isActive) {
        this.triggerAgent(agent);
      }
    }, config.interval);
  }

  // Trigger initial messages with staggered timing
  triggerInitialMessages() {
    const agents = Object.keys(this.agentConfig);
    
    agents.forEach((agent, index) => {
      // Stagger initial messages by 30 seconds each
      setTimeout(() => {
        if (this.isActive) {
          this.triggerAgent(agent, true);
        }
      }, index * 30000);
    });
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