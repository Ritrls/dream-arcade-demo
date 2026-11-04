// Time is displayed independently from the live status, so screen readers do not
// announce every tick. No invented percentage: RunningHub supplies task states.
export function generationFeedback(progress, now = Date.now()) {
  const startedAt=Number.isFinite(progress.startedAt)?progress.startedAt:now,elapsed = Math.max(0, now - startedAt), checked = Number.isFinite(progress.checkedAt) ? Math.max(0, now - progress.checkedAt) : null;
  const responseLag=now-Math.max(progress.checkedAt??startedAt,progress.attemptStartedAt??startedAt);
  const seconds = Math.floor(elapsed / 1000), clock = String(Math.floor(seconds / 60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  const states = {CREATE:'正在提交任务',QUERY:'正在查询已有任务',QUEUED:'RunningHub 排队中',RUNNING:'RunningHub 正在处理',SUCCESS:'结果已就绪',DOWNLOAD:'正在下载单位素材'};
  let hint = '可以先用预设队员游玩。完成后，新单位会自动加入阵容。';
  if (progress.state==='QUERY'&&responseLag<=20000) hint='正在查询已保存的任务，不会重新提交生成。';
  else if (responseLag>20000) hint='本次连接响应偏慢。任务记录会保留，请勿反复提交；可以停止等待，稍后继续查询。';
  else if (elapsed>=90000&&progress.state!=='DOWNLOAD') hint=progress.state==='QUEUED'?'平台排队时间较长。可以停止本页等待，稍后继续同一任务。':'平台处理时间较长，最近仍有状态响应。可以先玩预设，或停止等待后继续同一任务。';
  return {status:progress.label+' · '+(states[progress.state]||'正在查询状态'),timing:'本阶段耗时 '+clock+' · '+(checked===null?'等待首次响应':'最近响应 '+Math.floor(checked/1000)+' 秒前'),hint};
}
