import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { makePortable } from '../portable.js';
import { createUnitModel } from '../unit-model.js';
import { createMiningRules } from '../mining-rules.js';
test('every strategy template exports without dependencies, keys, or unsafe user HTML',()=>{
  const model=createUnitModel(),roster=[model.balance({name:'</script><img src=x onerror=alert(1)>',sprite:{src:'data:image/png;base64,AA=='}},'custom')];
  for(const mode of ['defense','rts','mine']){const html=makePortable({name:'Demo',image:'data:image/png;base64,BB=='},roster,{mode},createMiningRules().freshMine());assert.ok(!html.includes('fetch('));assert.ok(!html.includes('Authorization'));assert.ok(!html.includes(roster[0].name));assert.ok(html.includes(roster[0].sprite.src));const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new Script(scripts[0][1]);}
});
test('an exported match keeps its final result after the last state refresh and can restart',()=>{
  const html=makePortable({name:'Demo',accent:'#bbf4d7'},createUnitModel().presets(),{mode:'defense'},createMiningRules().freshMine());
  const noop=()=>{},ctx=new Proxy({},{get:()=>noop,set:()=>true});
  function element(){return{style:{},children:[],textContent:'',append(...items){this.children.push(...items)},get lastChild(){return this.children.at(-1)},setAttribute:noop,addEventListener:noop,focus:noop,getContext:()=>ctx};}
  const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));let frame;
  const document={getElementById:id=>nodes[id],createElement:element,addEventListener:noop};
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,window:{addEventListener:noop},Image:class{},requestAnimationFrame:fn=>{frame=fn;return 1},localStorage:{getItem:()=>null,setItem:noop}});
  assert.equal(nodes.pause.disabled,true);nodes.start.onclick();assert.equal(nodes.primary.disabled,false);
  frame(0);for(let i=1;i<=181*5;i++)frame(i*200);
  assert.match(nodes.result.textContent,/再试一次！/);const result=nodes.result.textContent;
  frame(182000);assert.equal(nodes.result.textContent,result);assert.equal(nodes.primary.disabled,true);
  nodes.start.onclick();assert.equal(nodes.result.textContent,'');assert.equal(nodes.primary.disabled,false);
});
