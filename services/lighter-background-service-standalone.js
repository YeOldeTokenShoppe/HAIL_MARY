#!/usr/bin/env node

/**
 * Lighter Background Service - Standalone Mode
 * 
 * Runs without Lighter connection initially
 * Provides mock market data and agent context to Firebase
 * Can be easily extended when Lighter is available
 */

const axios = require('axios');
const admin = require('firebase-admin');
const { Wallet } = require('ethers');

// Load environment variables
require('dotenv').config();

// Firebase Admin configuration
let serviceAccount;
try {
  // Try to parse service account from environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
} catch (error) {
  console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT_KEY, will try alternative auth methods');
  serviceAccount = null;
}

class LighterStandaloneService {
  constructor() {
    this.isRunning = false;
    this.db = null;
    this.lighterClient = null;
    this.cachedAuthToken = null; // Cache auth tokens since they last up to 8 hours
    
    // Lighter configuration - following SignerClient pattern
    this.lighterConfig = {
      baseUrl: process.env.NEXT_PUBLIC_LIGHTER_BASE_URL || 'https://testnet.zklighter.elliot.ai',
      apiKeyPrivateKey: process.env.LIGHTER_API_KEY_PRIVATE_KEY,
      apiKeyPublicKey: process.env.LIGHTER_API_KEY_PUBLIC_KEY,
      accountIndex: parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
      apiKeyIndex: parseInt(process.env.LIGHTER_API_KEY_INDEX || '2') // Updated to match your .env
    };
    
    // Validate configuration
    this.validateConfiguration();
    
    console.log('⚙️ Lighter Configuration:', {
      baseUrl: this.lighterConfig.baseUrl,
      accountIndex: this.lighterConfig.accountIndex,
      apiKeyIndex: this.lighterConfig.apiKeyIndex,
      hasPrivateKey: !!this.lighterConfig.apiKeyPrivateKey,
      privateKeyLength: this.lighterConfig.apiKeyPrivateKey?.length
    });
    
    // Initialize Firebase
    this.initializeFirebase();
  }

  validateConfiguration() {
    if (!this.lighterConfig.apiKeyPrivateKey) {
      console.log('⚠️ LIGHTER_API_KEY_PRIVATE_KEY not configured - service will run in read-only mode');
      return;
    }

    // Check private key format - should be 64 hex characters (without 0x prefix)
    let privateKey = this.lighterConfig.apiKeyPrivateKey.trim();
    if (privateKey.startsWith('0x')) {
      privateKey = privateKey.slice(2);
    }

    console.log('🔐 Validating private key format...');
    console.log('🔐 Raw private key length:', this.lighterConfig.apiKeyPrivateKey.length);
    console.log('🔐 Processed key length:', privateKey.length);

    // Standard private key should be 64 hex characters
    if (privateKey.length === 64 && /^[0-9a-fA-F]+$/.test(privateKey)) {
      console.log('✅ Standard private key format detected (64 hex chars)');
    } else if (privateKey.length > 64) {
      console.log('⚠️ Extended private key format detected - this might be an API key rather than a wallet private key');
      console.log('⚠️ Please verify with Lighter documentation that this is the correct format');
    } else {
      console.error('❌ Invalid private key format detected');
      console.error('❌ Expected: 64 hex characters or extended API key format');
      console.error('❌ Current length:', privateKey.length);
    }
  }

  initializeFirebase() {
    try {
      if (!admin.apps.length) {
        if (serviceAccount && serviceAccount.project_id) {
          // Use service account credentials
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
          console.log('✅ Firebase Admin initialized with service account');
        } else {
          // Fallback: use default credentials (for Railway deployment)
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hailmary-3ff6c'
          });
          console.log('✅ Firebase Admin initialized with default credentials');
        }
      }
      
