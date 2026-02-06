import { NextResponse } from 'next/server';

const RL80_CONTRACT = '0x30D01555d88c76500a82754A1D53cAc082A6CB75';
const INITIAL_SUPPLY_WEI = '80000000000000000000000000000'; // 80B * 10^18

// Cache holder count for 5 minutes
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();

  if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData);
  }

  try {
    // BaseScan V1 API is deprecated and V2 requires paid plan for Base chain.
    // Instead, fetch the token holders iframe page and parse the count.
    const url = `https://basescan.org/token/generic-tokenholders2?a=${RL80_CONTRACT}&s=${INITIAL_SUPPLY_WEI}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RL80-Stats/1.0)',
      },
    });
    const html = await response.text();

    // Page contains "total of X" where X is the holder count
    const match = html.match(/total of ([0-9,]+)/i);
    if (match) {
      const holderCount = parseInt(match[1].replace(/,/g, ''), 10);
      cachedData = {
        holderCount,
        timestamp: now,
      };
      cacheTimestamp = now;
      return NextResponse.json(cachedData);
    }

    return NextResponse.json({ error: 'Could not parse holder count' }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch token stats' }, { status: 500 });
  }
}
