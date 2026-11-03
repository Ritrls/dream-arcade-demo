// Pure rules are shared by the Canvas engine, tests, and standalone exports.
export function createMiningRules() {
  const freshMine = () => ({ credits: 0, total: 0, tool: 0, drones: 0, depth: 1, blocks: 0, hp: 10, maxHp: 10, savedAt: 0, workers: [] });
  function restoreMine(value) {
    const s = freshMine();
    if (!value || typeof value !== 'object') return s;
    for (const k of ['credits', 'total', 'tool', 'drones', 'depth', 'blocks', 'hp', 'maxHp', 'savedAt']) if (Number.isFinite(value[k]) && value[k] >= 0) s[k] = value[k];
    s.tool = Math.min(50, Math.floor(s.tool)); s.drones = Math.min(50, Math.floor(s.drones)); s.depth = Math.max(1, Math.min(1000, Math.floor(s.depth)));
    s.credits = Math.min(1e12, s.credits); s.total = Math.min(1e12, s.total); s.blocks = Math.min(4999, Math.floor(s.blocks)); s.depth = 1 + Math.floor(s.blocks / 5);
    s.maxHp = 8 + s.depth * 2; s.hp = Math.max(.01, Math.min(s.maxHp, s.hp));
    s.workers = Array.isArray(value.workers) ? value.workers.slice(0, 12).filter(w => w && typeof w.id === 'string' && Number.isFinite(w.damage) && Number.isFinite(w.interval) && Number.isFinite(w.count)).map(w => ({ id: w.id.slice(0,60), damage: Math.max(5,Math.min(32,w.damage)), interval: Math.max(.65,Math.min(2.2,w.interval)), count: Math.max(0,Math.min(50,Math.floor(w.count))) })) : [];
    return s;
  }
  const cost = (s, kind) => Math.floor((kind === 'tool' ? 20 : 35) * 1.5 ** (kind === 'tool' ? s.tool : s.drones));
  function hit(s, damage) {
    let gained = 0, broken = 0, left = Math.max(0, Math.min(1e6, damage));
    while (left > 0 && broken < 500) {
      const used = Math.min(s.hp, left); s.hp -= used; left -= used;
      if (s.hp <= .00001) { const reward = (5 + s.depth * 2) * ((s.blocks + 1) % 10 === 0 ? 4 : 1); gained += reward; s.credits = Math.min(1e12, s.credits + reward); s.total = Math.min(1e12, s.total + reward); s.blocks = Math.min(4999, s.blocks + 1); broken++; s.depth = 1 + Math.floor(s.blocks / 5); s.maxHp = 8 + s.depth * 2; s.hp = s.maxHp; }
    }
    return { gained, broken };
  }
  function buy(s, kind) {
    if (!['tool', 'drone'].includes(kind)) return false;
    const key = kind === 'tool' ? 'tool' : 'drones'; const price = cost(s, kind);
    if (s.credits < price || s[key] >= 50) return false;
    s.credits -= price; s[key]++; return true;
  }
  const clickPower = s => Math.round(2 * (1 + .75 * s.tool) * 1.25 ** s.tool);
  const autoPower = s => s.drones * (4 + s.tool * .5) * 1.1 ** s.drones + (s.workers || []).reduce((sum,w) => sum + w.damage / w.interval * w.count, 0);
  function offline(s, now) {
    const seconds = s.savedAt > 0 ? Math.max(0, Math.min(7200, (now - s.savedAt) / 1000)) : 0;
    const earned = seconds >= 30 ? Math.floor(autoPower(s) * seconds / s.maxHp * (5 + s.depth * 2)) : 0;
    const gain = Math.max(0, Math.min(1e12 - s.credits, 1e12 - s.total, earned));
    s.credits += gain; s.total += gain; s.savedAt = now; return gain;
  }
  // Each row has only one obstacle, leaving two safe lanes.
  const raceRow = random => { const obstacle = Math.min(2, Math.floor(random() * 3)); return { obstacle, pickup: (obstacle + 1 + Math.min(1, Math.floor(random() * 2))) % 3 }; };
  return { freshMine, restoreMine, cost, hit, buy, clickPower, autoPower, offline, raceRow };
}
