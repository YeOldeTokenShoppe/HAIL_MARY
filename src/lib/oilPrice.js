// Server-side utility: reads RL80/USD price from Uniswap V2 pool on Base
// Pool: 0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203 (RL80/WETH)

const UNISWAP_PAIR = "0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203";

// ABI fragments (function selectors)
const GET_RESERVES_SIG = "0x0902f1ac"; // getReserves()
const TOKEN0_SIG = "0x0dfe1681";       // token0()

async function baseRpc(method, params) {
  const url = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.BASE_RPC_URL;
  if (!url) throw new Error("BASE_RPC_URL not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function callContract(to, data) {
  return baseRpc("eth_call", [{ to, data }, "latest"]);
}

async function getEthPriceUsd() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  const data = await res.json();
  return data.ethereum.usd;
}

/**
 * Read RL80/USD price from the Uniswap V2 pool on Base.
 * Returns { rl80PriceUsd, ethPriceUsd, rl80PerEth, timestamp }
 */
export async function getRL80Price() {
  // 1. Determine token0 to know which reserve is RL80 vs WETH
  const token0Raw = await callContract(UNISWAP_PAIR, TOKEN0_SIG);
  const token0 = "0x" + token0Raw.slice(26).toLowerCase();

  // 2. Get reserves
  const reservesRaw = await callContract(UNISWAP_PAIR, GET_RESERVES_SIG);
  // Returns: uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast
  // reserve0 = bytes 0-31, reserve1 = bytes 32-63 (each 32 bytes, left-padded)
  const hex = reservesRaw.slice(2); // strip 0x
  const reserve0 = BigInt("0x" + hex.slice(0, 64));
  const reserve1 = BigInt("0x" + hex.slice(64, 128));

  // WETH on Base
  const WETH = "0x4200000000000000000000000000000000000006".toLowerCase();
  const rl80IsToken0 = token0 !== WETH;

  const reserveRL80 = rl80IsToken0 ? reserve0 : reserve1;
  const reserveWETH = rl80IsToken0 ? reserve1 : reserve0;

  // Both tokens are 18 decimals — use BigInt math to avoid precision loss
  // Multiply WETH reserve by 1e18 before dividing to preserve decimal precision
  const PRECISION = BigInt(10) ** BigInt(18);
  const rl80PerEthScaled = (reserveWETH * PRECISION) / reserveRL80; // 18-decimal fixed point
  const rl80PerEth = Number(rl80PerEthScaled) / 1e18;

  // 3. Get ETH/USD
  const ethPriceUsd = await getEthPriceUsd();
  const rl80PriceUsd = rl80PerEth * ethPriceUsd;

  console.log("[oilPrice]", {
    token0,
    rl80IsToken0,
    reserveRL80: reserveRL80.toString(),
    reserveWETH: reserveWETH.toString(),
    rl80PerEth,
    ethPriceUsd,
    rl80PriceUsd,
  });

  return {
    rl80PriceUsd,
    ethPriceUsd,
    rl80PerEth,
    timestamp: Date.now(),
  };
}

/**
 * Read RL80 balance for a wallet address.
 * Returns balance as BigInt (raw, 18 decimals).
 */
export async function getRL80Balance(walletAddress) {
  const RL80_CONTRACT = process.env.NEXT_PUBLIC_RL80_CONTRACT || "0x30d01555d88c76500a82754a1d53cac082a6cb75";
  // balanceOf(address) selector = 0x70a08231
  const paddedAddr = walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const data = "0x70a08231" + paddedAddr;
  const result = await callContract(RL80_CONTRACT, data);
  if (!result || result === "0x") return BigInt(0);
  return BigInt(result);
}
