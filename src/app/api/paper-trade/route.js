/**
 * Paper Trading API Route
 *
 * Handles simulated trading operations:
 * - POST: Open or close positions
 * - GET: Get account status and positions
 */

import { NextResponse } from 'next/server';
import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  increment
} from '@/lib/firebaseServer';

// Configuration
const INITIAL_BALANCE = 10000;
const DEFAULT_LEVERAGE = 5;
const LIQUIDATION_THRESHOLD = 0.80; // 80% margin loss
const MAX_SLIPPAGE = 0.002; // 0.2%

// CoinGecko coin IDs
const COIN_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple'
};

/**
 * Fetch current price from CoinGecko
 */
async function getPrice(symbol) {
  const coinId = COIN_IDS[symbol.toUpperCase()];
  if (!coinId) return null;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { next: { revalidate: 30 } } // Cache for 30 seconds
    );
    const data = await response.json();
    return data[coinId]?.usd || null;
  } catch (error) {
    console.error('Price fetch error:', error);
    return null;
  }
}

/**
 * Calculate unrealized P&L
 */
function calculatePnL(position, currentPrice) {
  const direction = position.direction === 'LONG' ? 1 : -1;
  const priceDelta = currentPrice - position.entryPrice;
  const pnl = direction * priceDelta * position.size;
  const pnlPercent = (pnl / position.margin) * 100;
  return { pnl, pnlPercent };
}

