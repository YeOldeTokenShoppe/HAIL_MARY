// API route for Lighter features/trading operations
import { getLighterTradingBot } from '../../lighter/features/trading';
import { LighterWebSocketManager } from '../../lighter/websocket';

let bot = null;
let wsManager = null;

async function initializeBot() {
  if (!bot) {
    console.log('Initializing Lighter bot...');
    console.log('Environment check:', {
      hasBaseUrl: !!process.env.NEXT_PUBLIC_LIGHTER_BASE_URL,
      hasPrivateKey: !!process.env.LIGHTER_API_KEY_PRIVATE_KEY,
      accountIndex: process.env.LIGHTER_ACCOUNT_INDEX,
      apiKeyIndex: process.env.LIGHTER_API_KEY_INDEX
    });
    
    if (!process.env.LIGHTER_API_KEY_PRIVATE_KEY) {
      throw new Error('LIGHTER_API_KEY_PRIVATE_KEY not found in environment variables');
    }
    
    bot = getLighterTradingBot({
      baseUrl: process.env.NEXT_PUBLIC_LIGHTER_BASE_URL,
      apiKeyPrivateKey: process.env.LIGHTER_API_KEY_PRIVATE_KEY,
      accountIndex: parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
      apiKeyIndex: parseInt(process.env.LIGHTER_API_KEY_INDEX || '3')
    });
    
    console.log('Bot created, initializing...');
    await bot.initialize();
    console.log('Bot initialized successfully');
    
    wsManager = new LighterWebSocketManager(bot.client);
    console.log('Initializing WebSocket manager...');
    await wsManager.initialize();
    console.log('WebSocket manager initialized');
  }
  return { bot, wsManager };
}

export default async function handler(req, res) {
  const { method } = req;
  
  try {
    console.log(`API route called: ${method}`);
    await initializeBot();
    
    switch (method) {
      case 'GET':
        // Get account state
        const state = await bot.syncAccountState();
        const performance = bot.getPerformanceMetrics();
        
        return res.status(200).json({
          success: true,
          data: {
            ...state,
            performance,
            connected: true
          }
        });
        
      case 'POST':
        const { action, params } = req.body;
        
        switch (action) {
          case 'createMarketOrder':
            const marketOrder = await bot.createMarketOrder(
              params.market,
              params.side,
              params.size
            );
            return res.status(200).json({ success: true, data: marketOrder });
            
          case 'createLimitOrder':
            const limitOrder = await bot.createLimitOrder(
              params.market,
              params.side,
              params.size,
              params.price
            );
            return res.status(200).json({ success: true, data: limitOrder });
            
          case 'cancelOrder':
            const cancel = await bot.cancelOrder(params.orderId);
            return res.status(200).json({ success: true, data: cancel });
            
          case 'closePosition':
            const close = await bot.closePosition(params.market);
            return res.status(200).json({ success: true, data: close });
            
          case 'analyzeMarket':
            const analysis = await bot.analyzeMarket(params.market);
            return res.status(200).json({ success: true, data: analysis });
            
          case 'executeStrategy':
            const strategy = await bot.executeStrategy(params.markets);
            return res.status(200).json({ success: true, data: strategy });
            
          default:
            return res.status(400).json({ 
              success: false, 
              error: `Unknown action: ${action}` 
            });
        }
        
      default:
        return res.status(405).json({ 
          success: false, 
          error: 'Method not allowed' 
        });
    }
  } catch (error) {
    console.error('Lighter API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}