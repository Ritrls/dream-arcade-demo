import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLibrary, creationRoom, addToLibrary, archiveUnit } from '../unit-library.js';
const unit=i=>({id:'unit-'+i,name:'队员'+i,damage:10+i,sprite:{src:'data:image/png;base64,AA=='}});
test('old arrays migrate without losing art, duplicate entries do not consume lineup slots',()=>{
  const units=normalizeLibrary([unit(0),unit(0),...Array.from({length:10},(_,i)=>unit(i+1))]);
  assert.equal(units.length,11);assert.equal(units.filter(u=>!u.archived).length,8);assert.equal(creationRoom(units),false);assert.ok(units.every(u=>u.sprite.src===unit(0).sprite.src));
});
test('a full lineup archives late completions instead of overwriting an existing generated unit',()=>{
  const before=normalizeLibrary(Array.from({length:8},(_,i)=>unit(i))),after=addToLibrary(before,unit(9));
  assert.equal(after.length,9);assert.equal(after[8].archived,true);assert.deepEqual(after.slice(0,8),before);
  assert.throws(()=>archiveUnit(after,'unit-9',false),/8 位/);
  const freed=archiveUnit(after,'unit-0',true),restored=archiveUnit(freed,'unit-9',false);
  assert.equal(restored.filter(u=>!u.archived).length,8);assert.equal(restored.length,9);assert.equal(before[0].archived,false);
  assert.equal(addToLibrary(restored,unit(0))[0].archived,true,'reloading an example preserves the archive choice');
});