/**
 * GET: Fetch account status and positions
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      // Get account balance
      const accountRef = doc(db, 'simulatedAccount', 'balance');
      const accountDoc = await getDoc(accountRef);

      let account = accountDoc.exists() ? accountDoc.data() : null;

      // Initialize account if it doesn't exist
      if (!account) {
        account = {
          initial: INITIAL_BALANCE,
          current: INITIAL_BALANCE,
          totalRealizedPnL: 0,
          totalUnrealizedPnL: 0,
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          maxDrawdown: 0,
          peakBalance: INITIAL_BALANCE,
          lastUpdated: new Date().toISOString()
        };
        await setDoc(accountRef, account);
      }

      // Get open positions
      const positionsQuery = query(
        collection(db, 'simulatedPositions'),
        where('status', '==', 'OPEN')
      );
      const positionsSnapshot = await getDocs(positionsQuery);

      const positions = [];
      let totalUnrealizedPnL = 0;

      for (const docSnapshot of positionsSnapshot.docs) {
        const position = { id: docSnapshot.id, ...docSnapshot.data() };

        // Update current price and P&L
        const currentPrice = await getPrice(position.symbol);
        if (currentPrice) {
          const { pnl, pnlPercent } = calculatePnL(position, currentPrice);
          position.currentPrice = currentPrice;
          position.unrealizedPnL = pnl;
          position.unrealizedPnLPercent = pnlPercent;
          totalUnrealizedPnL += pnl;
        }

        positions.push(position);
      }

      return NextResponse.json({
        success: true,
        account: {
          ...account,
          totalUnrealizedPnL
        },
        positions,
        prices: {
          BTC: await getPrice('BTC'),
          ETH: await getPrice('ETH'),
          SOL: await getPrice('SOL'),
          XRP: await getPrice('XRP')
        }
      });
    }

    if (action === 'history') {
      const limitNum = parseInt(searchParams.get('limit') || '20');

      const tradesQuery = query(
        collection(db, 'simulatedTradeHistory'),
        orderBy('timestamp', 'desc'),
        limit(limitNum)
      );
      const tradesSnapshot = await getDocs(tradesQuery);

      const trades = tradesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return NextResponse.json({ success: true, trades });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Open or close positions
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, symbol, direction, size, leverage = DEFAULT_LEVERAGE, positionId } = body;

    // Validate action
    if (!['open', 'close', 'reset'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use: open, close, or reset'
      }, { status: 400 });
    }

    // =========================================
    // RESET ACCOUNT
    // =========================================
    if (action === 'reset') {
      // Delete all simulated positions
      const positionsSnapshot = await getDocs(collection(db, 'simulatedPositions'));
      const deletePromises = positionsSnapshot.docs.map(doc =>
        setDoc(doc.ref, { status: 'DELETED', deletedAt: new Date().toISOString() }, { merge: true })
      );
      await Promise.all(deletePromises);

      // Delete all simulated trade history
      const simTradesSnapshot = await getDocs(collection(db, 'simulatedTradeHistory'));
      for (const docSnap of simTradesSnapshot.docs) {
        await setDoc(docSnap.ref, { deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
      }

      // Delete all trades (for Mainnet Readiness metrics)
      const tradesSnapshot = await getDocs(collection(db, 'trades'));
      for (const docSnap of tradesSnapshot.docs) {
        await setDoc(docSnap.ref, { deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
      }

      // Delete all decisions (for scoring history)
      const decisionsSnapshot = await getDocs(collection(db, 'decisions'));
      for (const docSnap of decisionsSnapshot.docs) {
        await setDoc(docSnap.ref, { deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
      }

      // Delete RL80 executions if they exist
      let rl80Count = 0;
      try {
        const rl80Snapshot = await getDocs(collection(db, 'lighterData/trades/rl80_executions'));
        for (const docSnap of rl80Snapshot.docs) {
          await setDoc(docSnap.ref, { deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
          rl80Count++;
        }
      } catch (e) {
        // Collection may not exist
      }

      // Reset account
      const accountRef = doc(db, 'simulatedAccount', 'balance');
      const newAccount = {
        initial: INITIAL_BALANCE,
        current: INITIAL_BALANCE,
        totalRealizedPnL: 0,
        totalUnrealizedPnL: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        maxDrawdown: 0,
        peakBalance: INITIAL_BALANCE,
        lastUpdated: new Date().toISOString(),
        resetAt: new Date().toISOString()
      };
      await setDoc(accountRef, newAccount);

      // Reset system start date for Mainnet Readiness "Days Live"
      const systemRef = doc(db, 'systemConfig', 'mainnet');
      await setDoc(systemRef, {
        startDate: new Date().toISOString(),
        description: 'Mainnet readiness tracking start date',
        resetAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: `Account reset to $${INITIAL_BALANCE.toLocaleString()}. All trades and decisions cleared.`,
        account: newAccount,
        cleared: {
          positions: positionsSnapshot.docs.length,
          simTrades: simTradesSnapshot.docs.length,
          trades: tradesSnapshot.docs.length,
          decisions: decisionsSnapshot.docs.length
        }
      });
    }

    // =========================================
    // OPEN POSITION
    // =========================================
    if (action === 'open') {
      // Validate inputs
      if (!symbol || !direction || !size) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: symbol, direction, size'
        }, { status: 400 });
      }

      const upperSymbol = symbol.toUpperCase();
      const upperDirection = direction.toUpperCase();

      if (!['BTC', 'ETH', 'SOL', 'XRP'].includes(upperSymbol)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid symbol. Supported: BTC, ETH, SOL, XRP'
        }, { status: 400 });
      }

      if (!['LONG', 'SHORT'].includes(upperDirection)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid direction. Use: LONG or SHORT'
        }, { status: 400 });
      }

      // Get current price
      const currentPrice = await getPrice(upperSymbol);
      if (!currentPrice) {
        return NextResponse.json({
          success: false,
          error: `Could not fetch price for ${upperSymbol}`
        }, { status: 500 });
      }

      // Calculate margin
      const notionalValue = size * currentPrice;
      const marginRequired = notionalValue / leverage;

      // Check available balance
      const accountRef = doc(db, 'simulatedAccount', 'balance');
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.exists() ? accountDoc.data() : { current: INITIAL_BALANCE };

      // Get margin in use from open positions
      const openPositionsQuery = query(
        collection(db, 'simulatedPositions'),
        where('status', '==', 'OPEN')
      );
      const openPositionsSnapshot = await getDocs(openPositionsQuery);
      const marginInUse = openPositionsSnapshot.docs.reduce((sum, doc) =>
        sum + (doc.data().margin || 0), 0
      );

      const availableMargin = account.current - marginInUse;

      if (marginRequired > availableMargin) {
        return NextResponse.json({
          success: false,
          error: `Insufficient margin. Required: $${marginRequired.toFixed(2)}, Available: $${availableMargin.toFixed(2)}`
        }, { status: 400 });
      }

      // Simulate slippage
      const slippage = Math.random() * MAX_SLIPPAGE;
      const fillPrice = upperDirection === 'LONG'
        ? currentPrice * (1 + slippage)
        : currentPrice * (1 - slippage);

      // Create position
      const posId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const position = {
        id: posId,
        symbol: upperSymbol,
        direction: upperDirection,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        size: parseFloat(size),
        leverage: parseInt(leverage),
        margin: marginRequired,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        status: 'OPEN',
        openedAt: new Date().toISOString(),
        closedAt: null,
        realizedPnL: null,
        paperTrade: true
      };

      await setDoc(doc(db, 'simulatedPositions', posId), position);

      // Log trade
      const tradeId = `trade_${Date.now()}`;
      await setDoc(doc(db, 'simulatedTradeHistory', tradeId), {
        id: tradeId,
        positionId: posId,
        action: 'OPEN',
        symbol: upperSymbol,
        direction: upperDirection,
        price: currentPrice,
        fillPrice: fillPrice,
        size: parseFloat(size),
        leverage: parseInt(leverage),
        realizedPnL: null,
        slippage: slippage * 100,
        timestamp: new Date().toISOString(),
        paperTrade: true
      });

      // Update account
      await updateDoc(accountRef, {
        totalTrades: increment(1),
        lastUpdated: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: `Opened ${upperDirection} ${upperSymbol} position`,
        position,
        fillPrice,
        slippage: (slippage * 100).toFixed(3) + '%'
      });
    }

    // =========================================
    // CLOSE POSITION
    // =========================================
    if (action === 'close') {
      if (!positionId) {
        return NextResponse.json({
          success: false,
          error: 'Missing positionId'
        }, { status: 400 });
      }

      // Get position
      const positionRef = doc(db, 'simulatedPositions', positionId);
      const positionDoc = await getDoc(positionRef);

      if (!positionDoc.exists()) {
        return NextResponse.json({
          success: false,
          error: `Position ${positionId} not found`
        }, { status: 404 });
      }

      const position = positionDoc.data();

      if (position.status !== 'OPEN') {
        return NextResponse.json({
          success: false,
          error: `Position is already ${position.status}`
        }, { status: 400 });
      }

      // Get current price
      const currentPrice = await getPrice(position.symbol);
      if (!currentPrice) {
        return NextResponse.json({
          success: false,
          error: `Could not fetch price for ${position.symbol}`
        }, { status: 500 });
      }

      // Simulate slippage (opposite direction)
      const slippage = Math.random() * MAX_SLIPPAGE;
      const fillPrice = position.direction === 'LONG'
        ? currentPrice * (1 - slippage)
        : currentPrice * (1 + slippage);

      // Calculate realized P&L
      const directionMultiplier = position.direction === 'LONG' ? 1 : -1;
      const priceDelta = fillPrice - position.entryPrice;
      const realizedPnL = directionMultiplier * priceDelta * position.size;

      // Update position
      await updateDoc(positionRef, {
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closedPrice: fillPrice,
        currentPrice: fillPrice,
        realizedPnL: realizedPnL,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      });

      // Log trade
      const tradeId = `trade_${Date.now()}`;
      await setDoc(doc(db, 'simulatedTradeHistory', tradeId), {
        id: tradeId,
        positionId: positionId,
        action: 'CLOSE',
        symbol: position.symbol,
        direction: position.direction,
        price: currentPrice,
        fillPrice: fillPrice,
        size: position.size,
        leverage: position.leverage,
        realizedPnL: realizedPnL,
        slippage: slippage * 100,
        timestamp: new Date().toISOString(),
        paperTrade: true
      });

      // Update account balance
      const accountRef = doc(db, 'simulatedAccount', 'balance');
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data();

      const newBalance = account.current + realizedPnL;
      const newPeakBalance = Math.max(account.peakBalance || INITIAL_BALANCE, newBalance);
      const drawdown = newPeakBalance > 0
        ? ((newPeakBalance - newBalance) / newPeakBalance) * 100
        : 0;

      const isWin = realizedPnL >= 0;
      const newWins = (account.wins || 0) + (isWin ? 1 : 0);
      const newLosses = (account.losses || 0) + (isWin ? 0 : 1);
      const totalClosedTrades = newWins + newLosses;

      await updateDoc(accountRef, {
        current: newBalance,
        totalRealizedPnL: (account.totalRealizedPnL || 0) + realizedPnL,
        peakBalance: newPeakBalance,
        maxDrawdown: Math.max(account.maxDrawdown || 0, drawdown),
        wins: newWins,
        losses: newLosses,
        winRate: totalClosedTrades > 0 ? newWins / totalClosedTrades : 0,
        lastUpdated: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: `Closed ${position.direction} ${position.symbol} position`,
        realizedPnL,
        fillPrice,
        slippage: (slippage * 100).toFixed(3) + '%',
        newBalance
      });
    }

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
