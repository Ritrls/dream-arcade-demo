// The official .ai gateway has valid CORS headers. The .cn gateway returned
// duplicate Access-Control-Allow-Origin headers during browser verification.
export const API_BASE = 'https://www.runninghub.ai/openapi/v2';
export const MODEL = 'rhart-image-v1/text-to-image';
export class RunningHubError extends Error {
  constructor(message, taskId = '') { super(message); this.name = 'RunningHubError'; this.taskId = taskId; }
}
export function parseResult(raw) {
  const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
  return { taskId: String(data.taskId || data.task_id || ''), status: String(data.status || '').toUpperCase(), results: data.results || [], raw };
}
const delay = (ms, signal) => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
  const stop = () => { done(); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { done(); resolve(); }, ms);
  signal?.addEventListener('abort', stop, { once: true });
});
export async function request(path, payload, { key, signal, fetcher = fetch, retry = false, sleeper = delay } = {}) {
  if (!key?.trim()) throw new RunningHubError('请先填写 RunningHub API Key。');
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetcher(`${API_BASE}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000) });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (retry && attempt < 2) { await sleeper(1500 * 2 ** attempt, signal); continue; }
      throw new RunningHubError(path === 'query' ? '无法连接 RunningHub，请检查网络后继续查询。' : '提交响应未送达，任务可能已创建。请先在 RunningHub 调用记录确认，再重新生成，避免重复计费。');
    }
    if (retry && (response.status === 429 || response.status >= 500) && attempt < 2) { await sleeper(1500 * 2 ** attempt, signal); continue; }
    let raw;
    try { raw = await response.json(); } catch { throw new RunningHubError('RunningHub 返回了无法识别的响应，请稍后查询任务。'); }
    if (!response.ok || (raw.code != null && String(raw.code) !== '0') || raw.errorCode) {
      const hints = { 401: 'API Key 无效或已过期。', 403: 'API Key 没有权限；模型接口需要企业共享 Key。', 429: '请求较多，请稍后再试。' };
      throw new RunningHubError(hints[response.status] || String(raw.errorMessage || raw.msg || raw.message || `请求失败（${response.status}）`).split(key).join('[已隐藏]'));
    }
    return parseResult(raw);
  }
}
export async function poll(taskId, options = {}) {
  const { interval = 5000, timeout = 600000, onStatus = () => {}, sleeper = delay, now = Date.now, signal } = options;
  const start = now();
  while (now() - start < timeout) {
    signal?.throwIfAborted();
    let result;
    try { result = await request('query', { taskId }, { ...options, retry: true }); }
    catch (error) { error.taskId = taskId; throw error; }
    onStatus(result.status, taskId);
    if (result.status === 'SUCCESS') {
      const url = result.results.map(r => r.url || r.outputUrl).find(u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } });
      if (!url) throw new RunningHubError('任务完成，但没有返回图片链接。', taskId);
      return { ...result, taskId, url };
    }
    if (['FAILED', 'CANCEL', 'CANCELED', 'CANCELLED'].includes(result.status)) throw new RunningHubError(result.raw.errorMessage || result.raw.data?.errorMessage || '生成失败或任务已取消，请在 RunningHub 查看详情。', taskId);
    await sleeper(interval, signal);
  }
  throw new RunningHubError('等待超过 10 分钟。任务可能仍在运行，可点击继续查询。', taskId);
}
export async function generateScene(prompt, options = {}) {
  // Creation is deliberately not retried: a dropped response may already have created a paid task.
  const result = await request(MODEL, { prompt, aspectRatio: '16:9' }, options);
  if (!result.taskId) throw new RunningHubError('没有收到任务编号，请先查看 RunningHub 调用记录，避免重复付费。');
  options.onStatus?.(result.status || 'CREATE', result.taskId);
  return poll(result.taskId, options);
}
