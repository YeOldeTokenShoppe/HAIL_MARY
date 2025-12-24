// Lighter WebSocket Client for real-time data
import { EventEmitter } from 'events';

export class LighterWebSocketClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.wsUrl = config.wsUrl || process.env.NEXT_PUBLIC_LIGHTER_WS_URL || 'wss://testnet.zklighter.elliot.ai/ws';
    this.authToken = null;
    this.ws = null;
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectDelay = config.reconnectDelay || 1000;
    this.pingInterval = null;
    this.isConnected = false;
  }

  // Connect to WebSocket
  async connect(authToken) {
    this.authToken = authToken;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected to Lighter');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Authenticate
          this.authenticate();
          
          // Re-subscribe to previous subscriptions
          this.resubscribe();
          
          // Start ping interval
          this.startPing();
          
          this.emit('connected');
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopPing();
          this.emit('disconnected');
          
          // Attempt reconnection
          this.reconnect();
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Authenticate with the server
  authenticate() {
    if (!this.authToken || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.send({
      type: 'auth',
      data: this.authToken
    });
  }

  // Handle incoming messages
  handleMessage(data) {
    const { type, channel, payload } = data;
    
    switch (type) {
      case 'auth_success':
        console.log('WebSocket authentication successful');
        this.emit('authenticated');
        break;
        
      case 'auth_error':
        console.error('WebSocket authentication failed:', payload);
        this.emit('auth_error', payload);
        break;
        
      case 'orderbook':
        this.emit('orderbook', {
          market: channel,
          data: payload
        });
        break;
        
      case 'trades':
        this.emit('trades', {
          market: channel,
          data: payload
        });
        break;
        
      case 'account':
        this.emit('account', payload);
        break;
        
      case 'positions':
        this.emit('positions', payload);
        break;
        
      case 'orders':
        this.emit('orders', payload);
        break;
        
      case 'ticker':
        this.emit('ticker', {
          market: channel,
          data: payload
        });
        break;
        
      case 'error':
        console.error('WebSocket error message:', payload);
        this.emit('message_error', payload);
        break;
        
      case 'pong':
        // Pong received
        break;
        
      default:
        // Unknown message type
        this.emit('message', data);
    }
  }

  // Subscribe to orderbook updates
  subscribeOrderbook(market, depth = 10) {
    const subscription = {
      type: 'subscribe',
      channel: 'orderbook',
      market,
      params: { depth }
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Subscribe to trades
  subscribeTrades(market) {
    const subscription = {
      type: 'subscribe',
      channel: 'trades',
      market
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Subscribe to ticker updates
  subscribeTicker(market) {
    const subscription = {
      type: 'subscribe',
      channel: 'ticker',
      market
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Subscribe to account updates
  subscribeAccount() {
    const subscription = {
      type: 'subscribe',
      channel: 'account'
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Subscribe to positions updates
  subscribePositions() {
    const subscription = {
      type: 'subscribe',
      channel: 'positions'
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Subscribe to orders updates
  subscribeOrders() {
    const subscription = {
      type: 'subscribe',
      channel: 'orders'
    };
    
    this.subscriptions.add(JSON.stringify(subscription));
    this.send(subscription);
  }

  // Unsubscribe from a channel
  unsubscribe(channel, market = null) {
    const unsubscribe = {
      type: 'unsubscribe',
      channel,
      ...(market && { market })
    };
    
    // Remove from subscriptions
    this.subscriptions.forEach(sub => {
      const parsed = JSON.parse(sub);
      if (parsed.channel === channel && (!market || parsed.market === market)) {
        this.subscriptions.delete(sub);
      }
    });
    
    this.send(unsubscribe);
  }

  // Send message to server
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queuing message');
      return;
    }
    
    this.ws.send(JSON.stringify(data));
  }

  // Re-subscribe to all previous subscriptions
  resubscribe() {
    this.subscriptions.forEach(sub => {
      const subscription = JSON.parse(sub);
      this.send(subscription);
    });
  }

  // Start ping interval
  startPing() {
    this.stopPing();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  // Stop ping interval
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Reconnect logic
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.authToken) {
        this.connect(this.authToken);
      }
    }, delay);
  }

  // Disconnect from WebSocket
  disconnect() {
    this.stopPing();
    this.subscriptions.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected');
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions).map(s => JSON.parse(s))
    };
  }
}

// Helper function to create and manage WebSocket connection
export class LighterWebSocketManager {
  constructor(lighterClient) {
    this.client = lighterClient;
    this.wsClient = null;
    this.marketData = new Map();
    this.accountData = null;
    this.positions = new Map();
    this.orders = new Map();
  }

  // Initialize WebSocket connection
  async initialize() {
    // Get auth token from client
    const authToken = await this.client.createAuthToken();
    
    // Create WebSocket client
    this.wsClient = new LighterWebSocketClient();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Connect
    await this.wsClient.connect(authToken);
    
    // Subscribe to default channels
    this.wsClient.subscribeAccount();
    this.wsClient.subscribePositions();
    this.wsClient.subscribeOrders();
    
    return this.wsClient;
  }

  // Set up event handlers
  setupEventHandlers() {
    // Orderbook updates
    this.wsClient.on('orderbook', ({ market, data }) => {
      if (!this.marketData.has(market)) {
        this.marketData.set(market, {});
      }
      
      const marketInfo = this.marketData.get(market);
      marketInfo.orderbook = data;
      marketInfo.lastUpdate = Date.now();
    });

    // Trade updates
    this.wsClient.on('trades', ({ market, data }) => {
      if (!this.marketData.has(market)) {
        this.marketData.set(market, {});
      }
      
      const marketInfo = this.marketData.get(market);
      marketInfo.trades = data;
      marketInfo.lastTradeUpdate = Date.now();
    });

    // Ticker updates
    this.wsClient.on('ticker', ({ market, data }) => {
      if (!this.marketData.has(market)) {
        this.marketData.set(market, {});
      }
      
      const marketInfo = this.marketData.get(market);
      marketInfo.ticker = data;
      marketInfo.lastTickerUpdate = Date.now();
    });

    // Account updates
    this.wsClient.on('account', (data) => {
      this.accountData = data;
    });

    // Position updates
    this.wsClient.on('positions', (data) => {
      data.forEach(pos => {
        this.positions.set(pos.market, pos);
      });
    });

    // Order updates
    this.wsClient.on('orders', (data) => {
      data.forEach(order => {
        this.orders.set(order.client_order_index, order);
      });
    });
  }

  // Subscribe to market data
  subscribeToMarket(market) {
    this.wsClient.subscribeOrderbook(market);
    this.wsClient.subscribeTrades(market);
    this.wsClient.subscribeTicker(market);
  }

  // Get market data
  getMarketData(market) {
    return this.marketData.get(market);
  }

  // Get all market data
  getAllMarketData() {
    return Object.fromEntries(this.marketData);
  }

  // Get account info
  getAccountInfo() {
    return {
      account: this.accountData,
      positions: Array.from(this.positions.values()),
      orders: Array.from(this.orders.values())
    };
  }

  // Disconnect
  disconnect() {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }
}

export default LighterWebSocketClient;