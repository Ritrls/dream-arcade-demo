import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRules, createGame } from '../games.js';
const rules = createRules();
test('mining has a playable economy: first ore, upgrades, automation, depth', () => {
  const mine = rules.freshMine();
  assert.equal(rules.buy(mine, 'tool'), false);
  for (let i = 0; i < 15; i++) rules.hit(mine, rules.clickPower(mine));
  assert.equal(mine.blocks, 3); assert.equal(mine.credits, 21);
  assert.equal(rules.buy(mine, 'tool'), true); assert.equal(mine.credits, 1); assert.equal(rules.clickPower(mine), 4);
  rules.hit(mine, 150); assert.ok(mine.depth > 1); assert.ok(mine.credits > 35);
  assert.equal(rules.buy(mine, 'drone'), true); const before = mine.total;
  rules.hit(mine, rules.autoPower(mine) * 30); assert.ok(mine.total > before); assert.ok(mine.hp > 0);
});
test('save restoration rejects invalid data and bounds economy values', () => {
  const s = rules.restoreMine({ credits: NaN, total: Infinity, tool: -4, drones: 3.4, depth: 0, hp: 1e20, blocks: 'bad' });
  assert.equal(s.credits, 0); assert.equal(s.total, 0); assert.equal(s.tool, 0); assert.equal(s.drones, 3); assert.equal(s.depth, 1); assert.equal(s.hp, s.maxHp); assert.equal(s.blocks, 0);
  assert.deepEqual(rules.restoreMine(null), rules.freshMine());
});
test('race rows always leave a path and keep pickups off obstacles', () => {
  for (let i = 0; i < 1000; i++) { const row = rules.raceRow(Math.random); assert.ok(row.obstacle >= 0 && row.obstacle < 3); assert.ok(row.pickup >= 0 && row.pickup < 3); assert.notEqual(row.pickup, row.obstacle); }
});
test('engine can run and change all three templates; mining saves, race lanes and boost work', () => {
  let nextFrame, saved;
  const noop = () => {}, context = new Proxy({}, { get: () => noop, set: () => true });
  const listener = new Map();
  const old = Object.fromEntries(['window', 'document', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, globalThis[k]]));
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  globalThis.document = { activeElement: null, addEventListener: noop, removeEventListener: noop };
  globalThis.Image = class {};
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; return 1; }; globalThis.cancelAnimationFrame = noop;
  const canvas = { width: 0, height: 0, focus: noop, getContext: () => context, addEventListener: (name, cb) => listener.set(name, cb), removeEventListener: noop };
  try {
    const game = createGame(canvas, { onSave: value => saved = value });
    game.setMode('mine'); game.start({ mode: 'mine' });
    for (let i = 0; i < 15; i++) game.action('primary');
    assert.equal(game.inspect().mine.credits, 21); assert.equal(game.action('tool'), true); assert.equal(game.inspect().mine.tool, 1);
    nextFrame(16); nextFrame(32); game.pause(); assert.equal(game.inspect().paused, true); assert.equal(game.action('primary'), false); game.stop(); assert.equal(saved.tool, 1);
    game.setMode('race'); game.start({ mode: 'race' }); game.action('left'); assert.equal(game.inspect().state.lane, 0); game.action('left'); assert.equal(game.inspect().state.lane, 0);
    game.action('primary'); nextFrame(48); assert.ok(game.inspect().state.distance > 0); assert.ok(game.inspect().state.fuel < 100); game.action('primary', false);
    game.setMode('collect'); game.start({ mode: 'collect' }); game.action('primary'); assert.equal(game.inspect().state.shield, 2.2); assert.equal(game.inspect().state.cooldown, 9); nextFrame(64); game.destroy();
  } finally { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
