// Trading Bot WebSocket Service
// Connects to the Python bot and receives real-time updates

class TradingBotService {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced to fail faster
    this.reconnectDelay = 3000;
    this.isConnected = false;
    this.botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'ws://localhost:3002';
    this.shouldReconnect = true;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Already connected to trading bot');
      return;
    }

    console.log(`Connecting to live market data feed at ${this.botUrl}...`);
    
    try {
      this.ws = new WebSocket(this.botUrl);

      this.ws.onopen = () => {
        console.log('✅ Connected to live market data (paper trading mode)');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifySubscribers('connected', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleBotUpdate(data);
        } catch (error) {
          console.error('Error parsing bot message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Trading bot connection error:', error);
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.log('Disconnected from trading bot');
        this.isConnected = false;
        this.notifySubscribers('disconnected', { connected: false });
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to trading bot:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Live market data not available - using simulated data');
      this.notifySubscribers('simulated_mode', { 
        message: 'Bot offline - displaying simulated paper trading data' 
      });
      // Reset for future manual reconnection attempts
      this.reconnectAttempts = 0;
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to connect to bot... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  handleBotUpdate(data) {
    // Map bot data to UI format
    const mappedData = this.mapBotDataToUI(data);
    
    // Notify all subscribers
    this.notifySubscribers('update', mappedData);
  }

  mapBotDataToUI(botData) {
    // Map Python bot data structure to your UI's TradingOverlay format
    if (botData.type === 'update') {
      return {
        fundBalance: botData.performance?.balance || 0,
        dailyPnl: botData.performance?.daily_pnl || 0,
        dailyPnlPercent: botData.performance?.daily_pnl_percent || 0,
        totalPnl: botData.performance?.pnl || 0,
        winStreak: botData.performance?.streak || 0,
        
        // Map positions
        activePositions: (botData.positions || []).map(pos => ({
          symbol: pos.symbol,
          side: pos.side,
          size: pos.size,
          entry: pos.entry,
          current: pos.current,
          pnl: pos.pnl,
          pnlPercent: pos.pnl_percent
        })),
        
        // Map macro data
        macroData: botData.analysis?.macro || {
          marketRegime: 'NEUTRAL',
          riskScore: 50,
          fedRate: 5.5,
          fedRateChange: 0,
          dxy: 103,
          dxyChange: 0,
          vix: 15,
          vixChange: 0,
          fearGreed: 50,
          fearGreedText: 'Neutral',
          btcDominance: 52,
          signals: []
        },
        
        // Map recent trades
        recentTrades: (botData.recent_trades || []).map(trade => ({
          time: new Date(trade.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
          }),
          symbol: trade.symbol,
          side: trade.side.toUpperCase(),
          amount: trade.amount,
          price: trade.price,
          pnl: trade.pnl > 0 ? `+$${trade.pnl}` : `-$${Math.abs(trade.pnl)}`,
          status: trade.pnl > trade.threshold ? 'exceptional' : 
                  trade.pnl > 0 ? 'profit' : 'loss'
        }))
      };
    }
    
    return botData;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    // If already connected, send current state
    if (this.isConnected) {
      callback('connected', { connected: true });
    }
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(type, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(type, data);
      } catch (error) {
        console.error('Subscriber notification error:', error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  // Send commands to the bot
  sendCommand(command, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Not connected to trading bot');
      return;
    }

    const message = JSON.stringify({
      command,
      ...params
    });

    this.ws.send(message);
  }

  // Specific commands
  startTrading() {
    this.sendCommand('start_trading');
  }

  stopTrading() {
    this.sendCommand('stop_trading');
  }

  closePosition(symbol) {
    this.sendCommand('close_position', { symbol });
  }

  updateSettings(settings) {
    this.sendCommand('update_settings', settings);
  }

  getStatus() {
    this.sendCommand('get_status');
  }
}

// Create singleton instance
const tradingBotService = new TradingBotService();

export default tradingBotService;