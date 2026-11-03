import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattleGame } from '../battle.js';
import { createUnitModel } from '../unit-model.js';
import { createMiningRules } from '../mining-rules.js';
const model = createUnitModel(), mining = createMiningRules();
function runGame(options, run) {
  const names=['window','document','Image','requestAnimationFrame','cancelAnimationFrame'], old=Object.fromEntries(names.map(k=>[k,globalThis[k]]));let callback;
  const noop=()=>{},ctx=new Proxy({},{get:()=>noop,set:()=>true}),events=new Map();
  globalThis.window={addEventListener:noop,removeEventListener:noop};globalThis.document={activeElement:null,addEventListener:noop,removeEventListener:noop};globalThis.Image=class{};globalThis.requestAnimationFrame=cb=>{callback=cb;return 1;};globalThis.cancelAnimationFrame=noop;
  const canvas={getContext:()=>ctx,focus:noop,addEventListener:(key,value)=>events.set(key,value),removeEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};let game;
  try{game=createBattleGame(canvas,{now:()=>1,random:()=>.5,...options});return run(game,time=>callback(time),events);}finally{game?.destroy();for(const key of names){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}}
}
test('generated numeric attributes are bounded, skills are validated, and power has a cost',()=>{
  const u=model.balance({health:99999,damage:999,range:-5,interval:0,speed:999,ability:'execute-code',cost:0});assert.equal(u.health,240);assert.equal(u.damage,32);assert.equal(u.range,80);assert.equal(u.interval,.65);assert.equal(u.ability,'none');assert.ok(u.cost>0);
  const weak=model.balance({damage:5,health:35}),strong=model.balance({damage:32,health:240});assert.ok(strong.cost>weak.cost);assert.equal(model.parse('```json\n{"name":"冰菇","damage":12,"ability":"slow"}\n```').ability,'slow');
});
test('defense placement spends real energy, prevents overlap, and stronger units kill faster',()=>{
  function simulate(damage,interval){let kills=0;return runGame({roster:[model.balance({damage,interval,range:260,health:240},'test')]},(game,frame)=>{game.start({mode:'defense'});const before=game.inspect().state.energy;assert.equal(game.deploy(4,5),true);const after=game.inspect().state.energy;assert.ok(after<before);assert.equal(game.deploy(4,5),false);assert.equal(game.inspect().state.energy,after);frame(0);for(let i=1;i<=1200;i++)frame(i*1000/60);kills=game.inspect().state.kills;return kills;});}
  assert.ok(simulate(32,.65)>simulate(5,2.2));
});
test('slow skill affects actual enemy movement',()=>{
  function enemyX(ability){return runGame({roster:[model.balance({damage:5,interval:1,range:260,health:150,ability},'test')]},(game,frame)=>{game.start({mode:'defense'});game.deploy(4,5);frame(0);for(let i=1;i<=8*60;i++)frame(i*1000/60);return game.inspect().state.enemies[0].x;});}
  assert.ok(enemyX('slow')>enemyX('none')+20);
});
test('RTS units travel to and capture a resource point',()=>{
  runGame({roster:model.presets()},(game,frame)=>{game.start({mode:'rts'});assert.equal(game.deploy(),true);frame(0);for(let i=1;i<=12*60;i++)frame(i*1000/60);const s=game.inspect().state;assert.ok(s.posts[0].capture>=.95);assert.ok(s.allies[0].x>200);assert.ok(s.energy>0);});
});
test('a created unit can be hired and its damage / interval produces mining income',()=>{
  function simulate(damage,interval){return runGame({roster:[model.balance({role:'worker',damage,interval},'miner')],mineSave:{...mining.freshMine(),credits:500}},(game,frame)=>{game.start({mode:'mine'});assert.equal(game.deploy(),true);assert.equal(game.inspect().mine.workers[0].count,1);frame(0);for(let i=1;i<=600;i++)frame(i*1000/60);return game.inspect().mine.total;});}
  assert.ok(simulate(28,.7)>simulate(5,2));
});
test('5fps and 60fps preserve mining and battle timing; pauses exclude background time',()=>{
  function simulate(fps,mode){return runGame({roster:model.presets(),mineSave:{...mining.freshMine(),drones:2}},(game,frame)=>{game.start({mode});frame(0);for(let i=1;i<=fps*10;i++)frame(i*1000/fps);const s=game.inspect();return{elapsed:s.elapsed,hp:s.mine.hp,blocks:s.mine.blocks,enemies:s.state.enemies.map(e=>e.x)};});}
  for(const mode of ['mine','defense']){const a=simulate(5,mode),b=simulate(60,mode);assert.ok(Math.abs(a.elapsed-b.elapsed)<1e-6);assert.equal(a.blocks,b.blocks);assert.ok(Math.abs(a.hp-b.hp)<1e-6);assert.deepEqual(a.enemies,b.enemies);}
  runGame({},(game,frame)=>{game.start({mode:'mine'});frame(0);frame(1000);game.pause();frame(100000);game.pause();frame(200000);frame(201000);assert.ok(Math.abs(game.inspect().elapsed-2)<1e-6);frame(204000);assert.equal(game.inspect().paused,true);});
});
test('offline mining is bounded, paid only once, and restores hired generated workers',()=>{
  const s=mining.restoreMine({...mining.freshMine(),savedAt:100000,workers:[{id:'test',damage:20,interval:1,count:2}]});const copy=structuredClone(s);assert.ok(mining.autoPower(s)>=40);const gain=mining.offline(s,100000+24*3600000);assert.equal(gain,mining.offline(copy,100000+2*3600000));assert.equal(mining.offline(s,s.savedAt),0);assert.equal(s.depth,1);
});
test('normal defense can be completed by covering the five lanes',()=>{
  let result;
  runGame({roster:model.presets(),onEnd:r=>result=r},(game,frame)=>{
    game.start({mode:'defense'});game.select('preset-assault');frame(0);
    for(let i=1;i<=180*5&&!result;i++){frame(i*200);for(const row of [4,3,2,1,0])if(!game.inspect().state.allies.some(a=>a.row===row&&a.col===4)&&game.inspect().state.energy>=90)game.deploy(row,4);}
    assert.equal(result?.win,true);assert.ok(result.kills>=25);
  });
});
test('a captured point and a coordinated squad can win the RTS campaign',()=>{
  let result;
  runGame({roster:model.presets(),onEnd:r=>result=r},(game,frame,events)=>{
    game.start({mode:'rts'});game.select('preset-assault');frame(0);
    for(let i=1;i<=150*5&&!result;i++){
      frame(i*200);if(game.inspect().state.energy>=90&&game.inspect().state.allies.length<12)game.deploy();
      if(i===100){game.action('primary');events.get('pointerdown')({clientX:910,clientY:300,pointerId:1});}
    }
    assert.equal(result?.win,true);
  });
});