      this.db = admin.firestore();
      console.log('✅ Firestore connected');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      process.exit(1);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Service already running');
      return;
    }

    console.log('🚀 Starting Lighter Standalone Service...');
    this.isRunning = true;

    // Save service status
    await this.updateServiceStatus('starting');

    // Start data generation and health monitoring
    this.startMarketDataUpdates();
    this.startAgentContextUpdates();
    this.startLighterDataUpdates(); // Add Lighter trading data
    this.startHealthCheck();

    console.log('✅ Service started in standalone mode');
    await this.updateServiceStatus('running');

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  startMarketDataUpdates() {
    // Fetch real market data every 60 seconds
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        // Fetch real BTC price from CoinGecko
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true', {
          timeout: 10000
        });

        if (response.data) {
          const marketData = {
            btcPrice: response.data.bitcoin.usd,
            ethPrice: response.data.ethereum.usd,
            btcChange24h: response.data.bitcoin.usd_24h_change || 0,
            ethChange24h: response.data.ethereum.usd_24h_change || 0,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdate: new Date().toISOString()
          };

          await this.saveMarketData(marketData);
          console.log(`📊 Market updated: BTC $${marketData.btcPrice.toFixed(0)}, ETH $${marketData.ethPrice.toFixed(0)}`);
        }

      } catch (error) {
        console.error('❌ Error fetching market data:', error.message);
      }
    }, 60000);

    console.log('📈 Started market data updates (60s interval)');
  }

  startAgentContextUpdates() {
    // Update agent context every 120 seconds
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Fetch Fear & Greed Index
        const fearGreedResponse = await axios.get('https://api.alternative.me/fng/', {
          timeout: 10000
        });

        const fearGreedValue = fearGreedResponse.data?.data?.[0]?.value || 50;

        // Calculate mock funding rate and other indicators
        const fundingRate = (Math.random() - 0.5) * 0.02; // -1% to +1%
        const vix = 15 + Math.random() * 20; // 15-35 range

        const agentContext = {
          fearGreed: parseInt(fearGreedValue),
          fundingRate: fundingRate,
          vix: vix,
          marketSentiment: fearGreedValue > 75 ? 'extreme_greed' : 
                          fearGreedValue > 55 ? 'greed' :
                          fearGreedValue > 45 ? 'neutral' :
                          fearGreedValue > 25 ? 'fear' : 'extreme_fear',
          trend: this.calculateTrend(),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdate: new Date().toISOString()
        };

        await this.db.collection('agentContext').doc('market').set(agentContext, { merge: true });
        console.log(`🤖 Agent context updated: F&G=${fearGreedValue}, Funding=${(fundingRate*100).toFixed(3)}%`);

      } catch (error) {
        console.error('❌ Error updating agent context:', error.message);
      }
    }, 120000);

    console.log('🤖 Started agent context updates (120s interval)');
  }

  startLighterDataUpdates() {
    // Update Lighter trading data every 30 seconds
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.fetchLighterData();
      } catch (error) {
        console.error('❌ Error fetching Lighter data:', error.message);
      }
    }, 30000);

    console.log('⚡ Started Lighter data updates (30s interval)');
  }

  async fetchLighterData() {
    if (!this.lighterConfig.apiKeyPrivateKey) {
      console.log('⚠️ Lighter API key not configured, skipping trading data');
      return;
    }

    try {
      console.log('🔄 Starting Lighter data fetch cycle...');
      
      // Get account data
      console.log('🏦 Fetching Lighter account data...');
      const accountData = await this.getLighterAccount();
      if (accountData) {
        console.log('💾 Saving account data to Firebase...');
        await this.saveLighterAccountData(accountData);
      } else {
        console.log('⚠️ No account data returned from Lighter API');
      }

      // Get positions and orders
      console.log('📊 Fetching Lighter trading data...');
      const tradingData = await this.getLighterTradingData();
      if (tradingData) {
        console.log('💾 Saving trading data to Firebase...');
        await this.saveLighterTradingData(tradingData);
      } else {
        console.log('⚠️ No trading data returned from Lighter API');
      }

      console.log('✅ Lighter data fetch cycle complete');

    } catch (error) {
      console.error('❌ Lighter API error:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
  }

  async createLighterAuthToken() {
    if (!this.lighterConfig.apiKeyPrivateKey) {
      throw new Error('Lighter API key not configured');
    }

    // Check if we have a cached token that's still valid
    if (this.cachedAuthToken && this.cachedAuthToken.expiry > Math.floor(Date.now() / 1000) + 300) {
      console.log('🔐 Using cached auth token (expires at:', new Date(this.cachedAuthToken.expiry * 1000).toISOString() + ')');
      return this.cachedAuthToken;
    }

    console.log('🔐 Creating new Lighter authentication token...');
    console.log('🔐 Account Index:', this.lighterConfig.accountIndex);
    console.log('🔐 API Key Index:', this.lighterConfig.apiKeyIndex);
    
    // Following Lighter auth token structure: {expiry_unix}:{account_index}:{api_key_index}:{random_hex}
    const currentTime = Math.floor(Date.now() / 1000);
    const expiry = currentTime + (6 * 60 * 60); // 6 hours (under the 8-hour max)
    
    // Generate random hex (32 characters)
    const randomHex = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32);
    
    // Create auth token in the format specified by Lighter docs
    const authToken = `${expiry}:${this.lighterConfig.accountIndex}:${this.lighterConfig.apiKeyIndex}:${randomHex}`;
    
    console.log('🔐 Generated auth token structure:', authToken);
    console.log('🔐 Token expires at:', new Date(expiry * 1000).toISOString());
    
    // For signing, we still need the actual private key
    let privateKey = this.lighterConfig.apiKeyPrivateKey.trim();
    
    try {
      // Handle the extended API key format (80 chars) from Lighter
      if (privateKey.length === 80 && /^[0-9a-fA-F]+$/.test(privateKey)) {
        console.log('🔐 Detected Lighter extended API key format (80 characters)');
        
        // For Lighter's extended API keys, we may need to extract the actual signing key
        // The 80-character format might contain both the key and additional data
        
        // Try using the first 64 characters as the signing key
        const signingKey = `0x${privateKey.slice(0, 64)}`;
        
        try {
          const wallet = new Wallet(signingKey);
          
          // Sign the auth token with the extracted key
          const signature = await wallet.signMessage(authToken);
          
          console.log('🔐 Extended API key authentication successful');
          console.log('🔑 Wallet address:', wallet.address);
          
          const authResponse = {
            authToken,
            signature,
            timestamp: currentTime,
            expiry,
            address: wallet.address,
            apiKeyIndex: this.lighterConfig.apiKeyIndex,
            accountIndex: this.lighterConfig.accountIndex,
            keyFormat: 'extended'
          };
          
          // Cache the token for reuse
          this.cachedAuthToken = authResponse;
          return authResponse;
          
        } catch (walletError) {
          console.log('🔐 Extended key first 64 chars failed, trying alternative approach...');
          
          // If first 64 chars don't work, try the full key as an API key
          const authResponse = {
            authToken,
            apiKey: privateKey,
            timestamp: currentTime,
            expiry,
            apiKeyIndex: this.lighterConfig.apiKeyIndex,
            accountIndex: this.lighterConfig.accountIndex,
            keyFormat: 'extended-direct'
          };
          
          // Cache the token for reuse
          this.cachedAuthToken = authResponse;
          return authResponse;
        }
        
      } else if (privateKey.length === 64 && /^[0-9a-fA-F]+$/.test(privateKey)) {
        // Standard wallet private key (64 hex chars)
        if (privateKey.startsWith('0x')) {
          privateKey = privateKey.slice(2);
        }
        
        privateKey = `0x${privateKey}`;
        const wallet = new Wallet(privateKey);
        
        // Sign the auth token
        const signature = await wallet.signMessage(authToken);
        
        console.log('🔐 Standard private key authentication successful');
        console.log('🔑 Wallet address:', wallet.address);
        
        const authResponse = {
          authToken,
          signature,
          timestamp: currentTime,
          expiry,
          address: wallet.address,
          apiKeyIndex: this.lighterConfig.apiKeyIndex,
          accountIndex: this.lighterConfig.accountIndex,
          keyFormat: 'standard'
        };
        
        // Cache the token for reuse
        this.cachedAuthToken = authResponse;
        return authResponse;
        
      } else {
        // Unknown format - try using as direct API key
        console.log('🔐 Unknown key format (length: ' + privateKey.length + '), using as direct API key');
        
        const authResponse = {
          authToken,
          apiKey: privateKey,
          timestamp: currentTime,
          expiry,
          apiKeyIndex: this.lighterConfig.apiKeyIndex,
          accountIndex: this.lighterConfig.accountIndex,
          keyFormat: 'unknown'
        };
        
        // Cache the token for reuse
        this.cachedAuthToken = authResponse;
        return authResponse;
      }
      
    } catch (error) {
      console.error('❌ Failed to create authentication token:', error.message);
      throw error;
    }
  }

  async getLighterAccount() {
    try {
      console.log(`🔐 Creating Lighter auth token...`);
      const auth = await this.createLighterAuthToken();
      
      const url = `${this.lighterConfig.baseUrl}/api/v1/accounts/${this.lighterConfig.accountIndex}`;
      console.log(`🌐 Fetching Lighter account from: ${url}`);
      
      // Build headers based on Lighter authentication requirements
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.authToken}` // Use the auth token as specified in docs
      };
      
      if (auth.signature) {
        // If we have a signature, include it (wallet-based authentication)
        headers['X-Signature'] = auth.signature;
        headers['X-Address'] = auth.address;
        console.log(`🔑 Using signed auth token with wallet: ${auth.address} (${auth.keyFormat} format)`);
      } else if (auth.apiKey) {
        // Direct API key authentication (for extended keys or fallback)
        headers['X-API-Key'] = auth.apiKey;
        console.log(`🔑 Using direct API key authentication (${auth.keyFormat} format)`);
      }
      
      // Always include these based on the auth token structure
      headers['X-Account-Index'] = auth.accountIndex;
      headers['X-API-Key-Index'] = auth.apiKeyIndex;
      
      console.log('📋 Request headers:', Object.keys(headers).join(', '));
      
      const response = await axios.get(url, {
        headers,
        timeout: 10000
      });

      console.log(`✅ Lighter account response status: ${response.status}`);
      console.log(`💰 Account data:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get Lighter account:', error.message);
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
        console.error('❌ Response headers:', error.response.headers);
      }
      return null;
    }
  }

  async getLighterTradingData() {
    try {
      const auth = await this.createLighterAuthToken();
      
      // Get positions and orders in parallel
      const [positionsResponse, ordersResponse] = await Promise.all([
        axios.get(`${this.lighterConfig.baseUrl}/api/v1/accounts/${this.lighterConfig.accountIndex}/positions`, {
          headers: {
            'Authorization': `Bearer ${auth.signature}`,
            'X-Timestamp': auth.timestamp,
            'X-Expiry': auth.expiry,
            'X-Address': auth.address
          },
          timeout: 10000
        }).catch(() => ({ data: [] })),
        
        axios.get(`${this.lighterConfig.baseUrl}/api/v1/accounts/${this.lighterConfig.accountIndex}/orders`, {
          headers: {
            'Authorization': `Bearer ${auth.signature}`,
            'X-Timestamp': auth.timestamp,
            'X-Expiry': auth.expiry,
            'X-Address': auth.address
          },
          timeout: 10000
        }).catch(() => ({ data: [] }))
      ]);

      return {
        positions: positionsResponse.data || [],
        orders: ordersResponse.data || []
      };
    } catch (error) {
      console.error('Failed to get Lighter trading data:', error.message);
      return null;
    }
  }

  async saveLighterAccountData(accountData) {
    try {
      await this.db.collection('lighterData').doc('account').set({
        ...accountData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: new Date().toISOString()
      }, { merge: true });

      console.log(`💰 Lighter account updated: Balance=${accountData.balance || 'N/A'}`);
    } catch (error) {
      console.error('❌ Error saving Lighter account:', error);
    }
  }

  async saveLighterTradingData(tradingData) {
    try {
      await this.db.collection('lighterData').doc('trading').set({
        positions: tradingData.positions,
        orders: tradingData.orders,
        positionCount: tradingData.positions?.length || 0,
        orderCount: tradingData.orders?.length || 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: new Date().toISOString()
      }, { merge: true });

      console.log(`📊 Lighter trading updated: ${tradingData.positions?.length || 0} positions, ${tradingData.orders?.length || 0} orders`);
    } catch (error) {
      console.error('❌ Error saving Lighter trading data:', error);
    }
  }

  async saveMarketData(data) {
    try {
      await this.db.collection('marketData').doc('latest').set(data, { merge: true });
    } catch (error) {
      console.error('❌ Error saving market data:', error);
    }
  }

  calculateTrend() {
    // Simple mock trend calculation
    const trends = ['bullish', 'bearish', 'sideways'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  startHealthCheck() {
    // Health check every 5 minutes
    setInterval(async () => {
      await this.updateServiceStatus('running', {
        lastPing: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        mode: 'standalone'
      });
    }, 300000);

    console.log('❤️ Started health monitoring (5m interval)');
  }

  async updateServiceStatus(status, extra = {}) {
    try {
      await this.db.collection('serviceStatus').doc('lighterService').set({
        status,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: new Date().toISOString(),
        pid: process.pid,
        mode: 'standalone',
        ...extra
      }, { merge: true });

    } catch (error) {
      console.error('❌ Error updating service status:', error);
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down Lighter Standalone Service...');
    this.isRunning = false;

    await this.updateServiceStatus('stopped');
    console.log('✅ Service stopped gracefully');
    process.exit(0);
  }
}

// Start the service
const service = new LighterStandaloneService();
service.start().catch(error => {
  console.error('❌ Failed to start service:', error);
  process.exit(1);
});

module.exports = LighterStandaloneService;