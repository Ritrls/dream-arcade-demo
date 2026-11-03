// Pure rules are shared by the Canvas engine, tests, and standalone exports.
export function createRules() {
  const freshMine = () => ({ credits: 0, total: 0, tool: 0, drones: 0, depth: 1, blocks: 0, hp: 10, maxHp: 10 });
  function restoreMine(value) {
    const s = freshMine();
    if (!value || typeof value !== 'object') return s;
    for (const k of ['credits', 'total', 'tool', 'drones', 'depth', 'blocks', 'hp', 'maxHp']) if (Number.isFinite(value[k]) && value[k] >= 0) s[k] = value[k];
    s.tool = Math.min(50, Math.floor(s.tool)); s.drones = Math.min(50, Math.floor(s.drones)); s.depth = Math.max(1, Math.min(1000, Math.floor(s.depth)));
    s.credits = Math.min(1e12, s.credits); s.total = Math.min(1e12, s.total); s.blocks = Math.floor(s.blocks);
    s.maxHp = 8 + s.depth * 2; s.hp = Math.max(.01, Math.min(s.maxHp, s.hp));
    return s;
  }
  const cost = (s, kind) => Math.floor((kind === 'tool' ? 20 : 35) * 1.6 ** (kind === 'tool' ? s.tool : s.drones));
  function hit(s, damage) {
    let gained = 0, broken = 0, left = Math.max(0, Math.min(1e6, damage));
    while (left > 0 && broken < 500) {
      const used = Math.min(s.hp, left); s.hp -= used; left -= used;
      if (s.hp <= .00001) { const reward = 5 + s.depth * 2; gained += reward; s.credits += reward; s.total += reward; s.blocks++; broken++; s.depth = 1 + Math.floor(s.blocks / 5); s.maxHp = 8 + s.depth * 2; s.hp = s.maxHp; }
    }
    return { gained, broken };
  }
  function buy(s, kind) {
    if (!['tool', 'drone'].includes(kind)) return false;
    const key = kind === 'tool' ? 'tool' : 'drones'; const price = cost(s, kind);
    if (s.credits < price || s[key] >= 50) return false;
    s.credits -= price; s[key]++; return true;
  }
  const clickPower = s => 2 + s.tool * 2;
  const autoPower = s => s.drones * (4 + s.tool * .5);
  // Each row has only one obstacle, leaving two safe lanes.
  const raceRow = random => { const obstacle = Math.min(2, Math.floor(random() * 3)); return { obstacle, pickup: (obstacle + 1 + Math.min(1, Math.floor(random() * 2))) % 3 }; };
  return { freshMine, restoreMine, cost, hit, buy, clickPower, autoPower, raceRow };
}

