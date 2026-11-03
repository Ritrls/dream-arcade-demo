import { createGame } from './engine.js';
import { generateScene, poll } from './runninghub.js';
const $ = id => document.getElementById(id);
const worlds = {
  forest: { name: '月光森林', image: 'assets/forest.svg', accent: '#b7f4d2', sky: '#112433', prompt: '月光下的魔法森林，发光水晶、漂浮岛屿，还有漫天的萤火虫。', source: '预设世界' },
  ocean: { name: '星海漫游', image: 'assets/ocean.svg', accent: '#d5b7fa', sky: '#201d40', prompt: '温柔的紫色银河，漂浮的星球与晶莹的星尘，驶向宇宙深处。', source: '预设世界' },
  city: { name: '霓虹夜航', image: 'assets/city.svg', accent: '#ffb4c3', sky: '#30223b', prompt: '电子日落下的霓虹城市，粉紫色天空、赛博高楼与闪烁的灯光。', source: '预设世界' }
};
let current = { ...worlds.forest }, style = 'pixel', apiKey = '', controller, activeTask = '', busy = false;
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4200); }
function storageGet(key, fallback = '') { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* storage is optional */ } }
function rememberTask(taskId) { try { sessionStorage.setItem('dream-arcade-task', taskId); } catch { /* optional */ } }
try { activeTask = sessionStorage.getItem('dream-arcade-task') || ''; } catch { /* optional */ }
function taskUI() { $('task-actions').hidden = !activeTask; $('task-id').textContent = activeTask ? `任务 ${activeTask}` : ''; $('resume').hidden = busy || !activeTask; $('stop-waiting').hidden = !busy; }
function setBusy(value) { busy = value; $('generate').disabled = value; $('generate').textContent = value ? '✧ 世界正在生成…' : '✦ 生成我的游戏 ↗'; $('prompt').disabled = value; taskUI(); }
function setStatus(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function resetOverlay() { $('overlay').hidden = false; $('overlay-title').textContent = current.name; $('overlay-description').textContent = '驾驶小猫飞船，接住星星，躲开陨石。'; $('play').textContent = '▶ 开始冒险'; $('pause').disabled = true; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', '暂停游戏'); }
const game = createGame($('game'), { theme: current, onEnd: result => {
  const best = Math.max(result.score, Number(storageGet('dream-arcade-best', '0')) || 0); storageSet('dream-arcade-best', best);
  $('overlay-title').textContent = result.survived ? '冒险完成！' : '下次再出发';
  $('overlay-description').textContent = `本次 ${result.score} 分 · 最高 ${best} 分 · 探索了 ${result.elapsed} 秒`;
  $('play').textContent = '↻ 再玩一局'; $('overlay').hidden = false; $('pause').disabled = true;
}, onPause: paused => { $('pause').textContent = paused ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? '继续游戏' : '暂停游戏'); } });
function switchWorld(world, presetId) {
  current = { ...world }; game.stop(); game.setTheme(current); resetOverlay();
  $('world-title').textContent = current.name; $('source-badge').textContent = current.source;
  if (presetId) $('prompt').value = world.prompt;
  document.querySelectorAll('.world-card').forEach(card => { const selected = card.dataset.world === presetId; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); });
}
// An actual RunningHub-generated asset is bundled permanently, rather than using its expiring URL.
fetch('assets/generation.json').then(r => r.ok ? r.json() : null).then(meta => {
  if (!meta) return;
  worlds.forest.image = meta.image; worlds.forest.source = 'RunningHub AI'; $('forest-thumb').src = meta.image;
  if (current.image === 'assets/forest.svg') switchWorld(worlds.forest, 'forest');
}).catch(() => {});
document.querySelectorAll('.world-card').forEach(card => card.addEventListener('click', () => { switchWorld(worlds[card.dataset.world], card.dataset.world); toast(`已切换到${current.name}`); }));
document.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
  style = button.dataset.style;
  document.querySelectorAll('[data-style]').forEach(b => { const selected = b === button; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
}));
$('surprise').onclick = () => { const prompts = ['橘子汽水色的云上小镇，漂浮鲸鱼从屋顶游过，柔软的黄昏。', '雨夜的猫咪便利店，霓虹招牌和倒映在水中的紫色月亮。', '糖果做的太空站，薄荷色星云与粉色水晶环绕着小行星。', '远古图书馆漂浮在宇宙中，蓝色书页化作流星，金色光芒。']; $('prompt').value = prompts[Math.floor(Math.random() * prompts.length)]; };
$('play').onclick = () => { $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'Ⅱ'; game.start({ duration: Number($('duration').value), difficulty: $('difficulty').value }); };
$('pause').onclick = () => game.pause();
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('game-stage').requestFullscreen) await $('game-stage').requestFullscreen(); else toast('当前浏览器不支持全屏，可以直接开始游戏。'); } catch { toast('当前浏览器不支持全屏。'); } };
$('open-settings').onclick = () => { $('api-key').value = apiKey; $('settings').showModal(); };
$('close-settings').onclick = () => { $('api-key').value = ''; $('settings').close(); };
$('settings').addEventListener('close', () => $('api-key').value = '');
$('settings-form').onsubmit = e => { e.preventDefault(); apiKey = $('api-key').value.trim(); $('key-dot').classList.toggle('mint', !!apiKey); $('api-key').value = ''; $('settings').close(); toast(apiKey ? '连接已保存，可以生成新世界了' : '已清除 API Key'); };
const stylePrompts = { pixel: 'Refined 16-bit pixel art, crisp pixel edges, retro videogame landscape.', dream: 'Dreamy hand-painted illustration, soft atmospheric light, whimsical fantasy concept art.', neon: 'Retro-futuristic neon art, cyberpunk palette, glowing outlines, atmospheric synthwave.' };
async function runGeneration(resume = false) {
  if (busy) return;
  if (!apiKey) { $('settings').showModal(); setStatus('填写自己的 API Key 后，再点击生成。预设世界可直接玩。'); return; }
  const prompt = $('prompt').value.trim();
  if (!resume && !prompt) { $('prompt').focus(); setStatus('先描述一下想去的世界吧。', true); return; }
  if (resume && !activeTask) return;
  controller = new AbortController(); setBusy(true); setStatus(resume ? '正在重新查询已有任务…' : '正在提交你的世界…');
  const snapshot = { prompt, style };
  try {
    const opts = { key: apiKey, signal: controller.signal, onStatus(status, taskId) {
      activeTask = taskId; rememberTask(taskId); taskUI();
      const labels = { CREATE: '任务已创建', QUEUED: '正在排队', RUNNING: 'AI 正在绘制场景', SUCCESS: '场景已生成，正在载入' };
      setStatus(`${labels[status] || '正在查询'} · 可以先玩一局，完成后会自动载入。`);
    } };
    const artPrompt = `Create a wide landscape background for a 2D arcade game. Scene: ${prompt}. ${stylePrompts[style]} Rich layered environment, clear open middle area for gameplay, detailed scenery around the edges. No text, letters, UI, watermarks or foreground playable characters. Landscape 16:9.`;
    const result = resume ? await poll(activeTask, opts) : await generateScene(artPrompt, opts);
    let image = result.url;
    try { image = await toDataURL(result.url, controller.signal); } catch { if (controller.signal.aborted) throw controller.signal.reason; }
    const picture = new Image(); picture.src = image; await picture.decode();
    const accents = { pixel: '#b7f4d2', dream: '#d5b7fa', neon: '#ffb4c3' };
    switchWorld({ name: '我的造梦世界', image, accent: accents[snapshot.style], sky: '#142233', prompt: snapshot.prompt, source: 'RunningHub AI', taskId: result.taskId });
    activeTask = ''; rememberTask(''); setStatus('你的世界已就绪！点击开始冒险，也可以导出离线游戏。'); toast('新世界生成成功，出发吧！');
  } catch (error) {
    if (error.name === 'AbortError') setStatus('已停止本页等待；RunningHub 任务可能仍在运行，点击继续查询即可恢复。');
    else setStatus(error.message || '生成失败，请稍后重试。', true);
  } finally { setBusy(false); }
}
$('generate').onclick = () => runGeneration(); $('resume').onclick = () => runGeneration(true);
$('stop-waiting').onclick = () => controller?.abort();
async function toDataURL(url, signal) {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error('图片下载失败');
  const blob = await res.blob(); if (!blob.type.startsWith('image/')) throw new Error('返回内容不是图片');
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
$('export').onclick = async () => {
  const button = $('export'); button.disabled = true; button.textContent = '正在打包…';
  try {
    const snapshot = { ...current, image: await toDataURL(current.image) };
    const config = { duration: Number($('duration').value), difficulty: $('difficulty').value };
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>造梦街机 · 我的小游戏</title><style>body{margin:0;background:#10121b;color:#f3f2ef;font-family:system-ui;text-align:center}main{max-width:1000px;margin:35px auto;padding:15px}h1{font-size:24px}canvas{width:100%;aspect-ratio:5/3;touch-action:none;border-radius:12px}button{background:#b7f4d2;color:#142b24;border:0;border-radius:6px;padding:12px 25px;margin:12px 6px;cursor:pointer}p{color:#a7afc4;font-size:12px}</style><main><h1 id="name"></h1><canvas id="game" tabindex="0"></canvas><div><button id="start">开始 / 再玩一局</button><button id="pause">暂停 / 继续</button></div><p id="result">方向键 / A D / 鼠标 / 触屏移动 · 收集星星，躲开陨石 · P 暂停</p><p>造梦街机 Dream Arcade · 场景由 RunningHub AI 或预设插画提供</p></main><script>const createGame=${createGame.toString()};const theme=${safeJSON(snapshot)};const config=${safeJSON(config)};document.getElementById('name').textContent=theme.name;const game=createGame(document.getElementById('game'),{theme,onEnd:r=>{document.getElementById('result').textContent='本局得分：'+r.score+' · '+(r.survived?'冒险完成':'再试一次！')}});document.getElementById('start').onclick=()=>{document.getElementById('result').textContent='收集星星，躲开陨石 · P 暂停';game.start(config)};document.getElementById('pause').onclick=()=>game.pause();<\/script></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'dream-arcade-game.html'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('已导出独立 HTML，双击文件即可离线玩');
  } catch { toast('暂时无法下载场景图片。请检查网络，或选择预设世界后再导出。'); }
  finally { button.disabled = false; button.textContent = '↓ 导出游戏'; }
};
taskUI();
if (activeTask) setStatus('发现未完成的任务。填入原来的 API Key 后可继续查询，无需重复生成。');
window.addEventListener('pagehide', () => controller?.abort());
