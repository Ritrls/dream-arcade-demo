// This function is self-contained so exported games run without dependencies or a network.
export function createGame(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const W = 1000, H = 600;
  canvas.width = W; canvas.height = H;
  let theme = { accent: '#a4f7d4', sky: '#112433', name: '月光森林', ...options.theme };
  let background, running = false, paused = false, last = 0, elapsed = 0, score = 0, lives = 3, objects = [], particles = [], spawn = 0;
  let x = W / 2, target = x, duration = options.duration || 30, difficulty = options.difficulty || 'normal', frame;
  const keys = new Set();
  const stars = Array.from({ length: 55 }, (_, i) => ({ x: (i * 137.51) % W, y: (i * 57.19) % (H - 100), size: i % 3 + 1 }));
  let hitCooldown = 0;
  function setTheme(t) {
    theme = { ...theme, ...t }; background = null;
    if (t.image) { const img = new Image(); img.onload = () => { if (theme.image === t.image) background = img; }; img.src = t.image; }
  }
  setTheme(theme);
  const keydown = e => {
    if (!running || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D', 'p', 'P'].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'p' && !e.repeat) pause();
  };
  const keyup = e => keys.delete(e.key.toLowerCase());
  const move = e => { const r = canvas.getBoundingClientRect(); target = (e.clientX - r.left) / r.width * W; };
  const down = e => { canvas.setPointerCapture?.(e.pointerId); move(e); };
  const hidden = () => { keys.clear(); if (running && document.hidden && !paused) pause(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', down);
  document.addEventListener('visibilitychange', hidden);
  function burst(px, py, color) { for (let i = 0; i < 12; i++) particles.push({ x: px, y: py, vx: (Math.random() - .5) * 170, vy: (Math.random() - .6) * 170, life: .5, color }); }
  function star(px, py, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const rr = i % 2 ? r * .35 : r; ctx.lineTo(px + Math.sin(a) * rr, py + Math.cos(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function draw(dt, time) {
    ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
    if (background) {
      const scale = Math.max(W / background.width, H / background.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(background, (W - background.width * scale) / 2, (H - background.height * scale) / 2, background.width * scale, background.height * scale);
      ctx.fillStyle = '#07102055'; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = theme.accent + '20'; ctx.beginPath(); ctx.arc(770, 140, 76, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = theme.accent + '88'; ctx.beginPath(); ctx.arc(770, 140, 58, 0, Math.PI * 2); ctx.fill();
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['#213950', '#162d40', '#0b1c2b'][layer]; ctx.beginPath(); ctx.moveTo(0, H);
        for (let i = 0; i <= 12; i++) ctx.lineTo(i * 90, 355 + layer * 55 - Math.sin(i * 2.4 + layer) * 75);
        ctx.lineTo(W, H); ctx.fill();
      }
    }
    stars.forEach((s, i) => { ctx.globalAlpha = .3 + Math.sin(time / 900 + i) * .2; ctx.fillStyle = '#ecfff5'; ctx.fillRect(s.x, s.y, s.size, s.size); }); ctx.globalAlpha = 1;
    ctx.fillStyle = '#07101b88'; ctx.fillRect(0, H - 60, W, 60);
    ctx.strokeStyle = theme.accent + '44'; ctx.beginPath(); ctx.moveTo(0, H - 60); ctx.lineTo(W, H - 60); ctx.stroke();
    for (const obj of objects) {
      if (obj.type === 'star') { ctx.shadowColor = '#ffe59a'; ctx.shadowBlur = 18; star(obj.x, obj.y, 16, '#ffe6a2'); ctx.shadowBlur = 0; }
      else { ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(obj.y / 90); ctx.fillStyle = '#f58a91'; ctx.fillRect(-13, -13, 26, 26); ctx.fillStyle = '#a54b6e'; ctx.fillRect(-9, -7, 8, 8); ctx.fillRect(3, 2, 7, 7); ctx.restore(); }
    }
    // Pixel spaceship / cat explorer.
    const py = H - 90;
    ctx.globalAlpha = hitCooldown > 0 && Math.floor(time / 90) % 2 ? .35 : 1;
    ctx.fillStyle = theme.accent; ctx.fillRect(x - 24, py + 14, 48, 10); ctx.fillRect(x - 32, py + 7, 64, 9);
    ctx.fillStyle = '#edf9f4'; ctx.fillRect(x - 16, py - 17, 32, 30); ctx.fillRect(x - 16, py - 25, 9, 12); ctx.fillRect(x + 7, py - 25, 9, 12);
    ctx.fillStyle = '#183046'; ctx.fillRect(x - 9, py - 6, 5, 7); ctx.fillRect(x + 4, py - 6, 5, 7);
    ctx.fillStyle = '#ffb3a6'; ctx.fillRect(x - 2, py + 3, 4, 3);
    ctx.fillStyle = '#ffca86'; ctx.fillRect(x - 14, py + 27, 7, 7 + Math.sin(time / 80) * 3); ctx.fillRect(x + 7, py + 27, 7, 7 + Math.cos(time / 80) * 3); ctx.globalAlpha = 1;
    for (const p of particles) { ctx.globalAlpha = p.life * 2; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 5, 5); } ctx.globalAlpha = 1;
    if (running) {
      ctx.fillStyle = '#07101bbf'; ctx.fillRect(24, 20, 952, 48);
      ctx.font = 'bold 21px system-ui'; ctx.fillStyle = '#edf9f4'; ctx.fillText('✦ ' + String(score).padStart(3, '0'), 44, 52);
      ctx.fillStyle = '#f58a91'; ctx.fillText('♥'.repeat(lives), 164, 52);
      ctx.fillStyle = '#edf9f4'; ctx.textAlign = 'right'; ctx.fillText(Math.max(0, Math.ceil(duration - elapsed)) + ' s', 952, 52); ctx.textAlign = 'left';
      if (paused) { ctx.fillStyle = '#08101bd9'; ctx.fillRect(0, 0, W, H); ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText('已暂停 · 点击暂停键或按 P 继续', W / 2, H / 2); ctx.textAlign = 'left'; }
    }
  }
  function tick(time) {
    const dt = Math.min((time - last) / 1000 || 0, .04); last = time;
    if (running && !paused) {
      elapsed += dt; spawn -= dt; hitCooldown = Math.max(0, hitCooldown - dt);
      if (keys.has('arrowleft') || keys.has('a')) target = x - 580 * dt;
      if (keys.has('arrowright') || keys.has('d')) target = x + 580 * dt;
      x += (Math.max(36, Math.min(W - 36, target)) - x) * Math.min(1, dt * 14);
      if (spawn <= 0) { const hard = difficulty === 'hard'; objects.push({ x: 40 + Math.random() * (W - 80), y: -30, type: Math.random() < (hard ? .4 : .26) ? 'rock' : 'star', speed: (hard ? 210 : 150) + Math.random() * 110 + elapsed * 2 }); spawn = hard ? .3 : .43; }
      objects = objects.filter(o => {
        o.y += dt * o.speed;
        if (Math.abs(o.x - x) < 37 && Math.abs(o.y - (H - 90)) < 29) {
          if (o.type === 'star') { score += 10; burst(o.x, o.y, '#ffe6a2'); }
          else if (hitCooldown <= 0) { lives--; hitCooldown = 1; burst(o.x, o.y, '#f58a91'); }
          return false;
        }
        return o.y < H + 30;
      });
      if (lives <= 0 || elapsed >= duration) { running = false; options.onEnd?.({ score, survived: lives > 0, elapsed: Math.floor(elapsed) }); }
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0);
    }
    draw(dt, time); frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  function pause() { if (running) { paused = !paused; keys.clear(); options.onPause?.(paused); } }
  return {
    start(config = {}) { duration = config.duration || duration; difficulty = config.difficulty || difficulty; elapsed = 0; score = 0; lives = 3; spawn = .4; objects = []; particles = []; x = target = W / 2; hitCooldown = 0; running = true; paused = false; canvas.focus(); },
    stop() { running = false; paused = false; objects = []; particles = []; },
    pause, setTheme,
    destroy() { cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down); document.removeEventListener('visibilitychange', hidden); }
  };
}
