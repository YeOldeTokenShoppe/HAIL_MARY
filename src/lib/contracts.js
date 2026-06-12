// Contract addresses on Base
export const RL80_ADDRESS = '0x30D01555d88c76500a82754A1D53cAc082A6CB75';
export const STAKING_ADDRESS = '0x8DBCfB1f4ae1AFA1245e1d387bBC90A8e61F854C';
export const REWARDS_SPLITTER_ADDRESS = '0xC9890C5a1111452c67d62cbBc214803a166A2737';
export const NFT_DROP_ADDRESS = '0xBF6f792075C5893DAF380D640B2f90296ea30C22';
export const PREDICTION_MARKET_ADDRESS = '0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c';
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Dev tip jar — rl80.eth, hardcoded to its resolved address: ENS lives
// on mainnet, so runtime resolution would add a mainnet RPC dependency
// (and a failure mode) to a Base-only flow. Verified 2026-06-11: plain
// EOA on both mainnet and Base, owner-confirmed. Tips are taken in
// ETH/USDC deliberately — a public dev wallet receiving RL80 reads as
// "dev dumping" the moment it sells.
export const DEV_WALLET = {
  address: '0x07363eac9c24Af6451EBA07ff16CbD687dA4508A',
  ens: 'rl80.eth',
  name: 'The Dev (rl80.eth)',
  shortName: 'Buy the Dev a Coffee',
  description: 'A voluntary tip to the builder. Not a charity — just caffeine.',
  icon: '☕',
};

// Charity wallet addresses for fountain donations
export const CHARITY_WALLETS = {
  ST_JUDES: {
    address: '0xbAC39697250cDF6A808Bd39D2D1828388DF87967',
    name: "St. Jude Children's Research Hospital",
    shortName: "St. Jude's",
    givingBlockUrl: 'https://thegivingblock.com/donate/st-judes-childrens-research-hospital/',
    description: 'Finding cures. Saving children.',
    icon: '\u{1F3E5}',
  },
  ASPCA: {
    address: '0xF9EAdD659e730BbC05f4BFfe618A98fB0b910fDD',
    name: 'American Society for the Prevention of Cruelty to Animals',
    shortName: 'ASPCA',
    givingBlockUrl: 'https://thegivingblock.com/donate/the-american-society-for-the-prevention-of-cruelty-to-animals/',
    description: 'We are their voice.',
    icon: '\u{1F43E}',
  },
};
