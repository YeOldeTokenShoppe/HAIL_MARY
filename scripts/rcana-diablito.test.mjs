import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, byKey } from '../src/game/playtest2/pt2-sim.js';

const card = (key) => ({ ...byKey[key] });
function setup({ heads = true, cred = 10, hazards = [], artifacts = [], trader = 'diablito' } = {}) {
  const policy = { human: true, main: () => ({ t: 'pass' }), discardOne: (_g, p) => p.hand[0], useHeart: () => false };
  const game = new Game({ players: [{ name: 'Player', policy }, { name: 'Rival', policy }], seed: 1, verbose: true });
  const player = game.players[0];
  Object.assign(player, {
    trader: trader ? { ...card(trader), credNow: trader === 'diablito' ? cred : byKey[trader].cred } : null,
    liq: 0, hand: [], deck: [card('tech'), card('tech')], discard: [],
    hazards: hazards.map(card), artifacts: artifacts.map(card),
  });
  let flips = 0;
  game.rng = () => { flips++; return heads ? 0.25 : 0.75; };
  return { game, player, flips: () => flips };
}

test('heads pays the wager plus normal spotless income, once per turn', async () => {
  const { game, player, flips } = setup();
  await game.turn(player);
  assert.equal(player.liq, 4); // wager 1 + income 2 + spotless 1
  assert.equal(player.trader.credNow, 10);
  assert.equal(flips(), 1);
  await game.turn(player);
  assert.equal(player.liq, 8);
  assert.equal(flips(), 2);
});

test('tails damages El Diablito before the spotless income check', async () => {
  const { game, player, flips } = setup({ heads: false });
  await game.turn(player);
  assert.equal(player.trader.credNow, 9);
  assert.equal(player.liq, 2);
  assert.equal(flips(), 1);
});

test('Quantum Hack disables the wager and the Halo restores it', async () => {
  for (const protectedByHalo of [false, true]) {
    const { game, player, flips } = setup({ hazards: ['hack'], artifacts: protectedByHalo ? ['halo'] : [] });
    await game.turn(player);
    assert.equal(flips(), protectedByHalo ? 1 : 0);
    assert.equal(player.liq, protectedByHalo ? 4 : 1);
    assert.equal(player.trader.credNow, 10);
  }
});

test('a benched El Diablito does not flip', async () => {
  const { game, player, flips } = setup({ trader: 'monje' });
  player.bench.push({ ...card('diablito'), credNow: 10 });
  await game.turn(player);
  assert.equal(flips(), 0);
  assert.equal(player.liq, 2);
  assert.equal(player.bench[0].credNow, 10);
});

test('tails at one CRED disgraces the Trader and leaves unemployed income', async () => {
  const { game, player } = setup({ heads: false, cred: 1 });
  await game.turn(player);
  assert.equal(player.trader, null);
  assert.equal(player.discard[0].key, 'diablito');
  assert.equal(player.stats.disgraces, 1);
  assert.equal(player.liq, 1);
});

test('the Shroud protects against wager disgrace using its existing recovery rule', async () => {
  const { game, player } = setup({ heads: false, cred: 1, artifacts: ['shroud'] });
  await game.turn(player);
  assert.equal(player.trader.credNow, 5);
  assert.equal(player.artifacts.length, 0);
  assert.equal(player.discard[0].key, 'shroud');
  assert.equal(player.stats.disgraces, 0);
  assert.equal(player.liq, 2);
});

test('playing a Calamity no longer grants the replaced rebate', async () => {
  const { game, player, flips } = setup();
  const hazard = card('bear');
  player.hand.push(hazard);
  player.liq = 5;
  await game.playCard(player, hazard, { target: game.players[1] });
  assert.equal(player.liq, 5 - hazard.cost);
  assert.equal(game.players[1].hazards[0], hazard);
  assert.equal(flips(), 0);
});
