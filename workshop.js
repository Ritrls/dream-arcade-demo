import { createGame } from './games.js';
import { makeStandalone } from './standalone.js';
import { request, poll, MODEL } from './runninghub.js';
const $ = id => document.getElementById(id);
const worlds = {
  forest: { id: 'forest', name: '月光秘境', image: 'assets/moonlight-forest.png', atlas: 'assets/forest-atlas.png', accent: '#b7f4d2', sky: '#142334', source: 'RunningHub AI 素材', prompt: '月光下的魔法森林，发光水晶、漂浮岛屿，猫猫木质飞行车与古老的紫色矿石。', names: { resource: '月晶', player: '猫猫飞梭', obstacle: '紫晶陨石', tool: '月光镐' } },
  city: { id: 'city', name: '霓虹边境', image: 'assets/neon-background.png', atlas: 'assets/neon-atlas.png', accent: '#ffc294', sky: '#30223b', source: 'RunningHub AI 素材', prompt: '电子日落下的紫色荒漠，橙色悬浮赛车、能量电池、工业路障与科幻采矿钻头。', names: { resource: '能量芯', player: '橙焰赛车', obstacle: '警戒桶', tool: '离子钻' } }
};
const templates = {
  collect: { title: '星光收集', kicker: '01 / STAR COLLECTOR', description: '接住资源积累连击，展开护盾，挑战越来越密集的障碍。', hint: '← → / A D / 拖动移动 · 空格 / 技能键展开护盾', summary: '连击 ×5 · 每 12 个资源获得护盾 · 3 次生命', action: '✦ 展开护盾' },
  mine: { title: '增量矿场', kicker: '02 / IDLE MINER', description: '开采矿脉，升级工具，雇佣自动采集，深入下一层。进度自动保存。', hint: '点击 / 按住矿石或挖掘键 · 空格持续开采', summary: '持续经营 · 每 5 块矿脉深入一层 · 自动保存', action: '⚒ 按住开采' },
  race: { title: '极速夜航', kicker: '03 / NEON RACER', description: '三车道换道超越障碍，收集燃料，按住氮气冲过终点。', hint: '← → / A D 换道 · 拖动转向 · 按住空格 / 氮气键加速', summary: '限时冲线 · 安全换道 · 收集燃料 · 3 次碰撞机会', action: '↯ 按住氮气' }
};
let mode = 'collect', current = { ...worlds.forest }, style = 'pixel', apiKey = '', busy = false, controller, job = null, saveErrorShown = false, statsSecond = -1;
function readStorage(key, fallback = null) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function persistJob() { try { if (job) sessionStorage.setItem('dream-arcade-theme-job', JSON.stringify(job)); else sessionStorage.removeItem('dream-arcade-theme-job'); } catch {} }
try { job = JSON.parse(sessionStorage.getItem('dream-arcade-theme-job') || 'null'); } catch {}
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function renderAssets(sheet) { for (let i = 0; i < 4; i++) { const canvas = $(`asset-${i}`), c = canvas.getContext('2d'); c.clearRect(0, 0, 100, 100); c.imageSmoothingEnabled = false; c.drawImage(sheet, i % 2 * sheet.width / 2, Math.floor(i / 2) * sheet.height / 2, sheet.width / 2, sheet.height / 2, 0, 0, 100, 100); } }
function onState(s) {
  const second = Math.floor(s.elapsed || 0);
  if (s.mode === 'mine') {
    $('buy-tool').disabled = !s.running || s.paused || s.credits < s.toolCost || s.tool >= 50; $('buy-drone').disabled = !s.running || s.paused || s.credits < s.droneCost || s.drones >= 50;
    $('tool-cost').textContent = `${s.toolCost} ${current.names.resource}`; $('drone-cost').textContent = `${s.droneCost} ${current.names.resource}`;
    $('mine-progress').textContent = `第 ${s.depth} 层 · 工具 Lv.${s.tool} · 自动采集 ${s.drones} 台`;
    if (second !== statsSecond || !s.running) $('live-game-stats').textContent = `${Math.floor(s.credits)} ${current.names.resource} · 单击 ${s.clickPower} · 自动 ${s.autoPower.toFixed(1)}/s · 累计 ${Math.floor(s.total)}`;
  } else if (second !== statsSecond || !s.running) {
    $('live-game-stats').textContent = s.running ? (s.mode === 'race' ? `${Math.floor(s.distance)} / ${s.goal} 米 · 氮气 ${Math.floor(s.fuel)}% · 超越 ${s.passed} 个障碍` : `已收集 ${s.collected} 个${current.names.resource} · 连击 ×${s.combo || 1} · 护盾${s.cooldown > 0 ? '冷却 ' + Math.ceil(s.cooldown) + 's' : '就绪'}`) : templates[mode].summary;
  }
  statsSecond = second;
}
const game = createGame($('game'), { mode, theme: current, mineSave: readStorage('dream-arcade-mine-v2'), onAssets: renderAssets, onAssetError: message => toast(message), onState,
  onSave: value => { if (!writeStorage('dream-arcade-mine-v2', value) && !saveErrorShown) { saveErrorShown = true; toast('浏览器存储不可用，本次矿场进度只保留到页面关闭。'); } },
  onEnd: result => {
    const key = 'dream-arcade-best-' + result.mode, best = Math.max(result.score, readStorage(key, 0)); writeStorage(key, best);
    $('overlay-title').textContent = result.survived ? (result.mode === 'race' ? '冲线成功！' : '冒险完成！') : '再挑战一次';
    $('overlay-description').textContent = `${result.detail} · 本次 ${result.score} 分 · 最高 ${best}`; $('play').textContent = '↻ 再玩一局'; $('overlay').hidden = false; $('pause').disabled = true;
  }, onPause: paused => { $('pause').textContent = paused ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? '继续游戏' : '暂停游戏'); }
});
function resetOverlay() {
  const template = templates[mode]; $('overlay').hidden = false; $('overlay-title').textContent = current.name; $('overlay-description').textContent = template.description; $('game-kicker').textContent = template.kicker; $('controls-hint').textContent = template.hint; $('game-summary').textContent = template.summary; $('control-primary').textContent = template.action;
  $('play').textContent = mode === 'mine' ? '⚒ 开始 / 继续开采' : '▶ 开始挑战'; $('pause').disabled = true; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', '暂停游戏');
  $('mine-controls').hidden = mode !== 'mine'; $('control-left').hidden = $('control-right').hidden = mode === 'mine'; $('duration').disabled = mode === 'mine'; $('difficulty').disabled = mode === 'mine';
  $('game').setAttribute('aria-label', template.title + '游戏画面；' + template.hint); $('live-game-stats').textContent = template.summary; statsSecond = -1;
}
function chooseMode(next) { mode = next; game.setMode(mode); document.querySelectorAll('[data-mode]').forEach(b => { const yes = b.dataset.mode === mode; b.classList.toggle('selected', yes); b.setAttribute('aria-pressed', String(yes)); }); resetOverlay(); }
function chooseWorld(world, preset) {
  game.stop(); current = { ...world, names: { ...world.names } }; game.setTheme(current); resetOverlay(); $('world-title').textContent = current.name; $('source-badge').textContent = current.source;
  $('prompt').value = current.prompt || ''; $('theme-name').value = current.name; $('resource-name').value = current.names.resource;
  document.querySelectorAll('[data-world]').forEach(card => { const yes = card.dataset.world === preset; card.classList.toggle('selected', yes); card.setAttribute('aria-pressed', String(yes)); });
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => chooseMode(b.dataset.mode));
document.querySelectorAll('[data-world]').forEach(b => { if (b.dataset.world === 'ocean') { b.remove(); return; } const world = worlds[b.dataset.world]; b.querySelector('img').src = world.image; b.querySelector('h3').textContent = world.name; b.querySelector('p').textContent = world.names.player + ' · ' + world.names.resource; b.onclick = () => chooseWorld(world, b.dataset.world); });
document.querySelectorAll('[data-style]').forEach(button => button.onclick = () => { style = button.dataset.style; document.querySelectorAll('[data-style]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); });
$('surprise').onclick = () => { const ideas = [{ name: '糖果星港', resource: '糖晶', prompt: '糖果做的太空港，粉色云朵、饼干飞船、彩色糖晶、巧克力陨石与棒棒糖矿镐。' }, { name: '深海遗迹', resource: '海蓝石', prompt: '深海的失落古城，水母潜艇、海蓝水晶、珊瑚礁障碍与贝壳采矿工具。' }]; const idea = ideas[Math.floor(Math.random() * ideas.length)]; $('theme-name').value = idea.name; $('resource-name').value = idea.resource; $('prompt').value = idea.prompt; };
$('play').onclick = () => { $('overlay').hidden = true; $('pause').disabled = false; game.start({ mode, duration: Number($('duration').value), difficulty: $('difficulty').value }); };
$('pause').onclick = () => game.pause();
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.preview').requestFullscreen(); } catch { toast('当前浏览器不支持全屏，可直接开始游戏。'); } };
for (const direction of ['left', 'right', 'primary']) {
  const button = $('control-' + direction); let heldTimer;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture?.(e.pointerId); game.action(direction, true); if (direction === 'primary' && mode === 'mine') heldTimer = setInterval(() => game.action('primary'), 160); });
  const release = () => { clearInterval(heldTimer); game.action(direction, false); }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  button.addEventListener('keydown', e => { if (e.key === 'Enter') game.action(direction, true); }); button.addEventListener('keyup', e => { if (e.key === 'Enter') release(); });
}
$('buy-tool').onclick = () => { game.action('tool'); }; $('buy-drone').onclick = () => { game.action('drone'); };
$('open-settings').onclick = () => { $('api-key').value = apiKey; $('settings').showModal(); };
$('close-settings').onclick = () => $('settings').close(); $('settings').addEventListener('close', () => $('api-key').value = '');
$('settings-form').onsubmit = e => { e.preventDefault(); apiKey = $('api-key').value.trim(); $('key-dot').classList.toggle('mint', !!apiKey); $('settings').close(); toast(apiKey ? '已连接 RunningHub' : '已清除 API Key'); };
function taskUI() { $('task-actions').hidden = !job; $('resume').hidden = busy; $('stop-waiting').hidden = !busy; $('discard-task').hidden = busy; $('task-id').textContent = job ? job.parts.filter(p => p.taskId).map(p => `${p.kind === 'image' ? '场景' : '素材'} ${p.taskId}`).join(' · ') : ''; }
function setBusy(value) { busy = value; $('generate').disabled = value; $('generate').textContent = value ? '✧ 正在制作完整主题…' : '✦ 生成完整主题 ↗'; for (const id of ['prompt', 'theme-name', 'resource-name']) $(id).disabled = value; taskUI(); }
const stylePrompts = { pixel: 'Refined 16-bit pixel art, crisp pixel edges.', dream: 'Whimsical hand-painted videogame illustration, clear silhouettes, soft rich colors.', neon: 'Polished retro-futuristic game art, neon cyberpunk palette, clear silhouettes.' };
function promptsFor(snapshot) {
  const common = `Theme: ${snapshot.prompt}. ${stylePrompts[snapshot.style]} `;
  return {
    image: common + 'Create a wide 16:9 videogame environment backdrop. Rich atmospheric scenery at edges, open clear middle suitable for gameplay. No characters, vehicles, text, letters or UI.',
    atlas: common + `Create exactly FOUR game sprites in a 2 by 2 equal square cell atlas. One isolated object per cell, centered with 20 percent padding. Top-left: unique theme-matching player vehicle, direct overhead TOP DOWN view, nose pointing straight UP. Top-right: collectible ${snapshot.resource} resource or mineral cluster. Bottom-left: dangerous theme-matching obstacle or boulder. Bottom-right: theme-matching mining pickaxe or drill tool. Pure solid flat RGB(0,255,0) chroma green background, absolutely no green in objects. No scenery, no shadows on background, no grid borders, no text, no labels, no watermark. Bold coherent videogame assets, complete objects fully inside each cell.`
  };
}
async function toDataURL(url, signal) {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }); if (!res.ok) throw Error('素材下载失败，请稍后继续完成主题。');
  const blob = await res.blob(); if (!blob.type.startsWith('image/')) throw Error('返回素材不是图片。');
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}
async function generate(resume = false) {
  if (busy) return;
  if (!apiKey) { $('settings').showModal(); return; }
  if (!resume && job) { status('已有未完成主题，请继续完成，或先清除本地记录。', true); return; }
  if (!resume) {
    const prompt = $('prompt').value.trim(); if (!prompt) { $('prompt').focus(); status('请先描述想要的主题。', true); return; }
    job = { prompt, style, name: $('theme-name').value.trim() || '我的新世界', resource: $('resource-name').value.trim() || '主题晶石', parts: [{ kind: 'image' }, { kind: 'atlas' }] }; persistJob();
  }
  if (!job) return; controller = new AbortController(); setBusy(true);
  try {
    const prompts = promptsFor(job), assets = {};
    for (const part of job.parts) {
      const label = part.kind === 'image' ? '1/2 场景' : '2/2 游戏素材'; status(`正在制作 ${label}…`);
      const opts = { key: apiKey, signal: controller.signal, onStatus(state, taskId) { part.taskId = taskId; persistJob(); taskUI(); status(`${label} · ${({ CREATE: '已创建', QUEUED: '排队中', RUNNING: '正在绘制', SUCCESS: '下载素材' })[state] || '查询中'}`); } };
      if (!part.taskId) {
        if (part.attempted) throw Error('上次提交结果不明，请先检查 RunningHub 调用记录；为避免重复计费，不会自动再次提交。');
        part.attempted = true; persistJob(); const submitted = await request(MODEL, { prompt: prompts[part.kind], aspectRatio: part.kind === 'image' ? '16:9' : '1:1' }, opts);
        if (!submitted.taskId) throw Error('未收到任务编号，请检查 RunningHub 调用记录。'); part.taskId = submitted.taskId; persistJob(); taskUI();
      }
      if (!part.url) { const result = await poll(part.taskId, opts); part.url = result.url; persistJob(); }
      assets[part.kind] = await toDataURL(part.url, controller.signal);
      const img = new Image(); img.src = assets[part.kind]; await img.decode();
    }
    const colors = { pixel: '#b7f4d2', dream: '#d5b7fa', neon: '#ffc294' };
    chooseWorld({ id: 'custom', name: job.name, prompt: job.prompt, ...assets, accent: colors[job.style], sky: '#182338', source: 'RunningHub AI 素材', names: { resource: job.resource, player: job.name + '载具', obstacle: '主题路障', tool: '采集工具' } });
    job = null; persistJob(); status('完整主题已就绪：场景、载具、资源、障碍和工具已替换，可切换三种玩法。'); toast('完整主题生成成功！');
  } catch (e) { status(e.name === 'AbortError' ? '已停止等待。任务可能仍在 RunningHub 运行，点击继续完成主题即可恢复。' : e.message, e.name !== 'AbortError'); }
  finally { setBusy(false); }
}
$('generate').onclick = () => generate(); $('resume').onclick = () => generate(true); $('stop-waiting').onclick = () => controller?.abort();
$('discard-task').onclick = () => { job = null; persistJob(); taskUI(); status('已清除本地记录；这不会取消 RunningHub 任务或撤销计费。'); };
$('export').onclick = async () => {
  const button = $('export'); button.disabled = true; button.textContent = '打包中…';
  try {
    const theme = { ...current, image: await toDataURL(current.image), atlas: await toDataURL(current.atlas) }, config = { mode, duration: Number($('duration').value), difficulty: $('difficulty').value }, mineSave = game.inspect().mine;
    const html = makeStandalone(theme, config, mineSave, templates[mode]);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = `dream-arcade-${mode}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('已导出当前模板、主题素材和矿场进度，可离线游玩');
  } catch { toast('素材打包失败，请检查网络后再试。'); } finally { button.disabled = false; button.textContent = '↓ 导出游戏'; }
};
chooseWorld(current, 'forest'); taskUI(); if (job) status('发现未完成的完整主题。填写原来的 Key 后可继续，无需重复创建已提交的任务。');
window.addEventListener('pagehide', () => { game.save(); controller?.abort(); });
