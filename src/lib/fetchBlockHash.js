import { getRpcClient, eth_getBlockByNumber, eth_blockNumber } from "thirdweb/rpc";
import { client, chain } from "@/lib/contract";

const rpc = getRpcClient({ client, chain });

/**
 * Fetch block hash + timestamp for a given block number on Base.
 * @param {number|bigint} blockNumber
 * @returns {Promise<{blockNumber: number, blockHash: string, timestamp: number}>}
 */
export async function fetchBlockHash(blockNumber) {
  const block = await eth_getBlockByNumber(rpc, {
    blockNumber: BigInt(blockNumber),
    includeTransactions: false,
  });
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
  const num = await eth_blockNumber(rpc);
  return Number(num);
}
