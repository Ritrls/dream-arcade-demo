import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { makePortable } from '../portable.js';
import { createUnitModel } from '../unit-model.js';
import { createMiningRules } from '../mining-rules.js';
test('every strategy template exports without dependencies, keys, or unsafe user HTML',()=>{
  const model=createUnitModel(),roster=[model.balance({name:'</script><img src=x onerror=alert(1)>',sprite:{src:'data:image/png;base64,AA=='}},'custom')];
  for(const mode of ['defense','rts','mine']){const html=makePortable({name:'Demo',image:'data:image/png;base64,BB=='},roster,{mode},createMiningRules().freshMine());assert.ok(!html.includes('fetch('));assert.ok(!html.includes('Authorization'));assert.ok(!html.includes(roster[0].name));assert.ok(html.includes(roster[0].sprite.src));const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new Script(scripts[0][1]);}
});
