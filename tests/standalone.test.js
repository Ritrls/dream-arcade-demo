import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { makeStandalone } from '../standalone.js';
import { createRules } from '../games.js';
test('all three exported templates embed both images, parse independently, and escape user content', () => {
  const theme = { name: '</script><img src=x onerror=alert(1)>', image: 'data:image/png;base64,AA==', atlas: 'data:image/png;base64,BB==', names: { resource: 'crystal' } };
  for (const mode of ['collect', 'mine', 'race']) {
    const html = makeStandalone(theme, { mode, duration: 30 }, createRules().freshMine(), { title: mode, action: 'Play', hint: 'Keys' });
    assert.ok(html.includes(theme.image)); assert.ok(html.includes(theme.atlas)); assert.ok(!html.includes(theme.name));
    assert.ok(!html.includes('type="module"')); assert.ok(!html.includes('fetch(')); assert.ok(!html.includes('Authorization'));
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]; assert.equal(scripts.length, 1); new Script(scripts[0][1]);
  }
});
