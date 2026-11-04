import { request, poll, MODEL } from './runninghub.js';
import { createUnitModel } from './unit-model.js';
export const TEXT_MODEL = 'rhart-text-qwen-27b/chat';
export function validUnitJob(job) { return !!job && typeof job.idea === 'string' && typeof job.id === 'string' && job.design && job.art && typeof job.design === 'object' && typeof job.art === 'object'; }
export function attachUnitTask(job, taskId) {
  if (!validUnitJob(job) || typeof taskId!=='string' || !/^[A-Za-z0-9_-]{4,100}$/.test(taskId)) throw Error('请输入平台调用记录里的有效任务编号。');
  const part = job.unit ? job.art : job.design;
  if (part.taskId && !part.recovered) throw Error('这个阶段已有任务编号，请直接继续制造。');
  part.taskId = taskId; part.attempted = true; part.recovered = true;
  return job;
}
export function unitPrompts(idea, design) {
  return {
    design: '你是迷你策略游戏的原创单位设计师。按描述生成一名单位，只输出JSON对象，不要markdown或解释。字段：name(中文<=10字),description(中文<=45字),role(assault/guard/sniper/worker),health(35-240整数),damage(5-32整数),range(80-260整数),interval(0.65-2.2攻击间隔秒),speed(30-90整数),ability(none/slow/burst/shield),spritePrompt(英文外观描述<=500字符)。技能只能选一个，体现描述中的优缺点。description只描述外观、性格与已支持的技能，不得声称具有其他能力。不要代码或外部链接。单位描述：' + idea,
    art: 'One isolated full-body playable strategy game character centered with 20 percent padding. Charming polished 16-bit pixel art, three-quarter side view facing RIGHT, bold readable silhouette. ' + (design?.spritePrompt || idea) + '. Pure flat solid RGB(255,0,255) magenta background. Do not use magenta or pink on the character. No floor shadow, scenery, text, labels, border or UI.'
  };
}
export async function generateUnit(job, options) {
  if (!validUnitJob(job)) throw Error('单位任务记录不完整，请清除后重新创建。');
  const { key, signal, changed = () => {}, progress = () => {}, download, now = Date.now, submit = (endpoint, payload, opts) => request(endpoint, payload, opts), query = (id, opts) => poll(id, opts) } = options;
  const model = createUnitModel();
  async function run(part, endpoint, payload, output, label) {
    signal?.throwIfAborted();
    if (!Number.isFinite(part.startedAt)) { part.startedAt = now(); changed(job); }
    const attemptStartedAt=now();
    const report = state => progress(label,state,{startedAt:part.startedAt,checkedAt:part.checkedAt,attemptStartedAt,output});
    report(part.taskId?'QUERY':'CREATE');
    const opts = { key, signal, output, onStatus(status, taskId) { part.taskId = taskId; part.status=status; part.checkedAt=now(); changed(job); report(status); } };
    if (!part.taskId) {
      if (part.attempted) throw Error('上次提交结果不明，为避免重复计费不会自动再创建。请先查看 RunningHub 调用记录。');
      part.attempted = true; changed(job); const created = await submit(endpoint, payload, opts);
      if (!created.taskId) throw Error('未收到任务编号，请先查看 RunningHub 调用记录。'); part.taskId = created.taskId; changed(job);
    }
    return query(part.taskId, opts);
  }
  if (!job.unit) { const result = await run(job.design, TEXT_MODEL, { prompt: unitPrompts(job.idea).design }, 'text', '1/2 设计属性与技能'); job.unit = { ...model.parse(result.text), id: job.id }; changed(job); }
  if (!job.art.url) { const result = await run(job.art, MODEL, { prompt: unitPrompts(job.idea, job.unit).art, aspectRatio: '1:1' }, 'image', '2/2 绘制单位素材'); job.art.url = result.url; changed(job); }
  let src;
  progress('保存单位素材','DOWNLOAD',{startedAt:now(),checkedAt:now(),output:'download'});
  try { src = await download(job.art.url, signal); }
  catch (error) { if (!signal?.aborted) { delete job.art.url; changed(job); } throw error; }
  return model.balance({ ...job.unit, source: 'RunningHub AI', sprite: { src, chroma: 'magenta' } }, job.id);
}

export function draftUnit(idea, presetUnits, id) {
  const model = createUnitModel();
  const role = /矿|采集|生产|工人/.test(idea) ? 'worker' : /盾|坦克|耐打|乌龟|肉盾/.test(idea) ? 'guard' : /远程|射程|狙击|远/.test(idea) ? 'sniper' : 'assault';
  const base = presetUnits.find(u => u.role === role), raw = { ...base, id, source: '规则试配', name: ({ assault:'轻翼突击手',guard:'坚壳守卫',sniper:'远望队员',worker:'勤劳采集员' })[role], description: '根据关键词试配属性，使用预设素材；可直接上场。' };
  if (/冰|冻|减速/.test(idea)) raw.ability='slow'; else if (/爆发|重炮|火/.test(idea)) raw.ability='burst';
  if (/脆|玻璃|胆小/.test(idea)) raw.health*=.6; if (/快|灵活|敏捷/.test(idea)) raw.speed*=1.3; if (/高攻|重炮|伤害高/.test(idea)) raw.damage*=1.35;
  return model.balance(raw,id);
}
