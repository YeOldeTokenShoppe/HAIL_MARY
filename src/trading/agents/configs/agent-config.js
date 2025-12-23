/**
 * Agent Configuration & Control
 * 
 * Centralized control for enabling/disabling agents
 * and managing their behavior in different environments
 */

// ============================================================================
// AGENT CONTROL SETTINGS
// ============================================================================

export const AGENT_CONFIG = {
  // Master switch - disables ALL agents if false
  AGENTS_ENABLED: process.env.NEXT_PUBLIC_AGENTS_ENABLED !== 'false',
  
  // Environment mode
  MODE: process.env.NODE_ENV || 'development',
  
  // Individual agent controls
  agents: {
    sentiment: {
      enabled: process.env.NEXT_PUBLIC_AGENT_SENTIMENT !== 'false',
      provider: 'grok',
      rateLimit: {
        enabled: true,
        cooldownMs: 60 * 60 * 1000, // 1 hour
      },
      mockMode: process.env.NEXT_PUBLIC_MOCK_SENTIMENT === 'true',
      mockResponse: 'Crowd sentiment neutral, watching for breakout signals.'
    },
    
    market: {
      enabled: process.env.NEXT_PUBLIC_AGENT_MARKET !== 'false',
      provider: 'openai',
      rateLimit: {
        enabled: false,
        cooldownMs: 0,
      },
      mockMode: process.env.NEXT_PUBLIC_MOCK_MARKET === 'true',
      mockResponse: 'BTC testing key support at 95k, RSI neutral at 50.'
    },
    
    macro: {
      enabled: process.env.NEXT_PUBLIC_AGENT_MACRO !== 'false',
      provider: 'anthropic',
      rateLimit: {
        enabled: false,
        cooldownMs: 0,
      },
      mockMode: process.env.NEXT_PUBLIC_MOCK_MACRO === 'true',
      mockResponse: 'DXY stable at 104, macro conditions neutral for risk assets.'
    },
    
    rl80: {
      enabled: process.env.NEXT_PUBLIC_AGENT_RL80 !== 'false',
      provider: 'none', // No API, pure logic
      rateLimit: {
        enabled: false,
        cooldownMs: 0,
      },
      mockMode: process.env.NEXT_PUBLIC_MOCK_RL80 === 'true',
      mockResponse: 'Analyzing market conditions. Risk parameters set.'
    }
  },
  
  // Development settings
  development: {
    logApiCalls: true,
    logResponses: true,
    useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
    delayMs: 0, // Simulate API delay in dev
  },
  
  // Production settings
  production: {
    logApiCalls: false,
    logResponses: false,
    useMockData: false,
    delayMs: 0,
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an agent is enabled
 */
export function isAgentEnabled(agentName) {
  // Check master switch first
  if (!AGENT_CONFIG.AGENTS_ENABLED) {
    console.log(`[Agent Control] All agents disabled via master switch`);
    return false;
  }
  
  // Check individual agent setting
  const agent = AGENT_CONFIG.agents[agentName];
  if (!agent || !agent.enabled) {
    console.log(`[Agent Control] ${agentName} is disabled`);
    return false;
  }
  
  // Check if in mock mode
  if (agent.mockMode) {
    console.log(`[Agent Control] ${agentName} is in mock mode`);
    return 'mock';
  }
  
  return true;
}

/**
 * Get mock response for an agent
 */
export function getMockResponse(agentName) {
  const agent = AGENT_CONFIG.agents[agentName];
  return agent?.mockResponse || `${agentName} mock response`;
}

/**
 * Check if rate limited
 */
export function isRateLimited(agentName, lastCallTime) {
  const agent = AGENT_CONFIG.agents[agentName];
  
  if (!agent?.rateLimit?.enabled) {
    return false;
  }
  
  if (!lastCallTime) {
    return false;
  }
  
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  const isLimited = timeSinceLastCall < agent.rateLimit.cooldownMs;
  
  if (isLimited) {
    const minutesRemaining = Math.ceil((agent.rateLimit.cooldownMs - timeSinceLastCall) / 1000 / 60);
    console.log(`[Agent Control] ${agentName} rate limited. ${minutesRemaining} minutes remaining`);
  }
  
  return isLimited;
}

/**
 * Get current environment settings
 */
export function getEnvSettings() {
  const mode = AGENT_CONFIG.MODE;
  return AGENT_CONFIG[mode] || AGENT_CONFIG.development;
}

/**
 * Log API call if enabled
 */
export function logApiCall(agentName, context) {
  const settings = getEnvSettings();
  if (settings.logApiCalls) {
    console.log(`[API Call] ${agentName}:`, {
      timestamp: new Date().toISOString(),
      marketData: context.marketData,
      enabled: isAgentEnabled(agentName)
    });
  }
}

/**
 * Log response if enabled
 */
export function logResponse(agentName, response) {
  const settings = getEnvSettings();
  if (settings.logResponses) {
    console.log(`[API Response] ${agentName}:`, {
      timestamp: new Date().toISOString(),
      response: response?.substring(0, 100) + '...'
    });
  }
}

// ============================================================================
// STATUS REPORT
// ============================================================================

/**
 * Get current status of all agents
 */
export function getAgentStatus() {
  const status = {
    masterSwitch: AGENT_CONFIG.AGENTS_ENABLED,
    environment: AGENT_CONFIG.MODE,
    agents: {}
  };
  
  Object.keys(AGENT_CONFIG.agents).forEach(agentName => {
    const agent = AGENT_CONFIG.agents[agentName];
    status.agents[agentName] = {
      enabled: agent.enabled,
      mockMode: agent.mockMode,
      provider: agent.provider,
      rateLimit: agent.rateLimit.enabled ? `${agent.rateLimit.cooldownMs / 1000 / 60} min` : 'none'
    };
  });
  
  return status;
}

/**
 * Print status to console
 */
export function printAgentStatus() {
  const status = getAgentStatus();
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║         AGENT CONTROL STATUS           ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║ Master Switch: ${status.masterSwitch ? '✅ ON ' : '❌ OFF'}                    ║`);
  console.log(`║ Environment:   ${status.environment.padEnd(24)} ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log('║ Agent      │ Status │ Mode   │ Rate   ║');
  console.log('╠════════════════════════════════════════╣');
  
  Object.entries(status.agents).forEach(([name, agent]) => {
    const statusIcon = agent.enabled ? '✅' : '❌';
    const mode = agent.mockMode ? 'Mock' : 'Live';
    const rate = agent.rateLimit || 'none';
    console.log(`║ ${name.padEnd(10)} │ ${statusIcon}     │ ${mode.padEnd(6)} │ ${rate.padEnd(6)} ║`);
  });
  
  console.log('╚════════════════════════════════════════╝');
}

export default AGENT_CONFIG;