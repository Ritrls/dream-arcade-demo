import { createUnitModel } from './unit-model.js';
import { createMiningRules } from './mining-rules.js';
import { createBattleGame } from './battle.js?v=3.2.2';
const json = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function makePortable(theme, roster, config, mineSave, reserves = []) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>造梦街机 · 我的阵容</title>
<style>body{margin:0;background:#101822;color:#eff8f3;text-align:center;font:14px system-ui}main{max-width:1000px;padding:16px;margin:auto}canvas{width:100%;aspect-ratio:5/3;touch-action:none;border-radius:12px}button{padding:10px 15px;margin:5px;border:1px solid #6c9986;border-radius:7px;background:#243d35;color:#dcffec;cursor:pointer;touch-action:none}button:disabled{opacity:.4}.cards{display:flex;overflow:auto;text-align:left}.cards button{flex:0 0 130px;min-width:0}.cards img{width:55px;height:55px;object-fit:contain;display:block;margin:auto}.cards span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}p{font-size:12px;color:#a8c3d6}#result:empty{display:none}#result{padding:14px;border:1px solid #6c9986;border-radius:8px;background:#1d302d;color:#e6ffed;font-size:16px;line-height:1.7}button:focus-visible{outline:2px solid #d9ffba;outline-offset:2px}</style>
<main><h2 id="title"></h2><canvas id="game" tabindex="0"></canvas><p id="result" role="status"></p><div><button id="start">开始 / 再来一局</button><button id="pause">暂停 / 继续</button><button id="primary"></button><button id="deploy">派出所选单位</button><button id="tool">升级工具</button></div><div class="cards" id="cards" aria-label="你的单位阵容"></div><p id="stats"></p><p id="help"></p><details id="shifts"><summary>矿场班表 · 休息保留人数，复工免费</summary><div id="shifts-list"></div></details><p id="notice" role="status"></p><p>造梦街机 · RunningHub AI 单位工坊</p></main>
<script>
const createUnitModel=${createUnitModel.toString()};
const createMiningRules=${createMiningRules.toString()};
const createBattleGame=${createBattleGame.toString()};
const theme=${json(theme)},roster=${json(roster)},config=${json(config)},reserves=${json(reserves)};
let mineSave=${json(mineSave)};
const $=id=>document.getElementById(id),buttons=new Map(),labels={defense:'庭院守卫',rts:'口袋战场',mine:'增量矿场'};
try{mineSave=JSON.parse(localStorage.getItem('dream-arcade-portable-mine'))||mineSave}catch{}
$('title').textContent=theme.name+' · '+labels[config.mode];
$('help').textContent=config.mode==='defense'?'选择单位，再点草地放置；方向键移动格子，空格放置。':config.mode==='rts'?'派出队员，点击地图指挥；占据点获得更多能量。全军集结后点击地图，可让所有队员推进。':'点击或按住矿石，雇佣队员自动采集。';
$('game').setAttribute('aria-label',labels[config.mode]+'；'+$('help').textContent);
$('primary').textContent=config.mode==='mine'?'按住开采':config.mode==='rts'?'全军集结':'放置所选单位';
$('deploy').hidden=config.mode==='defense';$('tool').hidden=config.mode!=='mine';
let game,crewKey='';$('shifts').hidden=config.mode!=='mine';
game=createBattleGame($('game'),{mode:config.mode,theme,roster,reserves,mineSave,
  onState:s=>{
    $('stats').textContent=Math.floor(s.energy)+' '+(s.mode==='mine'?'资源':'能量')+' · '+(s.mode==='mine'?'第 '+s.mine.depth+' 层 · 自动 '+s.autoPower.toFixed(1)+'/s':s.mode==='rts'?'据点 '+s.captured+'/3 · 对方核心 '+Math.ceil(s.enemyBase??650):'第 '+Math.min(5,s.wave)+'/5 波 · 防线 '+s.home);
    for(const[id,b]of buttons){b.setAttribute('aria-pressed',String(s.selected===id));b.style.borderColor=s.selected===id?'#d9ffba':'#5a7a6a';b.lastChild.textContent=s.costs[id]+' '+(s.mode==='mine'?'资源':'能量')}
    const price=s.costs[s.selected];$('deploy').textContent=(s.mode==='mine'?'雇佣':'派出')+'所选单位 · '+(price??0);
    $('deploy').disabled=!s.running||s.paused||s.energy<price;$('primary').disabled=!s.running||s.paused;
    $('pause').disabled=!s.running;$('pause').textContent=s.paused?'继续':'暂停';
    $('tool').textContent='升级工具 · '+s.toolCost;$('tool').disabled=!s.running||s.paused||s.energy<s.toolCost;
    const key=JSON.stringify(s.mine.workers);if(s.mode==='mine'&&key!==crewKey){crewKey=key;$('shifts-list').replaceChildren();for(const w of s.mine.workers){const row=document.createElement('div'),label=document.createElement('span'),b=document.createElement('button');label.textContent=(w.name||'老队员')+' ×'+w.count+' · '+(w.damage/w.interval*w.count).toFixed(1)+'/s · '+(w.resting?'休息中':'采集中');b.textContent=w.resting?'复工':'休息';b.onclick=()=>game.restWorker(w.id,!w.resting);row.append(label,b);$('shifts-list').append(row)}}
  },
  onSave:s=>{try{localStorage.setItem('dream-arcade-portable-mine',JSON.stringify(s))}catch{}},
  onEnd:r=>{$('result').textContent=(r.win?'胜利！':'再试一次！')+r.detail+' 击退 '+r.kills+' 名 · 用时 '+r.elapsed+' 秒';$('start').textContent='再来一局'},
  onNotice:t=>$('notice').textContent=t
});
for(const u of roster){const b=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span'),cost=document.createElement('b');img.src=u.sprite.src;img.alt='';name.textContent=u.name;b.append(img,name,cost);b.onclick=()=>game.select(u.id);buttons.set(u.id,b);$('cards').append(b)}
game.select(roster[0]?.id);
$('start').onclick=()=>{$('result').textContent='';$('notice').textContent='';game.start(config)};
$('pause').onclick=()=>game.pause();$('deploy').onclick=()=>game.deploy();$('tool').onclick=()=>game.action('tool');
const primary=$('primary');primary.onpointerdown=e=>{e.preventDefault();primary.setPointerCapture(e.pointerId);game.action('primary');if(config.mode==='mine')game.action('hold',true)};
primary.onpointerup=primary.onpointercancel=primary.onlostpointercapture=()=>game.action('hold',false);
primary.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();game.action('primary');if(config.mode==='mine')game.action('hold',true)}};
primary.onkeyup=e=>{if(e.key==='Enter'||e.key===' ')game.action('hold',false)};
window.addEventListener('pagehide',()=>game.save());
<\/script></html>`;
}
