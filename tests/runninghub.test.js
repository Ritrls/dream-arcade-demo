import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, poll, generateScene, parseResult } from '../runninghub.js';
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
test('creates exactly one task with official payload and bearer auth, then polls', async () => {
  const calls = []; const responses = [ { taskId: '123', status: 'QUEUED' }, { status: 'RUNNING' }, { status: 'SUCCESS', results: [{ outputUrl: 'https://images.example/art.png' }] } ];
  const result = await generateScene('forest', { key: 'test-key', sleeper: async () => {}, fetcher: async (url, options) => { calls.push({ url, options }); return reply(responses.shift()); } });
  assert.equal(result.url, 'https://images.example/art.png'); assert.equal(result.taskId, '123');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key'); assert.deepEqual(JSON.parse(calls[0].options.body), { prompt: 'forest', aspectRatio: '16:9' });
  assert.equal(calls.filter(c => c.url.endsWith('text-to-image')).length, 1); assert.deepEqual(JSON.parse(calls[1].options.body), { taskId: '123' });
});
test('unauthorized response is never retried', async () => {
  let count = 0; await assert.rejects(request('query', {}, { key: 'key', retry: true, fetcher: async () => { count++; return reply({}, 401); } }), /无效/); assert.equal(count, 1);
});
test('transient polling failures retry then succeed', async () => {
  let count = 0; const r = await poll('123', { key: 'key', sleeper: async () => {}, fetcher: async () => ++count < 3 ? reply({}, 503) : reply({ status: 'SUCCESS', results: [{ url: 'https://images.example/art.png' }] }) }); assert.equal(count, 3); assert.ok(r.url);
});
test('failed and cancelled tasks stop with recoverable task id', async () => {
  for (const status of ['FAILED', 'CANCEL']) await assert.rejects(poll('saved-id', { key: 'key', fetcher: async () => reply({ status }) }), e => e.taskId === 'saved-id');
});
test('timeout preserves the task id', async () => {
  let time = 0; await assert.rejects(poll('saved-id', { key: 'key', timeout: 10, now: () => time, sleeper: async () => { time += 20; }, fetcher: async () => reply({ status: 'RUNNING' }) }), e => e.taskId === 'saved-id' && /10 分钟/.test(e.message));
});
test('abort stops polling and missing output fails clearly', async () => {
  const c = new AbortController(); c.abort(); await assert.rejects(poll('123', { key: 'key', signal: c.signal }), { name: 'AbortError' });
  await assert.rejects(poll('123', { key: 'key', fetcher: async () => reply({ status: 'SUCCESS', results: [{ url: 'javascript:alert(1)' }] }) }), /没有返回图片/);
});
test('missing key is rejected; business errors redact key; wrapped task ids accepted', async () => {
  await assert.rejects(request('query', {}), /API Key/);
  await assert.rejects(request('query', {}, { key: 'secret', fetcher: async () => reply({ errorCode: 'INVALID', errorMessage: 'secret is wrong' }) }), e => !e.message.includes('secret'));
  assert.equal(parseResult({ data: { task_id: '123', status: 'running' } }).status, 'RUNNING');
});
test('creation response loss is not retried to avoid duplicate billing', async () => {
  let count = 0; await assert.rejects(generateScene('forest', { key: 'key', fetcher: async () => { count++; throw new Error('network'); } })); assert.equal(count, 1);
});
test('polling tolerates temporary invalid JSON and null responses without resubmitting',async()=>{
  let calls=0;const result=await poll('paid-task',{key:'test',sleeper:async()=>{},fetcher:async url=>{
    assert.ok(url.endsWith('/query'));calls++;
    if(calls===1)return{ok:true,status:200,json:async()=>{throw Error('truncated JSON')}};
    if(calls===2)return reply(null);
    return reply({status:'SUCCESS',results:[{url:'https://example/art.png'}]});
  }});assert.equal(calls,3);assert.equal(result.taskId,'paid-task');
});
test('malformed creation responses are never retried and exhausted queries retain their task ID',async()=>{
  let created=0;await assert.rejects(request('model',{}, {key:'test',fetcher:async()=>{created++;return reply(null)}}),/无法识别/);assert.equal(created,1);
  await assert.rejects(poll('paid-task',{key:'test',sleeper:async()=>{},fetcher:async()=>reply(null)}),e=>e.taskId==='paid-task'&&/无法识别/.test(e.message));
  assert.deepEqual(parseResult({status:'SUCCESS',results:{unexpected:true}}).results,[]);
});
