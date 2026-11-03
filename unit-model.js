export function createUnitModel() {
  const roles = ['assault', 'guard', 'sniper', 'worker'], abilities = ['none', 'slow', 'burst', 'shield'];
  const number = (value, fallback, min, max) => { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
  const text = (value, fallback, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
  function balance(input = {}, id = input.id || 'unit') {
    const role = roles.includes(input.role) ? input.role : 'assault';
    const defaults = { assault: [85, 12, 165, .9, 65], guard: [220, 8, 85, 1.4, 35], sniper: [55, 24, 255, 1.6, 40], worker: [65, 9, 100, 1.4, 55] }[role];
    const health = Math.round(number(input.health, defaults[0], 35, 240)), damage = Math.round(number(input.damage, defaults[1], 5, 32));
    const range = Math.round(number(input.range, defaults[2], 80, 260)), interval = Math.round(number(input.interval, defaults[3], .65, 2.2) * 100) / 100, speed = Math.round(number(input.speed, defaults[4], 30, 90));
    const ability = abilities.includes(input.ability) ? input.ability : 'none';
    const cost = Math.round((24 + health * .16 + damage / interval * 2 + range * .055 + (speed - 30) * .13 + (ability === 'none' ? 0 : 10)) / 5) * 5;
    return { id: text(id, 'unit', 60), name: text(input.name, '新生小队员', 12), description: text(input.description, '一位准备出发的新队员。', 80), role, health, damage, range, interval, speed, ability, cost, sprite: input.sprite || null, source: text(input.source, 'preset', 30) };
  }
  function parse(raw) {
    if (typeof raw !== 'string' || raw.length > 15000) throw Error('单位设计结果格式不正确。');
    const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
    if (first < 0 || last <= first) throw Error('AI 未返回可用的单位设计，请继续查询或稍后重试。');
    let data; try { data = JSON.parse(raw.slice(first, last + 1)); } catch { throw Error('单位设计暂时无法解析，请稍后重试。'); }
    if (!data || typeof data !== 'object' || !data.name) throw Error('单位设计缺少名称。');
    return { ...balance(data), spritePrompt: text(data.spritePrompt, `${data.name}, ${data.description}`, 600) };
  }
  function presets(theme = 'forest') {
    const names = theme === 'city' ? ['橙焰突击机', '堡垒装甲卫', '极光狙击机', '掘金小钻头'] : ['豌豆花炮手', '岩甲小龟', '怯怯冰霜菇', '蘑菇矿工'];
    return roles.map((role, i) => balance({ role, name: names[i], ability: ['burst', 'shield', 'slow', 'none'][i], description: ['均衡火力，每第三次攻击触发爆发。', '耐久护盾，承受的伤害减少三成。', '远程冰晶攻击，让敌人短暂减速。', '低成本队员，适合尽早投入矿场。'][i], sprite: { src: `assets/units/${theme === 'city' ? 'city' : 'forest'}-${role}.png` }, ...(theme === 'forest' && role === 'sniper' ? { health:60,damage:12,range:240,interval:1.5,speed:40,source:'AI 生成示范' } : {}) }, 'preset-' + role));
  }
  const label = value => ({ none: '稳定攻击', slow: '冰霜减速', burst: '三击爆发', shield: '护盾减伤', assault: '突击', guard: '守卫', sniper: '远程', worker: '矿工' })[value] || value;
  const miningCost = (unit, count = 0) => Math.ceil(Math.max(30, 20 + unit.damage / unit.interval * 5) * (unit.role === 'worker' ? .8 : 1) * 1.3 ** Math.max(0, Math.min(50, count)));
  return { balance, parse, presets, label, miningCost };
}
