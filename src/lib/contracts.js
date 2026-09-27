// Contract addresses on Base
export const RL80_ADDRESS = '0x30D01555d88c76500a82754A1D53cAc082A6CB75';
export const STAKING_ADDRESS = '0x8DBCfB1f4ae1AFA1245e1d387bBC90A8e61F854C';
export const REWARDS_SPLITTER_ADDRESS = '0xC9890C5a1111452c67d62cbBc214803a166A2737';
export const NFT_DROP_ADDRESS = '0xBF6f792075C5893DAF380D640B2f90296ea30C22';
export const PREDICTION_MARKET_ADDRESS = '0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c';
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Site support wallet — rl80.eth, hardcoded to its resolved address: ENS
// lives on mainnet, so runtime resolution would add a mainnet RPC
// dependency (and a failure mode) to a Base-only flow. Verified
// 2026-06-11: plain EOA on both mainnet and Base, owner-confirmed.
// Support is taken in ETH/USDC deliberately — a public project wallet
// receiving RL80 reads as "dev dumping" the moment it sells.
//
// This is the ONLY recipient the fountain gives to: visitors support the
// site directly (the earlier charity options were retired 2026-09-27).
// The export name and the 'DEV' key in fountain_donations docs are kept
// for compatibility with the existing feed.
export const DEV_WALLET = {
  address: '0x07363eac9c24Af6451EBA07ff16CbD687dA4508A',
  ens: 'rl80.eth',
  name: 'RL80 (rl80.eth)',
  shortName: 'Support the site',
  description: 'Keeps the lights on: hosting, RPC, voices, and the builder’s coffee.',
  icon: '🕯️',
};
export const SITE_WALLET = DEV_WALLET;
