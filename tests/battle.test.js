import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattleGame } from '../battle.js';
import { createUnitModel } from '../unit-model.js';
import { createMiningRules } from '../mining-rules.js';
const model = createUnitModel(), mining = createMiningRules();
function runGame(options, run) {
  const names=['window','document','Image','requestAnimationFrame','cancelAnimationFrame'], old=Object.fromEntries(names.map(k=>[k,globalThis[k]]));let callback;
  const noop=()=>{},ctx=new Proxy({},{get:()=>noop,set:()=>true}),events=new Map();
  globalThis.window={addEventListener:(key,value)=>events.set('window:'+key,value),removeEventListener:noop};globalThis.document={activeElement:null,addEventListener:noop,removeEventListener:noop};globalThis.Image=class{};globalThis.requestAnimationFrame=cb=>{callback=cb;return 1;};globalThis.cancelAnimationFrame=noop;
  const canvas={getContext:()=>ctx,focus:options.focus||noop,addEventListener:(key,value)=>events.set(key,value),removeEventListener:noop,getBoundingClientRect:options.bounds||(()=>({left:0,top:0,width:1000,height:600}))};let game;
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
test('RTS squads spread out, single-unit orders preserve the reinforcement rally, and group orders move it',()=>{
  const cheap=model.balance({health:35,damage:5,range:80,interval:2.2},'scout');
  runGame({roster:[cheap]},(game,frame,events)=>{
    game.start({mode:'rts'});assert.equal(game.deploy(),true);assert.equal(game.deploy(),true);
    frame(0);for(let i=1;i<=18*60;i++)frame(i*1000/60);
    const s=game.inspect().state,[a,b]=s.allies;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>30,'squad members remain individually visible');
    const rally={...s.rally},otherDest={...b.dest};
    events.get('pointerdown')({clientX:a.x,clientY:a.y,pointerId:1});
    events.get('pointerdown')({clientX:250,clientY:490,pointerId:1});
    assert.deepEqual(s.rally,rally);assert.deepEqual(b.dest,otherDest);assert.deepEqual(a.dest,{x:250,y:490});
    game.action('primary');events.get('pointerdown')({clientX:650,clientY:410,pointerId:1});
    assert.deepEqual(s.rally,{x:650,y:410});assert.notDeepEqual(a.dest,b.dest);
    events.get('pointerdown')({clientX:a.x,clientY:a.y,pointerId:1});a.hp=0;frame(18050);
    events.get('pointerdown')({clientX:600,clientY:450,pointerId:1});
    assert.deepEqual(s.rally,{x:600,y:450},'losing the selected unit restores usable group control');
  });
});
test('lane warnings identify the actual next spawn, including hard mode',()=>{
  for(const difficulty of ['normal','hard'])runGame({roster:model.presets()},(game,frame)=>{
    game.start({mode:'defense',difficulty});const warning=game.inspect().incoming;
    frame(0);for(let i=1;i<=3.3*60;i++)frame(i*1000/60);
    assert.equal(game.inspect().state.enemies[0].row,warning.row);
    const next=game.inspect().incoming;assert.equal(next.row,(game.inspect().state.wave+game.inspect().state.left)%5);
  });
});
test('focusing the board does not scroll it and displace a tapped defense tile',()=>{
  let scroll=0;
  runGame({roster:model.presets(),focus:config=>{if(!config?.preventScroll)scroll+=100},bounds:()=>({left:0,top:scroll,width:1000,height:600})},(game,frame,events)=>{
    game.start({mode:'defense'});events.get('pointerdown')({clientX:615,clientY:494,pointerId:1});
    assert.equal(scroll,0);assert.equal(game.inspect().state.allies[0].row,4);assert.equal(game.inspect().state.allies[0].col,4);
  });
});
test('burst increases every third projectile and shields reduce actual incoming damage by thirty percent',()=>{
  function exchange(ability,enemyAttacks){return runGame({roster:[model.balance({health:200,damage:10,range:150,interval:1,ability},'test')]},(game,frame)=>{
    game.start({mode:'rts'});game.deploy();const s=game.inspect().state,a=s.allies[0];s.nextSpawn=1000;a.x=400;a.y=300;
    const enemy={id:'target',x:500,y:300,hp:1000,maxHp:1000,damage:10,range:enemyAttacks?150:0,interval:1,cooldown:.25,speed:0,team:'enemy',slow:0};s.enemies.push(enemy);
    frame(0);for(let i=1;i<=2.9*60;i++)frame(i*1000/60);
    return{dealt:1000-enemy.hp,received:a.maxHp-a.hp};
  });}
  assert.equal(exchange('none',false).dealt,30);assert.equal(exchange('burst',false).dealt,37);
  assert.equal(exchange('none',true).received,30);assert.equal(exchange('shield',true).received,21);
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
test('Space on interface controls keeps native activation; Space on the board still mines and releases',()=>{
  runGame({roster:model.presets()},(game,frame,events)=>{
    game.start({mode:'mine'});frame(0);let prevented=0;const key={key:' ',preventDefault:()=>prevented++};
    document.activeElement={tagName:'BUTTON'};events.get('window:keydown')(key);frame(1000);
    assert.equal(prevented,0);assert.equal(game.inspect().mine.blocks,0);
    document.activeElement={tagName:'CANVAS'};events.get('window:keydown')(key);frame(2000);
    assert.equal(prevented,1);assert.ok(game.inspect().mine.blocks>0);
    events.get('window:keyup')(key);const hp=game.inspect().mine.hp;frame(3000);assert.equal(game.inspect().mine.hp,hp);
  });
});
test('offline mining is bounded, paid only once, and restores hired generated workers',()=>{
  const s=mining.restoreMine({...mining.freshMine(),savedAt:100000,workers:[{id:'test',damage:20,interval:1,count:2}]});const copy=structuredClone(s);assert.ok(mining.autoPower(s)>=40);const gain=mining.offline(s,100000+24*3600000);assert.equal(gain,mining.offline(copy,100000+2*3600000));assert.equal(mining.offline(s,s.savedAt),0);assert.equal(s.depth,1);
});
test('mine shifts free a type slot without losing workers and exclude resting crews from offline income',()=>{
  const workers=Array.from({length:14},(_,i)=>({id:'crew-'+i,name:'班组'+i,damage:10,interval:1,count:2}));
  const mine=mining.restoreMine({...mining.freshMine(),workers,savedAt:100000});assert.equal(mine.workers.length,14);assert.equal(mine.workers.filter(w=>!w.resting).length,12);assert.equal(mining.autoPower(mine),240);
  assert.equal(mining.restWorker(mine,'crew-12',false),false);assert.equal(mining.restWorker(mine,'crew-0',true),true);assert.equal(mining.autoPower(mine),220);
  assert.equal(mining.restWorker(mine,'crew-12',false),true);assert.equal(mining.autoPower(mine),240);assert.equal(mine.workers[0].count,2);
  for(const w of mine.workers)mining.restWorker(mine,w.id,true);
  assert.equal(mining.offline(mine,100000+3600000),0);assert.equal(mining.restoreMine(mine).workers.length,14);
});
test('archiving a unit preserves its mining output and later designs recruit at their own true efficiency',()=>{
  const a=model.balance({name:'旧班组',damage:10,interval:1},'custom');
  runGame({roster:[a],mineSave:{...mining.freshMine(),credits:1000}},(game,frame)=>{
    game.start({mode:'mine'});game.deploy();game.setRoster(model.presets(),[a]);
    assert.equal(mining.autoPower(game.inspect().mine),10);assert.equal(game.inspect().mine.workers[0].name,'旧班组');
    const b=model.balance({...a,damage:20},a.id);game.setRoster([b],[a]);game.select(b.id);game.deploy();
    const workers=game.inspect().mine.workers;assert.equal(workers.length,2);assert.notEqual(workers[0].id,workers[1].id);assert.equal(mining.autoPower(game.inspect().mine),30);
    game.restWorker(workers[0].id,true);assert.equal(mining.autoPower(game.inspect().mine),20);game.restWorker(workers[0].id,false);assert.equal(mining.autoPower(game.inspect().mine),30);
  });
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
