import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, byKey } from '../src/game/playtest2/pt2-sim.js';

const card = (key) => ({ ...byKey[key] });
function setup({ pros = 100, trader = 'unicornio', hazards = [], artifacts = [] } = {}) {
  let actions = 0;
  const policy = { human: true, main: () => { actions++; return { t: 'pass' }; }, discardOne: (_g, p) => p.hand[0] };
  const game = new Game({ players: [{ name: 'Player', policy }, { name: 'Rival', policy }], seed: 1, verbose: true });
  const player = game.players[0];
  Object.assign(player, {
    trader: trader ? { ...card(trader), credNow: byKey[trader].cred } : null,
    pros, liq: 0, hand: [], deck: [card('tech'), card('tech')], discard: [],
    hazards: hazards.map(card), artifacts: artifacts.map(card),
  });
  return { game, player, actions: () => actions };
}

test('Compound Interest starts at exactly 100 banked Prosperity', async () => {
  for (const pros of [0, 99, 100, 125]) {
    const { game, player } = setup({ pros });
    await game.turn(player);
    assert.equal(player.pros, pros + (pros >= 100 ? 25 : 0));
  }
});

test('interest pays once each turn before income and drawing', async () => {
  const { game, player } = setup();
  const atDraw = [];
  player.policy.beforeDraw = () => atDraw.push(player.pros);
  await game.turn(player);
  await game.turn(player);
  assert.deepEqual(atDraw, [125, 150]);
  assert.equal(player.liq, 8); // normal income 3 + spotless 1 each turn
  assert.equal(game.lines.filter(line => line.includes('(Compound Interest)')).length, 2);
});

test('benching or playing El Unicornio does not grant an immediate payout', async () => {
  const { game, player } = setup({ trader: 'monje' });
  player.bench.push({ ...card('unicornio'), credNow: 20 });
  await game.turn(player);
  assert.equal(player.pros, 100);
  await game.act(player, { t: 'swap', i: 0 });
  assert.equal(player.pros, 100);
  await game.turn(player);
  assert.equal(player.pros, 125);

  const other = setup({ trader: null });
  const unicorn = card('unicornio');
  other.player.hand.push(unicorn);
  other.player.liq = unicorn.cost;
  await other.game.playCard(other.player, unicorn);
  assert.equal(other.player.pros, 100);
});

test('Quantum Hack disables interest; an equipped Halo protects it', async () => {
  for (const protectedByHalo of [false, true]) {
    const { game, player } = setup({ hazards: ['hack'], artifacts: protectedByHalo ? ['halo'] : [] });
    await game.turn(player);
    assert.equal(player.pros, protectedByHalo ? 125 : 100);
  }
});

test('crossing the threshold later in the turn waits until the next turn', async () => {
  const { game, player } = setup({ pros: 75 });
  player.policy.beforeDraw = () => game.bank(player, 25, 'other effect');
  await game.turn(player);
  assert.equal(player.pros, 100);
  delete player.policy.beforeDraw;
  await game.turn(player);
  assert.equal(player.pros, 125);
});

test('interest follows normal banking rules: Bear Market lets a 25 payout through', async () => {
  const { game, player } = setup({ hazards: ['bear'] });
  await game.turn(player);
  assert.equal(player.pros, 125);
});

test('a winning interest payout ends the turn before income, draw or actions', async () => {
  const { game, player, actions } = setup({ pros: 975 });
  let renders = 0;
  game.hooks = { render: () => { renders++; } };
  await game.turn(player);
  assert.equal(game.over, true);
  assert.equal(game.winner, player);
  assert.equal(player.pros, 1000);
  assert.equal(player.liq, 0);
  assert.equal(player.deck.length, 2);
  assert.equal(actions(), 0);
  assert.equal(renders, 1);
});
