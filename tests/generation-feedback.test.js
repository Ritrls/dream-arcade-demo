import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generationFeedback} from '../generation-feedback.js';
test('long-running tasks distinguish slow generation from an unresponsive query',()=>{
  const p={label:'1/2 设计属性与技能',state:'RUNNING',startedAt:1000,checkedAt:120000};
  const slow=generationFeedback(p,126000);assert.match(slow.timing,/02:05/);assert.match(slow.timing,/6 秒前/);assert.match(slow.hint,/平台处理时间较长/);
  const disconnected=generationFeedback(p,151000);assert.match(disconnected.hint,/连接响应偏慢/);assert.match(disconnected.timing,/31 秒前/);
  assert.match(generationFeedback({...p,state:'QUEUED'},126000).hint,/平台排队时间较长/);
});
test('resume keeps the original stage duration while allowing a fresh query to connect',()=>{
  const p={label:'1/2 设计属性与技能',state:'QUERY',startedAt:1000,checkedAt:2000,attemptStartedAt:600000};
  const f=generationFeedback(p,600001);assert.match(f.timing,/09:59/);assert.match(f.hint,/不会重新提交/);
  assert.doesNotMatch(generationFeedback({label:'保存素材',state:'DOWNLOAD',startedAt:600000,checkedAt:600000},601000).hint,/时间较长/);
});