export function createGame(canvas, options = {}) {
  const rules = createRules(); const ctx = canvas.getContext('2d'); const W = 1000, H = 600;
  canvas.width = W; canvas.height = H;
  let theme = {}, images = {}, mode = options.mode || 'collect', state, frame, last = 0, running = false, paused = false, particles = [], floats = [], elapsed = 0, persistTimer = 0, uiTimer = 0;
  let mine = rules.restoreMine(options.mineSave), pointerX = 500, pointerHeld = false, boostHeld = false, lastMineClick = 0;
  const keys = new Set(), random = options.random || Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const names = () => ({ resource: '月晶', player: '猫猫飞梭', obstacle: '陨石', tool: '月光镐', ...theme.names });
  function setTheme(value) {
    theme = { accent: '#b7f4d2', sky: '#142334', ...value }; images = {};
    for (const kind of ['image', 'atlas']) if (theme[kind]) {
      const image = new Image(); image.crossOrigin = 'anonymous'; const source = theme[kind];
      image.onload = () => {
        if (theme[kind] !== source) return;
        if (kind === 'atlas') {
          try {
            const sheet = document.createElement('canvas'); sheet.width = image.width; sheet.height = image.height;
            const c = sheet.getContext('2d', { willReadFrequently: true }); c.drawImage(image, 0, 0);
            const pixels = c.getImageData(0, 0, sheet.width, sheet.height), d = pixels.data;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 1] > 90 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.28) d[i + 3] = 0;
            }
            c.putImageData(pixels, 0, 0); images.atlas = sheet; options.onAssets?.(sheet);
          } catch { images.atlas = null; options.onAssetError?.('素材图片暂时无法读取，正在使用备用图形。'); }
        } else images.image = image;
      };
      image.onerror = () => options.onAssetError?.('场景素材载入失败，正在使用备用图形。'); image.src = source;
    }
  }
  setTheme(options.theme || {});
  function sprite(index, x, y, size, rotate = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotate);
    if (images.atlas) {
      const sheet = images.atlas, cell = sheet.width / 2, cellH = sheet.height / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, index % 2 * cell, Math.floor(index / 2) * cellH, cell, cellH, -size / 2, -size / 2, size, size);
    } else {
      const colors = ['#f0edf4', theme.accent, '#f58ca5', '#e6b575']; ctx.fillStyle = colors[index];
      if (index === 0) { ctx.fillRect(-size * .2, -size * .4, size * .4, size * .65); ctx.fillStyle = theme.accent; ctx.fillRect(-size * .32, size * .1, size * .64, size * .15); ctx.fillStyle = '#1f2944'; ctx.fillRect(-size * .12, -size * .25, size * .24, size * .18); }
      else { ctx.rotate(Math.PI / 4); ctx.fillRect(-size * .22, -size * .22, size * .44, size * .44); }
    }
    ctx.restore();
  }
  function burst(x, y, color, count = 12) { for (let i = 0; i < count; i++) particles.push({ x, y, vx: (random() - .5) * 220, vy: (random() - .5) * 220, life: .6, color }); }
  function float(text, x, y, color = theme.accent) { floats.push({ text, x, y, life: 1.1, color }); if (floats.length > 24) floats.shift(); }
  function text(value, x, y, size = 20, color = '#f2f4f7', align = 'left') { ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); ctx.textAlign = 'left'; }
  function roundRect(x, y, w, h, color, radius = 12) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
  function backdrop(time) {
    ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
    if (images.image) {
      const img = images.image, scale = Math.max(W / img.width, H / img.height); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
    }
    ctx.fillStyle = mode === 'mine' ? '#08101d88' : '#08101d44'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 28; i++) { ctx.globalAlpha = .25 + Math.sin(time / 700 + i) * .16; ctx.fillStyle = theme.accent; ctx.fillRect((i * 137.5) % W, (i * 43.7 + (mode === 'race' ? elapsed * 15 : 0)) % H, 2, 2); } ctx.globalAlpha = 1;
  }
  function hud(left, middle, right) { roundRect(20, 18, 960, 56, '#0a1222dc'); text(left, 40, 54, 21); text(middle, 500, 54, 20, theme.accent, 'center'); text(right, 958, 54, 20, '#e9eef6', 'right'); }
  function updateCollect(dt) {
    state.spawn -= dt; state.invuln = Math.max(0, state.invuln - dt); state.shield = Math.max(0, state.shield - dt); state.cooldown = Math.max(0, state.cooldown - dt);
    const direction = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    if (direction) { state.x = clamp(state.x + direction * 650 * dt, 35, 965); pointerX = state.x; }
    else state.x += (clamp(pointerX, 35, 965) - state.x) * Math.min(1, dt * 14);
    if (state.spawn <= 0) {
      const danger = random() < .25 + Math.min(.15, elapsed / 180); state.objects.push({ x: 40 + random() * 920, y: -35, type: danger ? 'hazard' : 'resource', speed: 150 + random() * 95 + elapsed * (state.hard ? 5 : 3) });
      state.spawn = Math.max(.19, (state.hard ? .38 : .48) - elapsed * .004);
    }
    state.objects = state.objects.filter(o => {
      o.y += dt * o.speed;
      if (Math.abs(o.x - state.x) < 34 && Math.abs(o.y - 510) < 30) {
        if (o.type === 'resource') {
          state.combo = elapsed - state.lastPickup < 1.5 ? Math.min(5, state.combo + 1) : 1; state.lastPickup = elapsed; state.collected++;
          const points = 10 * state.combo; state.score += points; burst(o.x, o.y, theme.accent); float('+' + points + (state.combo >= 3 ? ` ×${state.combo}` : ''), o.x, o.y);
          if (state.collected % 12 === 0) { state.shield = 4; float('护盾充能！', 500, 240); }
        } else if (state.invuln <= 0) {
          if (state.shield > 0) { state.shield = 0; state.score += 20; float('护盾格挡 +20', o.x, o.y); }
          else { state.lives--; state.combo = 0; burst(o.x, o.y, '#ffa2a8'); float('♥ -1', o.x, o.y, '#ffa2a8'); }
          state.invuln = 1.3;
        }
        return false;
      }
      if (o.y > 630) { if (o.type === 'resource') state.combo = 0; return false; } return true;
    });
    if (state.lives <= 0 || elapsed >= state.duration) finish(state.lives > 0, state.score, `${state.collected} 个${names().resource} · 最高连击 ×${state.combo || 1}`);
  }
  function drawCollect(time) {
    for (const o of state?.objects || []) sprite(o.type === 'resource' ? 1 : 2, o.x, o.y, o.type === 'resource' ? 64 : 75, o.type === 'hazard' ? o.y / 180 : 0);
    const x = state?.x || 500;
    if (!state?.invuln || Math.floor(time / 90) % 2) sprite(0, x, 510, 110);
    if (state?.shield > 0) { ctx.strokeStyle = theme.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, 510, 44 + Math.sin(time / 130) * 3, 0, Math.PI * 2); ctx.stroke(); }
    if (running) {
      hud(`✦ ${state.score}  ♥ ${'●'.repeat(Math.max(0, state.lives))}`, state.combo > 1 ? `连击 ×${state.combo}` : `阶段 ${1 + Math.floor(elapsed / 10)}`, `${Math.max(0, Math.ceil(state.duration - elapsed))} s`);
      text(state.cooldown > 0 ? `护盾冷却 ${Math.ceil(state.cooldown)}s` : '空格 / 技能键：短时护盾', 500, 579, 15, '#d4dfec', 'center');
    }
  }
  function strikeMine() {
    const result = rules.hit(mine, rules.clickPower(mine)); state.swing = .25;
    burst(510, 340, theme.accent, 6); float(result.gained ? `+${result.gained} ${names().resource}` : `-${rules.clickPower(mine)}`, 510 + (random() - .5) * 90, 270);
    if (result.broken) burst(510, 340, '#f9e5b7', 25); emit(); save();
  }
  function updateMine(dt) {
    state.swing = Math.max(0, state.swing - dt);
    if (pointerHeld || keys.has(' ')) { lastMineClick -= dt; if (lastMineClick <= 0) { strikeMine(); lastMineClick = .16; } }
    const result = rules.hit(mine, rules.autoPower(mine) * dt);
    if (result.broken) { burst(510, 340, theme.accent, 15); float(`自动 +${result.gained}`, 510, 280); }
    persistTimer += dt; if (persistTimer > 4) { save(); persistTimer = 0; }
  }
  function drawMine(time) {
    roundRect(210, 135, 580, 360, '#091523b8', 22);
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#ffffff0a'; ctx.lineWidth = 2; ctx.strokeRect(230 + i * 9, 154 + i * 10, 540 - i * 18, 320 - i * 20); }
    const wobble = (state?.swing || 0) * 24 * Math.sin(time / 20);
    ctx.shadowColor = theme.accent; ctx.shadowBlur = 25; sprite(1, 510 + wobble, 327, 250 + Math.sin(time / 450) * 6); ctx.shadowBlur = 0;
    sprite(3, 670, 300, 150, -.3 + (state?.swing || 0) * -3);
    for (let i = 0; i < Math.min(6, mine.drones); i++) { const a = time / 1100 + i * Math.PI / 3; sprite(0, 510 + Math.cos(a) * 220, 328 + Math.sin(a) * 85, 65); }
    text(names().resource + '矿脉', 500, 195, 22, '#f1eaf6', 'center');
    roundRect(350, 449, 300, 13, '#ffffff22', 6); roundRect(350, 449, Math.max(2, mine.hp / mine.maxHp * 300), 13, theme.accent, 6);
    text(`${Math.ceil(mine.hp)} / ${mine.maxHp}`, 500, 487, 16, '#cbd6df', 'center');
    text('点击矿石 / 按住挖掘键，升级后自动生产', 500, 548, 19, '#dce5ec', 'center');
    hud(`◈ ${Math.floor(mine.credits)} ${names().resource}`, `第 ${mine.depth} 层 · ${mine.blocks % 5}/5 矿脉`, `自动 ${rules.autoPower(mine).toFixed(1)}/s`);
    text(`累计开采 ${Math.floor(mine.total)} · ${names().tool}`, 40, 579, 14, '#c7d1df');
  }
  const laneX = (lane, y) => 500 + (lane - 1) * (73 + y * .19);
  function updateRace(dt) {
    const boost = (boostHeld || keys.has(' ')) && state.fuel > 1;
    state.fuel = clamp(state.fuel + (boost ? -31 : 9) * dt, 0, 100); state.boost = boost; state.invuln = Math.max(0, state.invuln - dt); state.slow = Math.max(0, state.slow - dt);
    state.speed = (state.slow > 0 ? 12 : 24 + Math.min(10, elapsed * .2)) + (boost ? 16 : 0);
    state.distance += state.speed * dt; state.spawn -= dt;
    if (state.spawn <= 0) {
      const row = rules.raceRow(random); state.objects.push({ lane: row.obstacle, y: 90, type: 'hazard' });
      if (random() < .75) state.objects.push({ lane: row.pickup, y: 90, type: 'resource' }); state.spawn = Math.max(.72, 1.5 - elapsed * .01 - (state.hard ? .3 : 0));
    }
    state.x += (laneX(state.lane, 510) - state.x) * Math.min(1, dt * 12);
    state.objects = state.objects.filter(o => {
      o.y += (100 + o.y * .6) * dt * state.speed / 24;
      if (Math.abs(o.y - 510) < 35 && Math.abs(laneX(o.lane, o.y) - state.x) < 65) {
        if (o.type === 'resource') { state.fuel = Math.min(100, state.fuel + 22); state.bonus += 25; float('+22 氮气', state.x, 470); burst(state.x, 510, theme.accent); }
        else if (state.invuln <= 0) { state.lives--; state.invuln = 1.8; state.slow = 1.8; burst(state.x, 510, '#ff9b96', 22); float('碰撞！减速', state.x, 450, '#ff9b96'); }
        return false;
      }
      if (o.y > 650) { if (o.type === 'hazard') { state.passed++; state.bonus += 10; } return false; } return true;
    });
    if (state.distance >= state.goal) finish(true, Math.floor(state.distance) + state.bonus, `成功冲线 · 超越 ${state.passed} 个障碍`);
    else if (state.lives <= 0 || elapsed >= state.duration) finish(false, Math.floor(state.distance) + state.bonus, `已跑 ${Math.floor(state.distance)} / ${state.goal} 米`);
  }
  function drawRace(time) {
    const moving = elapsed * (state?.speed || 24) * 4;
    ctx.fillStyle = '#131b2be6'; ctx.beginPath(); ctx.moveTo(370, 90); ctx.lineTo(630, 90); ctx.lineTo(900, 600); ctx.lineTo(100, 600); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const y = 95 + ((i * 60 + moving) % 510), f = (y - 90) / 510; const half = 130 + f * 270;
      for (const side of [-1, 1]) { ctx.fillStyle = i % 2 ? '#f1d7dc' : theme.accent; ctx.fillRect(500 + side * half - 8, y, 16, 20 + f * 20); }
      ctx.fillStyle = '#dae3ef55'; for (const side of [-.5, .5]) ctx.fillRect(500 + side * (73 + y * .19) - 2, y, 4, 19 + f * 20);
    }
    for (const o of [...(state?.objects || [])].sort((a,b) => a.y - b.y)) sprite(o.type === 'resource' ? 1 : 2, laneX(o.lane, o.y), o.y, 30 + o.y * .17);
    const x = state?.x || 500;
    if (state?.boost) { ctx.fillStyle = theme.accent; ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(x - 15, 550); ctx.lineTo(x + 15, 550); ctx.lineTo(x, 595); ctx.fill(); ctx.globalAlpha = 1; }
    if (!state?.invuln || Math.floor(time / 100) % 2) sprite(0, x, 510, 135, (laneX(state?.lane ?? 1, 510) - x) / 1300);
    if (running) {
      hud(`${Math.floor(state.distance)} / ${state.goal} m`, `${Math.round(state.speed * 5)} km/h · ♥ ${state.lives}`, `${Math.max(0, Math.ceil(state.duration - elapsed))} s`);
      roundRect(340, 567, 320, 12, '#ffffff22', 6); roundRect(340, 567, Math.max(2, state.fuel * 3.2), 12, theme.accent, 6); text('NITRO', 320, 580, 14, theme.accent, 'right');
    }
  }
  function finish(survived, score, detail) { if (!running) return; running = false; pointerHeld = boostHeld = false; options.onEnd?.({ mode, score, survived, elapsed: Math.floor(elapsed), detail }); emit(); }
  function save() { options.onSave?.({ ...mine }); }
  function emit() {
    options.onState?.({ mode, running, paused, elapsed, ...(mode === 'mine' ? { ...mine, toolCost: rules.cost(mine, 'tool'), droneCost: rules.cost(mine, 'drone'), clickPower: rules.clickPower(mine), autoPower: rules.autoPower(mine) } : state) });
  }
  function action(kind, active = true) {
    if (!running || paused) return false;
    if (mode === 'mine') {
      if (kind === 'primary' && active) { strikeMine(); return true; }
      if (kind === 'tool' || kind === 'drone') { const bought = rules.buy(mine, kind); if (bought) { float(kind === 'tool' ? '工具升级！' : '自动采集 +1', 500, 230); save(); emit(); } return bought; }
    } else if (mode === 'race') {
      if (kind === 'left' && active) state.lane = Math.max(0, state.lane - 1);
      if (kind === 'right' && active) state.lane = Math.min(2, state.lane + 1);
      if (kind === 'primary') boostHeld = active;
    } else {
      if (kind === 'left') { if (active) keys.add('arrowleft'); else keys.delete('arrowleft'); }
      if (kind === 'right') { if (active) keys.add('arrowright'); else keys.delete('arrowright'); }
      if (kind === 'primary' && active && state.cooldown <= 0) { state.shield = 2.2; state.cooldown = 9; }
    }
    emit(); return true;
  }
  function keydown(e) {
    if (!running || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const key = String(e.key || '').toLowerCase(); if (['arrowleft', 'arrowright', ' ', 'a', 'd', 'p'].includes(key)) e.preventDefault();
    keys.add(key); if (key === 'p' && !e.repeat) pause();
    if (mode === 'race' && !e.repeat) { if (['a', 'arrowleft'].includes(key)) action('left'); if (['d', 'arrowright'].includes(key)) action('right'); }
    if (mode === 'collect' && key === ' ' && !e.repeat) action('primary');
  }
  function keyup(e) { keys.delete(String(e.key || '').toLowerCase()); }
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  function move(e) { const p = point(e); pointerX = p.x; if (mode === 'race' && pointerHeld && state) state.lane = clamp(Math.round((p.x - 500) / 170) + 1, 0, 2); }
  function down(e) {
    canvas.focus(); canvas.setPointerCapture?.(e.pointerId); pointerHeld = true; move(e);
    if (mode === 'mine' && running && !paused) { strikeMine(); lastMineClick = .16; }
  }
  function release() { pointerHeld = boostHeld = false; keys.clear(); }
  function hidden() { if (document.hidden) { release(); save(); if (running && !paused) pause(); } }
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', release);
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); document.addEventListener('visibilitychange', hidden);
  function pause() { if (running) { paused = !paused; release(); options.onPause?.(paused); emit(); save(); } }
  function start(config = {}) {
    mode = config.mode || mode; const duration = Math.max(15, Number(config.duration) || 45); elapsed = 0; persistTimer = 0; particles = []; floats = []; release();
    state = mode === 'mine' ? { swing: 0 } : mode === 'race' ? { x: 500, lane: 1, fuel: 100, distance: 0, speed: 24, bonus: 0, passed: 0, goal: duration * 24, objects: [], spawn: .9, lives: 3, invuln: 0, slow: 0, hard: config.difficulty === 'hard', duration } : { x: 500, score: 0, collected: 0, combo: 0, lastPickup: -10, objects: [], spawn: .35, shield: 0, cooldown: 0, lives: 3, invuln: 0, duration, hard: config.difficulty === 'hard' };
    pointerX = 500; running = true; paused = false; canvas.focus(); options.onPause?.(false); emit();
  }
  function stop() { running = false; paused = false; release(); state = null; particles = []; floats = []; save(); emit(); }
  function tick(time) {
    const dt = Math.min((time - last) / 1000 || 0, .04); last = time;
    if (running && !paused) { elapsed += dt; if (mode === 'collect') updateCollect(dt); else if (mode === 'mine') updateMine(dt); else updateRace(dt); }
    if (!paused) { particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0); floats.forEach(f => { f.y -= dt * 35; f.life -= dt; }); floats = floats.filter(f => f.life > 0); }
    backdrop(time);
    if (mode === 'mine') drawMine(time); else if (mode === 'race') drawRace(time); else drawCollect(time);
    for (const p of particles) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 5, 5); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = Math.min(1, f.life * 2); text(f.text, f.x, f.y, 22, f.color, 'center'); } ctx.globalAlpha = 1;
    if (running && paused) { ctx.fillStyle = '#09101ddd'; ctx.fillRect(0, 0, W, H); text('已暂停 · 按 P 或暂停键继续', 500, 310, 30, '#f7f7f7', 'center'); }
    uiTimer += dt; if (uiTimer > .25) { uiTimer = 0; emit(); } frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return { start, stop, pause, action, setTheme, save, setMode(value) { stop(); mode = ['collect', 'mine', 'race'].includes(value) ? value : 'collect'; emit(); }, inspect() { return { mode, running, paused, mine: { ...mine }, state: state ? { ...state } : null }; }, destroy() { save(); cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', release); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release); document.removeEventListener('visibilitychange', hidden); } };
}
