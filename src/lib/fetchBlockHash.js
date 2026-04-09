import { publicClient } from './viemClient';

/**
 * Fetch block hash + timestamp for a given block number on Base.
 * @param {number|bigint} blockNumber
 * @returns {Promise<{blockNumber: number, blockHash: string, timestamp: number}>}
 */
export async function fetchBlockHash(blockNumber) {
  const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
  if (!block) throw new Error(`Block ${blockNumber} not found`);
  return {
    blockNumber: Number(block.number),
    blockHash: block.hash,
    timestamp: Number(block.timestamp),
  };
}

/**
 * Fetch the latest block number on Base.
 * @returns {Promise<number>}
 */
export async function fetchLatestBlockNumber() {
  return Number(await publicClient.getBlockNumber());
}
