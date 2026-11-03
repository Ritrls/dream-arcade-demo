import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateUnit, TEXT_MODEL } from '../unit-generator.js';
import { MODEL, poll } from '../runninghub.js';
const fresh=()=>({idea:'冰霜蘑菇',id:'test-unit',design:{},art:{}});
const design=JSON.stringify({name:'冰霜蘑菇',role:'sniper',health:55,damage:12,range:240,interval:1.5,speed:40,ability:'slow',spritePrompt:'blue ice mushroom'});
test('RunningHub text tasks return text without requiring an image URL',async()=>{
  const result=await poll('design',{key:'test',output:'text',fetcher:async()=>({ok:true,status:200,json:async()=>({status:'SUCCESS',results:[{text:design}]})})});assert.equal(result.text,design);
});
test('unit creation uses text design then image generation and returns playable balanced stats',async()=>{
  const job=fresh(),calls=[];const unit=await generateUnit(job,{key:'test',download:async()=> 'data:image/png;base64,AA==',submit:async(endpoint,payload)=>{calls.push({endpoint,payload});return{taskId:'id-'+calls.length};},query:async(id,opts)=>opts.output==='text'?{text:design}:{url:'https://example/image.png'}});
  assert.equal(calls[0].endpoint,TEXT_MODEL);assert.equal(calls[1].endpoint,MODEL);assert.equal(calls[1].payload.aspectRatio,'1:1');assert.equal(unit.damage,12);assert.equal(unit.ability,'slow');assert.ok(unit.cost>0);assert.equal(unit.sprite.chroma,'magenta');assert.equal(unit.source,'RunningHub AI');
});
test('resuming a known design and sprite task does not create a duplicate paid task',async()=>{
  const job=fresh();job.unit=JSON.parse(design);job.art.taskId='already-paid';let submitted=0;
  await generateUnit(job,{key:'test',submit:async()=>{submitted++;},query:async()=>({url:'https://example/art'}),download:async()=> 'data:image/png;base64,AA=='});assert.equal(submitted,0);
});
test('an uncertain submission is not automatically retried',async()=>{
  const job=fresh();let submitted=0;const options={key:'test',submit:async()=>{submitted++;throw Error('lost response');}};await assert.rejects(generateUnit(job,options),/lost response/);await assert.rejects(generateUnit(job,options),/重复计费/);assert.equal(submitted,1);
});
