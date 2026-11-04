import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateUnit, TEXT_MODEL, attachUnitTask } from '../unit-generator.js';
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
test('a recovered platform task can finish without paying for the lost design submission again',async()=>{
  const job=fresh();job.design.attempted=true;attachUnitTask(job,'existing-design');let submissions=0;
  const u=await generateUnit(job,{key:'test',submit:async endpoint=>{assert.equal(endpoint,MODEL);submissions++;return{taskId:'new-art'}},query:async(id,opts)=>opts.output==='text'?{text:design}:{url:'https://example/art'},download:async()=> 'data:image/png;base64,AA=='});
  assert.equal(submissions,1);assert.equal(u.name,'冰霜蘑菇');assert.throws(()=>attachUnitTask(job,'bad id?'),/有效任务编号/);
  const wrong=fresh();attachUnitTask(wrong,'wrong-design');attachUnitTask(wrong,'correct-design');assert.equal(wrong.design.taskId,'correct-design');
});
test('an expired art URL is refreshed from the same paid task after download failure',async()=>{
  const job=fresh();job.unit=JSON.parse(design);job.art={taskId:'paid-art',url:'https://example/expired'};let submitted=0,queried=0;
  const options={key:'test',submit:async()=>{submitted++;throw Error('must not resubmit')},query:async id=>{assert.equal(id,'paid-art');queried++;return{url:'https://example/fresh'}},download:async url=>{if(url.endsWith('expired'))throw Error('expired');return 'data:image/png;base64,AA=='}};
  await assert.rejects(generateUnit(job,options),/expired/);assert.equal(job.art.url,undefined);
  await generateUnit(job,options);assert.equal(submitted,0);assert.equal(queried,1);
});
test('aborting a known task preserves its ID and resumes the same job',async()=>{
  const job=fresh();job.unit=JSON.parse(design);job.art.taskId='existing-art';const controller=new AbortController();controller.abort();
  await assert.rejects(generateUnit(job,{key:'test',signal:controller.signal}),{name:'AbortError'});assert.equal(job.art.taskId,'existing-art');
  let submissions=0;await generateUnit(job,{key:'test',submit:async()=>submissions++,query:async()=>({url:'https://example/art'}),download:async()=> 'data:image/png;base64,AA=='});assert.equal(submissions,0);
});
test('failing to persist the submission marker stops before creating a paid task',async()=>{
  const job=fresh();let submitted=0;
  await assert.rejects(generateUnit(job,{key:'test',changed:()=>{throw Error('storage unavailable')},submit:async()=>{submitted++;return{taskId:'must-not-exist'}}}),/storage unavailable/);
  assert.equal(submitted,0);
});
