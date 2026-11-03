import { createUnitModel } from './unit-model.js';
import { createMiningRules } from './mining-rules.js';

export function createBattleGame(canvas, options = {}) {
  const model = createUnitModel(), mining = createMiningRules(), ctx = canvas.getContext('2d');
  const W = 1000, H = 600, STEP = 1 / 60, now = options.now || Date.now, rng = options.random || Math.random;
  canvas.width = W; canvas.height = H;
  let mode = options.mode || 'defense', theme = {}, roster = [], portraits = new Map(), sources = new Map(), image, selected = '', state, running = false, paused = false, last = null, accumulator = 0, frame, elapsed = 0, emitClock = 0, saveClock = 0;
  let mine = mining.restoreMine(options.mineSave), held = false, repeat = 0, cursor = { row: 2, col: 2 }, group = null, nextId = 1, particles = [], messages = [];
  const keys = new Set(), clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = () => roster.find(u => u.id === selected) || roster[0];
  const resource = () => theme.names?.resource || '月晶';
  function notice(text) { options.onNotice?.(text); }
  function say(text, x = 500, y = 250, color = '#bbf4d7') { messages.push({ text, x, y, color, life: 1.3 }); if (messages.length > 20) messages.shift(); }
  function spark(x, y, color, count = 10) { for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .5) * 150, life: .5, color }); if (particles.length > 240) particles.splice(0, particles.length - 240); }
  function text(value, x, y, size = 18, color = '#eef5f4', align = 'left') { ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); ctx.textAlign = 'left'; }
  function panel(x, y, w, h, color = '#0b1728d9', r = 10) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function bar(x, y, w, ratio, color) { panel(x, y, w, 6, '#0008', 3); panel(x, y, Math.max(1, w * clamp(ratio, 0, 1)), 6, color, 3); }
  function loadImage(src) {
    if (!sources.has(src)) sources.set(src, new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src; }));
    return sources.get(src);
  }
  function loadPortrait(u) {
    if (!u.sprite?.src) return;
    const key = JSON.stringify(u.sprite);
    if (portraits.get(u.id)?.key === key) return;
    loadImage(u.sprite.src).then(img => {
      if (JSON.stringify(roster.find(r => r.id === u.id)?.sprite) !== key) return;
      const cut = document.createElement('canvas'); cut.width = cut.height = 192; const c = cut.getContext('2d', { willReadFrequently: true });
      const isSheet = Number.isInteger(u.sprite.cell), sw = isSheet ? img.width / 2 : img.width, sh = isSheet ? img.height / 2 : img.height, cell = u.sprite.cell || 0;
      c.imageSmoothingEnabled = false; c.drawImage(img, isSheet ? cell % 2 * sw : 0, isSheet ? Math.floor(cell / 2) * sh : 0, sw, sh, 0, 0, 192, 192);
      if (u.sprite.chroma) {
        const pixels = c.getImageData(0, 0, 192, 192), d = pixels.data;
        for (let i = 0; i < d.length; i += 4) if (u.sprite.chroma === 'magenta' ? d[i] > 90 && d[i + 2] > 90 && d[i] > d[i + 1] * 1.35 && d[i + 2] > d[i + 1] * 1.35 : d[i + 1] > 90 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.28) d[i + 3] = 0;
        c.putImageData(pixels, 0, 0);
      }
      portraits.set(u.id, { key, canvas: cut }); options.onPortrait?.(u.id, cut.toDataURL());
    }).catch(() => notice('一张单位素材未能载入，正在使用备用图标。'));
  }
  function setRoster(values) { roster = values.slice(0, 12).map(u => model.balance(u, u.id)); if (!roster.some(u => u.id === selected)) selected = roster[0]?.id || ''; roster.forEach(loadPortrait); emit(); }
  function setTheme(value) { theme = { accent: '#bbf4d7', sky: '#142535', ...value }; image = null; if (theme.image) { const src = theme.image; loadImage(src).then(img => { if (theme.image === src) image = img; }).catch(() => {}); } }
  function sprite(u, x, y, size = 76) {
    const portrait = portraits.get(u.id)?.canvas;
    if (portrait) { ctx.imageSmoothingEnabled = false; ctx.drawImage(portrait, x - size / 2, y - size / 2, size, size); }
    else { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(x, y, size * .25, 0, Math.PI * 2); ctx.fill(); text(u.name?.slice(0, 1) || '✦', x, y + 7, 18, '#172c2a', 'center'); }
  }
  function enemySprite(e) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = e.slow > 0 ? '#a6dafa' : e.heavy ? '#bb82ba' : '#df8fbc';
    ctx.beginPath(); ctx.ellipse(0, -3, e.heavy ? 28 : 22, e.heavy ? 28 : 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#452c59'; ctx.fillRect(-16, -16, 10, 8); ctx.fillRect(7, -16, 10, 8); ctx.fillStyle = '#fbf2d5'; ctx.fillRect(-16, -8, 9, 9); ctx.fillRect(6, -8, 9, 9); ctx.fillStyle = '#342c4a'; ctx.fillRect(-14, -6, 4, 5); ctx.fillRect(8, -6, 4, 5);
    ctx.fillStyle = '#694a78'; ctx.fillRect(-24, 13, 13, 9); ctx.fillRect(10, 13, 13, 9); ctx.restore(); bar(e.x - 24, e.y - 38, 48, e.hp / e.maxHp, '#f4a3b8');
  }
  function save() { mine.savedAt = now(); options.onSave?.({ ...mine, workers: (mine.workers || []).map(w => ({ ...w })) }); }
  const offlineGain = mining.offline(mine, now()); if (offlineGain) { notice(`离线采集带回 ${offlineGain} 资源，欢迎回来！`); save(); }
  function energy() { return mode === 'mine' ? mine.credits : state?.energy || 0; }
  function deployCost(u) { return mode === 'mine' ? model.miningCost(u, mine.workers?.find(w => w.id === u.id)?.count || 0) : u.cost; }
  function incoming() {
    if (!state || mode !== 'defense' || !running) return null;
    if (state.left > 0) return { row: (state.wave + state.left) % 5, seconds: Math.max(1, Math.ceil(state.nextSpawn)) };
    if (!state.enemies.length && state.wave < 5) { const wave = state.wave + 1; return { row: (wave + 2 + wave + (state.hard ? 1 : 0)) % 5, seconds: Math.max(1, Math.ceil(state.between + 1)) }; }
    return null;
  }
  function emit() { options.onState?.({ mode, running, paused, elapsed, selected, energy: energy(), roster, costs: Object.fromEntries(roster.map(u => [u.id, deployCost(u)])), toolCost: mining.cost(mine, 'tool'), power: mining.clickPower(mine), autoPower: mining.autoPower(mine), mine: { ...mine }, wave: state?.wave || 0, enemies: state?.enemies?.length || 0, home: state?.home?.hp ?? 5, enemyBase: state?.enemyBase?.hp, captured: state?.posts?.filter(p => p.capture >= .95).length || 0, population: state?.allies?.length || 0 }); }
  function finish(win, detail) { if (!running) return; running = false; release(); options.onEnd?.({ mode, win, detail, elapsed: Math.round(elapsed), score: state.kills * 25 + Math.round(Math.max(0,state.home.hp)) * 5, kills: state.kills, hard: state.hard }); emit(); }
  function start(config = {}) {
    mode = ['defense', 'rts', 'mine'].includes(config.mode) ? config.mode : mode;
    elapsed = accumulator = saveClock = emitClock = 0; last = null; particles = []; messages = []; release(); group = null;
    state = { hard: config.difficulty === 'hard', energy: mode === 'defense' ? 180 : 170, allies: [], enemies: [], bullets: [], kills: 0, wave: 0, left: 0, nextSpawn: mode === 'defense' ? 2.5 : 5, between: 2, rally: { x: 340, y: 205 }, home: { id: 'home', x: mode === 'rts' ? 85 : 54, y: 300, hp: mode === 'rts' ? 450 : 5, maxHp: mode === 'rts' ? 450 : 5, team: 'ally', base: true, cooldown: 0 }, enemyBase: { id: 'enemy-base', x: 910, y: 300, hp: 650, maxHp: 650, team: 'enemy', base: true, cooldown: 0 }, posts: [{ x: 340, y: 205, capture: 0 }, { x: 500, y: 405, capture: 0 }, { x: 660, y: 205, capture: 0 }], swing: 0 };
    running = true; paused = false; options.onPause?.(false); canvas.focus({ preventScroll: true }); emit();
  }
  function stop() { running = false; paused = false; state = null; release(); save(); emit(); }
  function setMode(value) { stop(); mode = ['defense', 'rts', 'mine'].includes(value) ? value : 'defense'; emit(); }
  function select(id) { if (roster.some(u => u.id === id)) selected = id; emit(); }
  function formationPoint(center, index) {
    const radius = Math.min(92, 33 * Math.sqrt(index)), angle = index * 2.399963229728653;
    return { x: clamp(center.x + Math.cos(angle) * radius, 100, 940), y: clamp(center.y + Math.sin(angle) * radius, 110, 520) };
  }
  function addAlly(u, x, y, row, col) { const ally = { ...u, id: 'ally-' + nextId++, unitId: u.id, x, y, row, col, hp: u.health, maxHp: u.health, cooldown: .25, attacks: 0, slow: 0, team: 'ally', dest: formationPoint(state.rally, state.allies.length) }; state.allies.push(ally); spark(x, y, theme.accent); return ally; }
  function deploy(row = cursor.row, col = cursor.col) {
    if (!running || paused || !unit()) return false;
    const u = unit(), price = deployCost(u);
    if (energy() < price) { notice(`还差 ${Math.ceil(price - energy())} ${mode === 'mine' ? resource() : '能量'}。`); return false; }
    if (mode === 'mine') {
      const existing = mine.workers.find(w => w.id === u.id);
      if (!existing && mine.workers.length >= 12) { notice('矿场最多雇佣 12 类队员，可以继续增加已有队员的数量。'); return false; }
      if (existing && existing.count >= 50) return false;
      mine.credits -= price; if (existing) existing.count++; else mine.workers.push({ id: u.id, damage: u.damage, interval: u.interval, count: 1 });
      say(`${u.name}加入采集`, 500, 215); save(); emit(); return true;
    }
    if (state.allies.length >= 24) { notice('场上最多 24 名队员，等一等前线的战友。'); return false; }
    if (mode === 'defense') {
      if (row < 0 || row > 4 || col < 0 || col > 5) { notice('先选单位，再点草地格子放置。'); return false; }
      if (state.allies.some(a => a.row === row && a.col === col)) { notice('这个格子已有队员，换一格试试。'); return false; }
      addAlly(u, 175 + col * 110, 166 + row * 82, row, col);
    } else addAlly(u, 115 + rng() * 35, 250 + rng() * 100);
    state.energy -= price; emit(); return true;
  }
  function hit(target, damage, ability) {
    if (target.hp <= 0) return;
    target.hp = Math.max(0, target.hp - damage * (target.ability === 'shield' ? .7 : 1));
    if (ability === 'slow' && !target.base) target.slow = 2.5;
    spark(target.x, target.y, target.team === 'enemy' ? '#efb3ce' : theme.accent, 4);
    if (target.hp <= 0 && target.team === 'enemy' && !target.base) { state.kills++; state.energy = Math.min(999, state.energy + 12); say('+12', target.x, target.y - 35); }
  }
  function shoot(attacker, target) { attacker.attacks = (attacker.attacks || 0) + 1; const burst = attacker.ability === 'burst' && attacker.attacks % 3 === 0; state.bullets.push({ x: attacker.x, y: attacker.y - 8, target, damage: attacker.damage * (burst ? 1.7 : 1), ability: attacker.ability, color: attacker.team === 'enemy' ? '#f69db4' : attacker.ability === 'slow' ? '#a0e9ff' : burst ? '#ffe1a4' : theme.accent }); attacker.cooldown = attacker.interval || 1; }
  function spawnEnemy(row) {
    const heavy = (state.wave >= 3 || elapsed > 40) && rng() < .25, wave = Math.max(1, state.wave);
    const hp = (mode === 'defense' ? 50 + wave * 12 : 75 + elapsed * .4) * (heavy ? 1.6 : 1) * (state.hard ? 1.2 : 1);
    state.enemies.push({ id: 'enemy-' + nextId++, x: 955, y: mode === 'defense' ? 166 + row * 82 : 150 + rng() * 300, row, hp, maxHp: hp, damage: 7 + wave, interval: 1.1, cooldown: .7, speed: heavy ? 18 : mode === 'defense' ? 24 : 38, range: 85, slow: 0, heavy, team: 'enemy' });
  }
  function updateDefense(dt) {
    state.energy = Math.min(999, state.energy + (state.hard ? 8 : 10) * dt);
    if (state.left === 0 && state.enemies.length === 0) {
      state.between -= dt;
      if (state.between <= 0) { state.wave++; if (state.wave > 5) { finish(true, state.home.hp===5?'完美防守！五波来客全部击退。':`五波进攻结束，保住了 ${state.home.hp} 点防线！`); return; } state.left = 2 + state.wave + (state.hard ? 1 : 0); state.nextSpawn = 1; state.energy = Math.min(999, state.energy + 20); say(`第 ${state.wave} / 5 波`, 500, 95); }
    }
    if (state.left > 0) { state.nextSpawn -= dt; if (state.nextSpawn <= 0) { spawnEnemy((state.wave + state.left) % 5); state.left--; state.nextSpawn = Math.max(2, 4.5 - state.wave * .35); state.between = 3; } }
    for (const a of state.allies) { a.cooldown -= dt; const target = state.enemies.filter(e => e.hp > 0 && e.row === a.row && e.x >= a.x - 15 && e.x - a.x <= a.range * 2.1).sort((x,y) => x.x - y.x)[0]; if (target && a.cooldown <= 0) shoot(a, target); }
    for (const e of state.enemies) {
      e.cooldown -= dt; e.slow = Math.max(0, e.slow - dt);
      const target = state.allies.filter(a => a.hp > 0 && a.row === e.row && a.x < e.x + 10 && e.x - a.x < 47).sort((a,b) => b.x - a.x)[0];
      if (target) { if (e.cooldown <= 0) { hit(target, e.damage); e.cooldown = e.interval; } }
      else e.x -= e.speed * (e.slow > 0 ? .45 : 1) * dt;
      if (e.x < 65) { e.hp = 0; state.home.hp = Math.max(0,state.home.hp - 1); say('防线 -1', 110, e.y, '#ffbdba'); }
    }
    if (state.home.hp <= 0) finish(false, `防线失守，守到了第 ${state.wave} 波。试试前排守卫、后排远程。`);
    else if (elapsed >= 180) finish(false, '挑战时间到。调整阵容，再守一回。');
  }
  function walk(a, target, dt) { const d = distance(a, target); if (d > 4) { const amount = Math.min(d, a.speed * (a.slow > 0 ? .45 : 1) * dt); a.x += (target.x - a.x) / d * amount; a.y = clamp(a.y + (target.y - a.y) / d * amount, 105, 525); } }
  function separate(actors, dt) {
    for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i], b = actors[j]; if (a.hp <= 0 || b.hp <= 0) continue;
      const d = distance(a, b); if (d >= 42) continue;
      const dx = d > .001 ? (b.x - a.x) / d : 1, dy = d > .001 ? (b.y - a.y) / d : 0, push = Math.min((42 - d) / 2, 36 * dt);
      a.x = clamp(a.x - dx * push, 75, 950); a.y = clamp(a.y - dy * push, 105, 525);
      b.x = clamp(b.x + dx * push, 75, 950); b.y = clamp(b.y + dy * push, 105, 525);
    }
  }
  function updateRTS(dt) {
    for (const post of state.posts) { const friends = state.allies.filter(a => a.hp > 0 && distance(a, post) < 105).length, foes = state.enemies.filter(e => e.hp > 0 && distance(e, post) < 105).length; if (friends !== foes) post.capture = clamp(post.capture + Math.sign(friends - foes) * dt * .2, -1, 1); }
    state.energy = Math.min(999, state.energy + (5 + state.posts.filter(p => p.capture >= .95).length * 3) * dt);
    state.nextSpawn -= dt; if (state.nextSpawn <= 0) { spawnEnemy(0); state.nextSpawn = Math.max(3.8, (state.hard ? 6.5 : 8) - elapsed / 60); }
    for (const [actors, targets, base] of [[state.allies, state.enemies, state.enemyBase], [state.enemies, state.allies, state.home]]) {
      for (const a of actors) {
        if (a.hp <= 0) continue; a.cooldown -= dt; a.slow = Math.max(0, a.slow - dt);
        const nearby = targets.filter(t => t.hp > 0 && distance(a,t) <= a.range).sort((x,y) => distance(a,x) - distance(a,y))[0];
        const target = nearby || (distance(a, base) < a.range + 15 ? base : null);
        if (target) { if (a.cooldown <= 0) shoot(a, target); }
        else walk(a, a.team === 'ally' ? a.dest : state.home, dt);
      }
      separate(actors, dt);
    }
    for (const base of [state.home, state.enemyBase]) { base.cooldown -= dt; const targets = base.team === 'ally' ? state.enemies : state.allies, target = targets.find(t => t.hp > 0 && distance(base, t) < 170); if (target && base.cooldown <= 0) { shoot({ ...base, damage: 10, interval: 1.5, ability: 'none' }, target); base.cooldown = 1.5; } }
    if (state.enemyBase.hp <= 0) finish(true, `对方核心已攻破！控制据点，让增援源源不断。`);
    else if (state.home.hp <= 0) finish(false, '核心被攻破。先占据点，再集结推进。');
    else if (elapsed >= 150) finish(false, '战役时间到，核心未被攻破。下次试试远程与守卫协同。');
  }
  function strike() { if (!running || paused || mode !== 'mine') return; const old = mine.depth, result = mining.hit(mine, mining.clickPower(mine)); state.swing = .22; spark(500, 325, theme.accent, result.broken ? 22 : 5); say(result.gained ? `+${result.gained} ${resource()}` : `-${mining.clickPower(mine)}`, 500 + (Math.random() - .5) * 65, 265); if (mine.depth > old) say(`第 ${mine.depth} 层！`, 500, 190, '#ffe6aa'); emit(); }
  function updateMine(dt) { state.swing = Math.max(0, state.swing - dt); repeat -= dt; if ((held || keys.has(' ')) && repeat <= 0) { strike(); repeat = .16; } const result = mining.hit(mine, mining.autoPower(mine) * dt); if (result.broken) { say(`采集 +${result.gained}`, 500, 245); spark(500,325,theme.accent); } }
  function update(dt) {
    elapsed += dt;
    if (mode === 'defense') updateDefense(dt); else if (mode === 'rts') updateRTS(dt); else updateMine(dt);
    if (mode !== 'mine') {
      state.bullets = state.bullets.filter(b => { if (b.target.hp <= 0) return false; const d = distance(b, b.target); if (d < 14) { hit(b.target, b.damage, b.ability); return false; } const move = Math.min(d, 520 * dt); b.x += (b.target.x - b.x) / d * move; b.y += (b.target.y - b.y) / d * move; return true; });
      state.allies = state.allies.filter(a => a.hp > 0); state.enemies = state.enemies.filter(e => e.hp > 0);
      if (group && !state.allies.some(a => group.has(a.id))) { group = null; notice('所选队员已撤离，已切回全军指挥。'); }
    }
    saveClock += dt; if (saveClock > 4) { save(); saveClock = 0; }
  }
  function backdrop() { ctx.fillStyle = theme.sky; ctx.fillRect(0,0,W,H); if (image) { const scale = Math.max(W/image.width,H/image.height); ctx.drawImage(image,(W-image.width*scale)/2,(H-image.height*scale)/2,image.width*scale,image.height*scale); } ctx.fillStyle = mode === 'mine' ? '#0b152779' : '#0a1629a6'; ctx.fillRect(0,0,W,H); }
  function drawUnit(a) { if (a.ability === 'shield') { ctx.strokeStyle = '#c8dff255'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x,a.y,31,0,Math.PI*2); ctx.stroke(); } sprite({ ...a, id: a.unitId },a.x,a.y,76); bar(a.x-25,a.y-39,50,a.hp/a.maxHp,theme.accent); if (mode === 'rts' && (!group || group.has(a.id))) { ctx.strokeStyle = '#c0ffe288'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(a.x,a.y+23,26,9,0,0,Math.PI*2); ctx.stroke(); } }
  function draw(time) {
    backdrop();
    if (mode === 'defense') {
      panel(110,115,680,420,'#182f31a8',14);
      for (let row=0;row<5;row++) for (let col=0;col<6;col++) { ctx.fillStyle=(row+col)%2 ? '#bbdfad14':'#a4d5d908';ctx.fillRect(120+col*110,125+row*82,108,80); }
      if (running && !paused) {
        const x=175+cursor.col*110,y=166+cursor.row*82,occupied=state.allies.some(a=>a.row===cursor.row&&a.col===cursor.col),u=unit();
        ctx.strokeStyle=occupied?'#ffd5a4':theme.accent;ctx.lineWidth=2;ctx.strokeRect(x-53,y-39,104,76);
        if(u&&!occupied){ctx.fillStyle='#bbf4d219';ctx.fillRect(x,y-33,Math.min(960-x,u.range*2.1),66);ctx.globalAlpha=.38;sprite(u,x,y,70);ctx.globalAlpha=1;}
        const next=incoming();if(next){const y=166+next.row*82;panel(823,y-27,141,54,'#332c3de8');text('◀ 第 '+(next.row+1)+' 路',892,y-2,18,'#ffd5b9','center');text(next.seconds+' 秒后来客',892,y+18,12,'#e5b8c2','center');}
      }
      text('守护区',56,110,13,'#d5e8da','center'); for(let i=0;i<(state?.home.hp??5);i++) text('♥',55,180+i*63,23,'#c4f9dc','center');
    } else if(mode==='rts') {
      ctx.strokeStyle='#a9cfbc22';ctx.lineWidth=36;ctx.beginPath();ctx.moveTo(90,300);ctx.lineTo(340,205);ctx.lineTo(500,405);ctx.lineTo(660,205);ctx.lineTo(910,300);ctx.stroke();
      for(const post of state?.posts||[{x:340,y:205,capture:0},{x:500,y:405,capture:0},{x:660,y:205,capture:0}]){const color=post.capture>=.95?theme.accent:post.capture<=-.95?'#f3aac5':'#b0c4d9';panel(post.x-31,post.y-30,62,60,'#132239d9');text('⚑',post.x,post.y+12,32,color,'center');bar(post.x-32,post.y+39,64,Math.abs(post.capture),color);}
      for(const base of state?[state.home,state.enemyBase]:[{x:85,y:300,hp:450,maxHp:450,team:'ally'},{x:910,y:300,hp:650,maxHp:650,team:'enemy'}]){const color=base.team==='ally'?theme.accent:'#e7a4c1';panel(base.x-38,base.y-45,76,90,'#1b2b43e8');text('✦',base.x,base.y+14,42,color,'center');bar(base.x-38,base.y-58,76,base.hp/base.maxHp,color);text(base.team==='ally'?'我方核心':'对方核心',base.x,base.y+69,14,color,'center');}
      if(state?.rally){ctx.strokeStyle='#c5ffdf88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(state.rally.x,state.rally.y,14+Math.sin(time/180)*3,0,Math.PI*2);ctx.stroke();text('增援集结点',state.rally.x,state.rally.y-24,12,'#d5f6e3','center');}
      if(group){for(const a of state.allies.filter(a=>group.has(a.id))){ctx.strokeStyle='#c9ffe344';ctx.lineWidth=1;ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(a.x,a.y,a.range,0,Math.PI*2);ctx.moveTo(a.x,a.y);ctx.lineTo(a.dest.x,a.dest.y);ctx.stroke();ctx.setLineDash([]);}}
      if(running)text(group?'单兵指挥 · 点地图移动 / 全军集结切回':'全军指挥 · 点地图推进 / 点队员单选',500,578,16,'#d0e4df','center');
    } else {
      panel(220,140,560,350,'#142439a9',20);const rare=(mine.blocks+1)%10===0;ctx.shadowColor=rare?'#ffe2a2':theme.accent;ctx.shadowBlur=24;ctx.fillStyle=rare?'#ffdaa0':'#9de8df';ctx.save();ctx.translate(500+(state?.swing||0)*Math.sin(time/18)*20,320);ctx.rotate(Math.PI/4);ctx.fillRect(-62,-62,124,124);ctx.fillStyle=rare?'#bd9361':'#4c9cae';ctx.fillRect(-35,-35,70,70);ctx.restore();ctx.shadowBlur=0;text(rare?'✦ 稀有矿 · 四倍收益':resource()+'矿脉',500,188,22,rare?'#ffe2a2':'#e0eef3','center');bar(350,445,300,mine.hp/mine.maxHp,theme.accent);text(Math.ceil(mine.hp)+' / '+mine.maxHp,500,480,16,'#d0e0ec','center');
      mine.workers.forEach((w,i)=>{const u=roster.find(u=>u.id===w.id);if(u){const x=260+i%6*95,y=520+Math.floor(i/6)*42;sprite(u,x,y,53);text('×'+w.count,x+19,y+20,12,'#d7e8ee','center');}});text('点击 / 按住矿石开采，雇佣单位后自动生产',500,105,18,'#c6d8e8','center');
    }
    if(state && mode!=='mine'){state.allies.forEach(drawUnit);state.enemies.forEach(enemySprite);for(const b of state.bullets){ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
    panel(16,15,968,55,'#0a1627ed');
    text(mode==='mine'?`${Math.floor(mine.credits)} ${resource()}`:`✦ ${Math.floor(state?.energy||0)} 能量`,36,50,20,theme.accent);
    text(mode==='defense'?`庭院守卫 · 第 ${Math.min(5,state?.wave||0)} / 5 波`:mode==='rts'?`据点 ${state?.posts.filter(p=>p.capture>=.95).length||0} / 3 · 集结推进`:`第 ${mine.depth} 层 · 自动 ${mining.autoPower(mine).toFixed(1)}/s`,500,50,20,'#eff4f6','center');
    text(mode==='mine'?`累计 ${Math.floor(mine.total)}`:mode==='rts'?`${Math.max(0,Math.ceil(150-elapsed))} s`:`防线 ${state?.home.hp??5}`,964,50,18,'#d4dff0','right');
    for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
    for(const m of messages){ctx.globalAlpha=Math.min(1,m.life*2);text(m.text,m.x,m.y,21,m.color,'center');}ctx.globalAlpha=1;
    if(running&&paused){ctx.fillStyle='#0b1626d9';ctx.fillRect(0,0,W,H);text('已暂停 · 按 P 或暂停键继续',500,300,28,'#f7fbf8','center');}
  }
  function action(kind, active = true) {
    if (!running || paused) return false;
    if(kind==='hold'){held=active;repeat=.16;return true;}
    if(kind==='primary'){if(mode==='mine')strike();else if(mode==='defense')return deploy();else{group=null;notice('全军已选中：点击地图设置集结点。');}return true;}
    if(kind==='tool'&&mode==='mine'){const ok=mining.buy(mine,'tool');if(ok){say('工具升级！',500,215);save();emit();}return ok;}
    if(kind==='deploy')return deploy();return false;
  }
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
  function pointerMove(e){const p=point(e);cursor={row:clamp(Math.floor((p.y-125)/82),0,4),col:clamp(Math.floor((p.x-120)/110),0,5)};}
  function pointerDown(e){if(!running||paused)return;canvas.focus({ preventScroll: true });canvas.setPointerCapture?.(e.pointerId);const p=point(e);pointerMove(e);if(mode==='mine'){strike();held=true;repeat=.16;}else if(mode==='defense'){if(p.x>=120&&p.x<=780&&p.y>=125&&p.y<=535)deploy();}else{const hit=state.allies.filter(a=>distance(a,p)<30).sort((a,b)=>distance(a,p)-distance(b,p))[0];if(hit){group=new Set([hit.id]);notice(hit.name+'已选中，点击目标位置移动。');}else{const target={x:clamp(p.x,100,920),y:clamp(p.y,110,525)},squad=state.allies.filter(a=>!group||group.has(a.id));if(!group)state.rally=target;squad.forEach((a,i)=>a.dest=formationPoint(target,i));say(group?'单兵移动':'全军推进',target.x,target.y-35);spark(p.x,p.y,theme.accent,5);}}emit();}
  function release(){held=false;keys.clear();}
  function pause(){if(running){paused=!paused;last=null;accumulator=0;release();save();options.onPause?.(paused);emit();}}
  function keydown(e){if(!running||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;const key=String(e.key||'').toLowerCase();if([' ','p','arrowleft','arrowright','arrowup','arrowdown'].includes(key))e.preventDefault();keys.add(key);if(key==='p'&&!e.repeat)pause();if(/^[1-9]$/.test(key)&&!e.repeat){const u=roster[Number(key)-1];if(u){select(u.id);options.onSelect?.(u.id);}}if(mode==='defense'&&!e.repeat){if(key==='arrowleft')cursor.col=Math.max(0,cursor.col-1);if(key==='arrowright')cursor.col=Math.min(5,cursor.col+1);if(key==='arrowup')cursor.row=Math.max(0,cursor.row-1);if(key==='arrowdown')cursor.row=Math.min(4,cursor.row+1);if(key===' ')deploy();}if(mode==='rts'&&key===' '&&!e.repeat)action('primary');}
  function keyup(e){keys.delete(String(e.key||'').toLowerCase());}
  function hidden(){if(document.hidden){release();save();if(running&&!paused)pause();}}
  function tick(time){const delta=last===null?0:Math.max(0,(time-last)/1000);last=time;if(running&&!paused&&delta>1.5){pause();notice('页面短暂卡顿，已安全暂停。');}if(running&&!paused){accumulator+=delta;while(accumulator+1e-9>=STEP&&running&&!paused){update(STEP);accumulator-=STEP;}}const dt=Math.min(delta,.1);if(!paused){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);messages.forEach(m=>{m.y-=dt*25;m.life-=dt;});messages=messages.filter(m=>m.life>0);}draw(time);emitClock+=dt;if(emitClock>.25){emitClock=0;emit();}frame=requestAnimationFrame(tick);}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',release);document.addEventListener('visibilitychange',hidden);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  setTheme(options.theme||{});setRoster(options.roster||[]);frame=requestAnimationFrame(tick);
  return{start,stop,pause,setMode,setTheme,setRoster,select,deploy,action,save,inspect:()=>({mode,running,paused,elapsed,selected,incoming:incoming(),mine:{...mine},state}),portrait:id=>portraits.get(id)?.canvas.toDataURL(),destroy(){save();cancelAnimationFrame(frame);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',hidden);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',release);canvas.removeEventListener('pointercancel',release);}};
}
