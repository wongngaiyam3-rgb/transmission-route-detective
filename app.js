'use strict';
const STORAGE_KEY='transmission-route-detective-v1';
const ICONS={
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
 book:'<path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2zM12 6v15"/>',
 check:'<path d="m5 12 4 4L20 5"/>',
 sound:'<path d="M4 9v6h4l5 4V5L8 9zM17 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>',
 bulb:'<path d="M8 16c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7zM9 20h6M10 23h4"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 device:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 print:'<path d="M6 8V3h12v5M6 18H3V9h18v9h-3M6 14h12v8H6zM17 11h1"/>',
 wind:'<path d="M3 8h13c5 0 5-6 1-6-3 0-3 2-3 2M3 12h17M3 16h11c4 0 4 6 0 6-3 0-3-2-3-2"/>',
 hand:'<path d="M8 12V4a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 4-2 7-7 7-3 0-5-2-7-5l-3-5c-1-3 2-4 3-2l2 2z"/>',
 drop:'<path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13zM8 15c0 2 1 3 3 3"/>',
 bug:'<path d="M8 10h8v8a4 4 0 0 1-8 0zM9 10V7a3 3 0 0 1 6 0v3M4 10l4 2m8 0 4-2M3 17h5m8 0h5M6 23l3-3m6 0 3 3M9 3 7 1m8 2 2-2"/>'
};
const icon=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.search}</svg>`;
const escapeHTML=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(n)=>String(n+1).padStart(2,'0');
const freshRecord=()=>({passed:[false,false,false],pathogen:null,chain:[null,null,null],route:null,prevention:[],stage:0,hints:[false,false,false],attempts:[0,0,0],completedAt:null});
function freshState(){return {version:1,cases:Object.fromEntries(CASES.map(c=>[c.id,freshRecord()])),challenges:[null,null,null]};}
function normalizeState(raw){
 const result=freshState();if(!raw||raw.version!==1||!raw.cases)return result;
 for(const c of CASES){
  const old=raw.cases[c.id];if(!old||typeof old!=='object')continue;
  const r=result.cases[c.id];r.pathogen=Number.isInteger(old.pathogen)&&old.pathogen>=0&&old.pathogen<c.options.length?old.pathogen:null;
  r.route=Number.isInteger(old.route)&&old.route>=0&&old.route<ROUTES.length?old.route:null;
  const chain=Array.isArray(old.chain)?old.chain:[];const used=new Set();
  r.chain=[0,1,2].map(i=>{const v=chain[i];if(!Number.isInteger(v)||v<0||v>2||used.has(v))return null;used.add(v);return v;});
  r.prevention=Array.isArray(old.prevention)?[...new Set(old.prevention.filter(n=>Number.isInteger(n)&&n>=0&&n<4))].slice(0,2):[];
  r.hints=[0,1,2].map(i=>!!old.hints?.[i]);r.attempts=[0,1,2].map(i=>Number.isFinite(old.attempts?.[i])?Math.max(0,Math.floor(old.attempts[i])):0);
  r.passed[0]=!!old.passed?.[0]&&r.pathogen!==null&&c.options[r.pathogen].text===c.pathogen;
  r.passed[1]=r.passed[0]&&!!old.passed?.[1]&&r.chain.every((v,i)=>v===i)&&r.route===c.route;
  r.passed[2]=r.passed[1]&&!!old.passed?.[2]&&isCorrectPrevention(c,r.prevention);
  const unlocked=r.passed.every(Boolean)?3:r.passed.findIndex(x=>!x);
  r.stage=Number.isInteger(old.stage)?Math.max(0,Math.min(old.stage,unlocked)):unlocked;
  r.completedAt=r.passed[2]&&typeof old.completedAt==='string'?old.completedAt:null;
 }
 result.challenges=[0,1,2].map(i=>typeof raw.challenges?.[i]==='boolean'?raw.challenges[i]:null);return result;
}
function loadState(){try{return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return freshState();}}
function isCorrectPrevention(c,selected){const expected=c.prevention.map((p,i)=>p.ok?i:null).filter(i=>i!==null);return selected.length===expected.length&&expected.every(i=>selected.includes(i));}
function isCorrectChain(c,record){return record.chain.length===3&&record.chain.every((v,i)=>v===i)&&record.route===c.route;}
function putCard(record,value,slot){if(!Number.isInteger(value)||value<0||value>2||!Number.isInteger(slot)||slot<0||slot>2)return;const previous=record.chain.indexOf(value);const replaced=record.chain[slot];if(previous===slot)return;if(previous>=0)record.chain[previous]=replaced;record.chain[slot]=value;}
let state=loadState(),currentCase=null,currentView='home',feedback=null,toastTimer=null,storageWarningShown=false;
const main=document.getElementById('main');
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{if(!storageWarningShown){storageWarningShown=true;toast('這個瀏覽器暫時無法保存進度。離開前可下載學習紀錄。');}}updateNav();}
const completed=()=>CASES.filter(c=>state.cases[c.id].passed[2]).length;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4500);}
function updateNav(){document.getElementById('nav-count').textContent=`${completed()}/5`;document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===currentView));}
function renderHome(){
 currentView='home';currentCase=null;
 const next=CASES.find(c=>!state.cases[c.id].passed[2])||CASES[0],total=completed();
 main.innerHTML=`<div class="home-wrap slide-in"><section class="hero"><div class="hero-copy"><span class="eyebrow">小四科學 · 生活中的健康探究</span><h1>病原體，<br>你走哪條<span class="accent">路</span>？</h1><p class="intro">一聲咳嗽、一輛玩具車、一杯水……<br>跟著五個生活情境，找出看不見的傳播路線，<br>一起想辦法保護自己和別人。</p><div class="hero-actions"><a class="button" href="#case/${next.id}">${total?'繼續我的探索':'開始第一個任務'}<span class="arrow-icon" aria-hidden="true">↗</span></a><a class="text-link" href="#missions">看看五個情境 <span aria-hidden="true">↓</span></a></div><div class="hero-meta"><span>${icon('time')}約30分鐘</span><span>${icon('device')}電腦・平板適用</span><span>${icon('book')}自由選擇任務</span></div></div><div class="hero-art" aria-label="等候室內的咳嗽情境"><span class="tape" aria-hidden="true"></span><div class="stamp" aria-hidden="true"><span>生活情境</span><b>05</b><span>等你調查</span></div><div class="hero-photo-frame"><img src="assets/droplet.webp" alt="男子咳嗽，女孩在附近，飛沫中的病毒以放大圖示意。" width="1440" height="1080" fetchpriority="high"><div class="photo-caption"><span>觀察筆記 No. 01</span><span>先看見，再發現。</span></div></div><div class="hero-note">它是病原體，還是運送病原體的東西？<small>帶著問題，從圖片開始找線索。</small></div></div></section><div class="mission-strip" aria-label="三步探究流程"><div class="strip-step"><span class="strip-num">01</span><div><strong>找出病原體</strong><small>甚麼令人生病？</small></div></div><div class="strip-step"><span class="strip-num">02</span><div><strong>追蹤傳播路線</strong><small>它怎樣到達人體？</small></div></div><div class="strip-step"><span class="strip-num">03</span><div><strong>想方法截斷</strong><small>我們可以在哪一步幫忙？</small></div></div></div><section id="missions"><div class="section-heading"><div><h2>今天，調查哪個情境？</h2><p>五個任務都能直接進入，選一個開始觀察。</p></div><div class="overall-progress"><span>已完成 ${total} / 5 個任務</span><div class="progress-track" role="progressbar" aria-label="任務完成進度" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${total}"><i style="width:${total*20}%"></i></div></div></div><div class="case-grid">${CASES.map((c,i)=>caseCard(c,i)).join('')}</div></section><aside class="observation-banner">${icon('search')}<p><strong>有放大圖，不代表肉眼看得見。</strong>圖中的病原體經過放大及簡化。看不見污漬，也不代表一定沒有病原體。</p></aside></div>`;
 updateNav();
}
function caseCard(c,i){const r=state.cases[c.id],done=r.passed[2],n=r.passed.filter(Boolean).length;return `<a class="case-card" href="#case/${c.id}" style="--case-color:${c.color}"><div class="card-picture"><img src="assets/${c.image}" alt="${c.alt}" loading="lazy" width="1440" height="1080"><span class="case-number"><i></i>情境 ${number(i)}</span>${done?'<span class="complete-mark">✓ 已完成</span>':''}</div><div class="card-body"><h3>${c.title}</h3><p>${c.observe}</p><div class="card-bottom"><span>${done?`發現：${ROUTES[c.route]}`:n?`繼續調查 · 已完成${n}/3步`:`${c.place} · 3步探索`}</span><span class="circle-arrow" aria-hidden="true">↗</span></div></div></a>`;}
function renderCase(id){
 const c=CASES.find(c=>c.id===id);if(!c){location.hash='home';return;}
 currentCase=c;currentView='case';feedback=null;const i=CASES.indexOf(c);
 main.innerHTML=`<div class="case-wrap slide-in"><div class="case-topbar"><div class="case-breadcrumb"><a href="#home">← 任務地圖</a><span>/</span><span>情境 ${number(i)}</span></div><span class="case-count">五個情境 · ${completed()} 個已完成</span></div><div class="case-layout"><section class="scene-column" aria-label="觀察情境"><div class="scene-title"><span class="case-tag" style="background:${c.color}55">${number(i)}</span><div><span class="eyebrow">${c.place} · 觀察筆記</span><h1>${c.title}</h1></div></div><div class="scene-image"><img src="assets/${c.image}" alt="${c.alt}" width="1440" height="1080"><button class="zoom-button" data-action="zoom">${icon('search')}放大觀察</button></div><div class="scene-story"><div class="story-heading"><span>情境線索</span><button class="speak-button" data-action="speak">${icon('sound')}朗讀情境</button></div><p>${c.story}</p>${c.notice?`<p class="notice">${c.notice}</p>`:''}</div><p class="scene-note">圖中放大、簡化了病原體，並非實際大小。接觸病原體不代表一定受感染。</p></section><section class="workbook" id="workbook" aria-label="互動探究任務"><div id="workbook-body"></div></section></div></div>`;
 renderWorkbook();updateNav();
}
function tabs(r){return `<nav class="stage-tabs" aria-label="探究步驟">${['找病原體','排出路線','截斷傳播'].map((label,i)=>`<button class="stage-tab ${r.stage===i?'current':''} ${r.passed[i]?'passed':''}" data-action="stage" data-value="${i}" ${i>0&&!r.passed[i-1]?'disabled':''} ${r.stage===i?'aria-current="step"':''}><span>${r.passed[i]?'✓':number(i)}</span>${label}</button>`).join('')}</nav>`;}
function renderWorkbook(focusId){
 const c=currentCase;if(!c)return;const r=state.cases[c.id];let body='';
 if(r.stage===3)body=completionView(c,r);else{
  const passed=r.passed[r.stage];
  if(r.stage===0)body=`<div class="task-kicker">STEP 01　找出真正致病的東西</div><h2 class="task-title" id="task-heading" tabindex="-1">病原體是甚麼？</h2><p class="task-desc">讀讀左邊的情境。哪一項是引起疾病的病原體？</p><div class="option-list" role="group" aria-label="選擇病原體">${c.options.map((p,i)=>choice(p.text,i,r.pathogen===i,passed,'pathogen')).join('')}</div>`;
  else if(r.stage===1)body=`<div class="task-kicker">STEP 02　它怎樣到達人體？</div><h2 class="task-title" id="task-heading" tabindex="-1">排出病原體的路線。</h2><p class="task-desc">先依次點選下面三張卡，再選擇這一次的傳播途徑。</p><div class="sort-instruction"><span>① 先排好三張卡</span>${!passed?'<button class="reset-order" data-action="clear-chain">重新排列</button>':''}</div><div class="chain" role="group" aria-label="傳播過程三個步驟">${r.chain.map((value,i)=>`<button id="slot-${i}" class="chain-slot ${value!==null?'filled':''}" data-action="remove-card" data-slot="${i}" ${passed?'disabled':''} ${value!==null&&!passed?'draggable="true"':''} ${value!==null?`data-index="${value}"`:''} aria-label="第${i+1}步：${value===null?'尚未放入卡片':c.chain[value]+(passed?'':'，點選可取回')}"><span class="slot-number">第${i+1}步</span>${value===null?'放入卡片':c.chain[value]}${value!==null&&!passed?'<span class="remove-label" aria-hidden="true">×</span>':''}</button>`).join('')}</div>${!passed?`<div class="card-pool" role="group" aria-label="待排列卡片">${[2,0,1].filter(i=>!r.chain.includes(i)).map(i=>`<button class="word-card" id="word-${i}" draggable="true" data-index="${i}" data-action="add-card" data-value="${i}"><span class="grip" aria-hidden="true">⠿</span>${c.chain[i]}</button>`).join('')||'<span class="sort-note">卡片都放好了。想修改時，點選上方卡片取回。</span>'}</div>`:''}<span class="subtask-label">② 這一次屬於哪種傳播途徑？</span><div class="route-choices" role="group" aria-label="選擇傳播途徑">${ROUTES.map((name,i)=>`<button id="route-${i}" class="route-choice ${r.route===i?'selected':''}" data-action="route" data-value="${i}" aria-pressed="${r.route===i}" ${passed?'disabled':''}>${name}</button>`).join('')}</div><p class="sort-note">點選已放入的卡片可以取回，也可以拖放卡片。只判斷這個情境；同一疾病可能有不同傳播途徑。</p>`;
  else body=`<div class="task-kicker">STEP 03　把方法用在合適的路線上</div><h2 class="task-title" id="task-heading" tabindex="-1">在哪一步，截斷傳播？</h2><p class="task-desc">選出兩項針對這個情境的預防方法。想一想：它們在哪一步有幫助？</p><div class="option-list" role="group" aria-label="選出兩項預防方法">${c.prevention.map((p,i)=>choice(p.text,i,r.prevention.includes(i),passed,'prevention',true)).join('')}</div><p class="count-note">已選擇 ${r.prevention.length} / 2 項</p>`;
  const fb=feedback||(passed?successFeedback(c,r.stage):null);
  body+=feedbackMarkup(fb);
  if(r.hints[r.stage])body+=`<p class="hint-text" id="hint-content">${stageHint(c,r.stage)}</p>`;
  const canCheck=r.stage===0?r.pathogen!==null:r.stage===1?r.chain.every(v=>v!==null)&&r.route!==null:r.prevention.length===2;
  body+=`<div class="task-actions"><button id="hint-button" class="hint-button" data-action="hint" aria-expanded="${r.hints[r.stage]}" aria-controls="hint-content">${icon('bulb')}${r.hints[r.stage]?'收起提示':'給我一點提示'}</button>${passed?`<button class="button" data-action="next">${r.stage===2?'整理我的發現':'前往下一步'}<span aria-hidden="true">→</span></button>`:`<button class="button" data-action="check" ${!canCheck?'disabled':''}>檢查我的想法 <span aria-hidden="true">↗</span></button>`}</div>`;
 }
 document.getElementById('workbook-body').innerHTML=tabs(r)+`<div class="task-body">${body}</div>`;
 if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
}
function choice(text,i,selected,passed,action,multi=false){return `<button id="${action}-${i}" class="choice ${selected?'selected':''} ${multi?'multi':''} ${selected&&passed?'correct':''}" data-action="${action}" data-value="${i}" aria-pressed="${selected}" ${passed?'disabled':''}><span class="choice-dot" aria-hidden="true">${multi?(selected?'✓':''):selected?'●':String.fromCharCode(65+i)}</span><span class="choice-label">${text}</span>${selected&&passed?'<span class="choice-state" aria-label="答對">✓</span>':''}</button>`;}
function stageHint(c,stage){return stage===0?c.hint:stage===1?`先放「${c.chain[0]}」。再想病原體怎樣向人體前進，途徑名稱要和過程相符。`:'把每項方法放回你剛排列的路線：它有沒有處理這條路線中的物件、入口或接觸過程？';}
function feedbackMarkup(fb){if(!fb)return '';return `<div id="feedback" tabindex="-1" class="feedback ${fb.ok?'success':''}" role="status"><div class="feedback-heading">${fb.ok?'✓':'↻'} ${fb.title}</div><p>${fb.text}</p>${fb.list?`<ul>${fb.list.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}</div>`;}
function successFeedback(c,stage){if(stage===0)return {ok:true,title:'找到真正的病原體了！',text:c.options.find(x=>x.text===c.pathogen).why};if(stage===1)return {ok:true,title:'路線與名稱，都找到了。',text:c.routeWhy};return {ok:true,title:'兩個方法，成功配對！',text:'它們針對這次的傳播過程：',list:c.prevention.filter(p=>p.ok).map(p=>`<b>${p.text}</b>：${p.why}`)};}
function checkAnswer(){
 const c=currentCase;if(!c)return;const r=state.cases[c.id],s=r.stage;if(s>2||r.passed[s])return;
 if(s===0&&r.pathogen===null||s===1&&(r.chain.includes(null)||r.route===null)||s===2&&r.prevention.length!==2)return;
 r.attempts[s]++;
 let correct=false;
 if(s===0){correct=c.options[r.pathogen].text===c.pathogen;feedback=correct?successFeedback(c,s):{ok:false,title:'再分清楚「病原體」與「載體」。',text:c.options[r.pathogen].why};}
 if(s===1){correct=isCorrectChain(c,r);feedback=correct?successFeedback(c,s):{ok:false,title:r.chain.every((v,i)=>v===i)?'順序找到了，再看看途徑名稱。':'先回到圖片，追蹤每一步。',text:r.chain.every((v,i)=>v===i)?'你選的名稱需要和剛才排列的傳播過程相符。哪一種途徑描述了這個過程？':'病原體先在哪裡？接著經過甚麼？最後怎樣到達人體？點選已放入的卡片即可修改。'};}
 if(s===2){correct=isCorrectPrevention(c,r.prevention);feedback=correct?successFeedback(c,s):{ok:false,title:'有些方法沒有截斷這一條路線。',text:'保留有幫助的方法，點選不合適的一項取消，再選一次。',list:r.prevention.filter(i=>!c.prevention[i].ok).map(i=>`<b>${c.prevention[i].text}</b>：${c.prevention[i].why}`)};}
 if(correct){r.passed[s]=true;if(s===2&&!r.completedAt)r.completedAt=new Date().toISOString();}
 save();renderWorkbook('feedback');document.querySelector('.feedback')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function completionView(c,r){const i=CASES.indexOf(c),next=CASES.find((other,n)=>n>i&&!state.cases[other.id].passed[2])||CASES.find(other=>!state.cases[other.id].passed[2]);return `<div class="case-success"><div class="success-seal">${icon('check')}</div><span class="task-kicker">情境 ${number(i)}　調查完成</span><h2 id="task-heading" tabindex="-1">把你的發現，<br>說給同伴聽。</h2><span class="route-badge">${ROUTES[c.route]}</span><div class="discovery-definition"><p>病原體是 <b>${c.pathogen}</b>。</p><p>這次的傳播路線是：</p><div class="mini-chain">${miniChain(c)}</div></div><p class="finding">${c.takeaway}</p><p class="finding"><b>換你解釋：</b>「我可以用＿＿＿＿，在＿＿＿＿這一步減少傳播。」</p><div class="success-actions">${next?`<a class="button" href="#case/${next.id}">調查下一個情境 <span aria-hidden="true">→</span></a>`:'<a class="button" href="#discoveries">查看全部發現 <span aria-hidden="true">↗</span></a>'}<a class="button secondary" href="#home">返回任務地圖</a></div><button class="revisit-link" data-action="stage" data-value="0">再看一次我的作答</button></div>`;}
function miniChain(c){return c.chain.map((x,i)=>`${i?'<b aria-hidden="true">→</b>':''}<span>${x}</span>`).join('');}
function renderDiscoveries(){
 currentView='discoveries';currentCase=null;const total=completed();
 main.innerHTML=`<div class="discoveries-wrap slide-in"><div class="discoveries-top"><div><span class="eyebrow">我的科學觀察筆記</span><h1>把路線，變成發現。</h1><p>看看自己找到了哪些病原體與傳播路線。</p></div><div class="export-buttons"><button class="button secondary small" data-action="download">${icon('download')}下載紀錄</button><button class="button small" data-action="print">${icon('print')}列印紀錄</button></div></div><div class="print-heading">姓名：________________　班別：________　日期：________________</div><div class="record-overview"><div class="record-total"><strong>${total}</strong><span>/ 5</span></div><div><h2>${total===5?'五條路線，都留下你的發現。':total?'你已經開始看見傳播的過程。':'第一條路線，等你來發現。'}</h2><p>${total===5?'接著試試下面的說法，看看你能否解釋。':'不需要一次完成，這個瀏覽器會保留你的探索進度。'}</p></div></div><section class="record-list" aria-label="五個情境的學習紀錄">${CASES.map((c,i)=>recordCard(c,i)).join('')}</section><section class="challenge-section"><h2>換個說法，你也能解釋嗎？</h2><p>選擇你是否同意，再看看這句話與哪條路線有關。</p><div class="challenge-grid">${CHALLENGES.map((q,i)=>challengeCard(q,i)).join('')}</div></section><div class="reset-row"><span>進度保存在目前的瀏覽器，換裝置不會自動同步。</span><button data-action="ask-reset">清除紀錄，重新探索</button></div></div>`;
 updateNav();
}
function recordCard(c,i){const r=state.cases[c.id],done=r.passed[2],n=r.passed.filter(Boolean).length;return `<article class="record-card"><img src="assets/${c.image}" alt="${c.alt}" loading="lazy" width="1440" height="1080"><div><span class="eyebrow">情境 ${number(i)}　${done?'✓ 已完成':`${n}/3步`}</span><h3>${c.title}</h3>${done?`<p>病原體：${c.pathogen}　／　${ROUTES[c.route]}</p><div class="mini-chain">${miniChain(c)}</div><p style="margin-top:9px">我會：${c.prevention.filter(x=>x.ok).map(x=>x.text).join('、')}。</p>`:`<p class="record-status">${n?'已完成的步驟會保留，可以繼續探索。':'尚未開始。先看圖，再找出病原體。'}</p>`}</div><a class="button secondary small" href="#case/${c.id}">${done?'重溫發現':'繼續調查'} ↗</a></article>`;}
function challengeCard(q,i){const selected=state.challenges[i],has=selected!==null,ok=selected===q.answer;return `<article class="challenge-card" id="challenge-${i}"><span class="question-no">再想一想 ${number(i)}</span><h3>${q.q}</h3><div class="challenge-actions" role="group" aria-label="是否同意第${i+1}句說法">${[true,false].map(v=>`<button data-action="challenge" data-index="${i}" data-value="${v}" aria-pressed="${selected===v}" class="${selected===v?'selected':''}">${v?'同意':'不同意'}</button>`).join('')}</div>${has?`<p class="challenge-result ${ok?'':'wrong'}" role="status"><b>${ok?'想得有道理。':'再想想路線。'}</b> ${q.why}</p>`:''}</article>`;}
function downloadRecord(){
 const lines=['傳播路線偵探｜我的學習紀錄',`記錄時間：${new Date().toLocaleString('zh-HK')}`,`已完成：${completed()} / 5`, ''];
 CASES.forEach((c,i)=>{const r=state.cases[c.id];lines.push(`情境${number(i)} ${c.title}`,`進度：${r.passed[2]?'完成':r.passed.filter(Boolean).length+'/3步'}`);if(r.passed[2])lines.push(`病原體：${c.pathogen}`,`傳播路線：${c.chain.join(' → ')}`,`途徑：${ROUTES[c.route]}`,`預防：${c.prevention.filter(x=>x.ok).map(x=>x.text).join('；')}`,`我的發現：${c.takeaway}`);lines.push('');});
 lines.push('換個說法再想一想：');CHALLENGES.forEach((q,i)=>{const a=state.challenges[i];lines.push(q.q,`我的選擇：${a===null?'未作答':a?'同意':'不同意'}${a===null?'':a===q.answer?'（理解正確）':'（需要再想想）'}`);});
 const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='傳播路線偵探_學習紀錄.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('學習紀錄已下載。');
}
function openGuide(){document.getElementById('teacher-answers').innerHTML=CASES.map((c,i)=>`<div class="teacher-answer"><strong>${number(i)} ${c.title}</strong>病原體：${c.pathogen}<br>路線：${c.chain.join(' → ')}<br>途徑：${ROUTES[c.route]}<br>預防：${c.prevention.filter(p=>p.ok).map(p=>p.text).join('；')}</div>`).join('');document.getElementById('guide-dialog').showModal();}
function handleAction(target){
 const action=target.dataset.action,n=Number(target.dataset.value),c=currentCase,r=c?state.cases[c.id]:null;
 if(action==='guide'){openGuide();return;}if(action==='close-guide'){document.getElementById('guide-dialog').close();return;}
 if(action==='close-image'){document.getElementById('image-dialog').close();return;}
 if(action==='zoom'&&c){const img=document.getElementById('large-image');img.src='assets/'+c.image;img.alt=c.alt;document.getElementById('image-dialog').showModal();return;}
 if(action==='speak'&&c){if(!('speechSynthesis'in window)){toast('這個瀏覽器暫不支援朗讀，可直接閱讀情境線索。');return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(c.story);u.lang='zh-HK';u.rate=.82;const voice=window.speechSynthesis.getVoices().find(v=>/zh[-_]HK|yue/i.test(v.lang));if(voice)u.voice=voice;u.onerror=()=>toast('朗讀暫時未能播放，可直接閱讀情境線索。');window.speechSynthesis.speak(u);return;}
 if(action==='download'){downloadRecord();return;}if(action==='print'){window.print();return;}
 if(action==='ask-reset'){document.getElementById('reset-dialog').showModal();return;}
 if(action==='cancel-reset'){document.getElementById('reset-dialog').close();return;}
 if(action==='confirm-reset'){state=freshState();feedback=null;save();document.getElementById('reset-dialog').close();if(location.hash==='#home')renderHome();else location.hash='home';toast('已清除紀錄，可以重新探索。');return;}
 if(action==='challenge'){const i=Number(target.dataset.index);if(i<0||i>=CHALLENGES.length)return;state.challenges[i]=target.dataset.value==='true';save();const card=document.getElementById('challenge-'+i);card.outerHTML=challengeCard(CHALLENGES[i],i);return;}
 if(!r)return;
 if(action==='stage'){if(!Number.isInteger(n)||n<0||n>2||n>0&&!r.passed[n-1])return;r.stage=n;feedback=null;save();renderWorkbook('task-heading');document.getElementById('workbook').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(action==='next'){if(r.stage>2||!r.passed[r.stage])return;r.stage++;feedback=null;save();renderWorkbook('task-heading');document.getElementById('workbook').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(action==='check'){checkAnswer();return;}
 if(action==='hint'){if(r.stage>2)return;r.hints[r.stage]=!r.hints[r.stage];save();renderWorkbook('hint-button');return;}
 if(r.stage>2||r.passed[r.stage])return;
 feedback=null;
 if(action==='pathogen'&&r.stage===0){r.pathogen=n;save();renderWorkbook('pathogen-'+n);}
 if(action==='route'&&r.stage===1){r.route=n;save();renderWorkbook('route-'+n);}
 if(action==='add-card'&&r.stage===1&&!r.chain.includes(n)){const slot=r.chain.indexOf(null);if(slot>=0)putCard(r,n,slot);save();renderWorkbook('slot-'+slot);}
 if(action==='remove-card'&&r.stage===1){const slot=Number(target.dataset.slot);if(slot>=0&&slot<3){const previous=r.chain[slot];r.chain[slot]=null;save();renderWorkbook('word-'+previous);}}
 if(action==='clear-chain'&&r.stage===1){r.chain=[null,null,null];save();renderWorkbook('slot-0');}
 if(action==='prevention'&&r.stage===2){const i=r.prevention.indexOf(n);if(i>=0)r.prevention.splice(i,1);else if(r.prevention.length<2)r.prevention.push(n);else{toast('這次選兩項。先點選其中一項取消，再換另一項。');return;}save();renderWorkbook('prevention-'+n);}
}
document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(target&&!target.disabled)handleAction(target);});
document.addEventListener('dragstart',event=>{const target=event.target.closest('[draggable="true"]');if(!target||!event.dataTransfer)return;event.dataTransfer.setData('text/plain',target.dataset.index);event.dataTransfer.effectAllowed='move';});
document.addEventListener('dragover',event=>{if(event.target.closest('.chain-slot')&&currentCase&&!state.cases[currentCase.id].passed[1]){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',event=>{const target=event.target.closest('.chain-slot');if(!target||!currentCase)return;event.preventDefault();const r=state.cases[currentCase.id];if(r.stage!==1||r.passed[1])return;const text=event.dataTransfer?.getData('text/plain');if(!/^[012]$/.test(text||''))return;putCard(r,Number(text),Number(target.dataset.slot));feedback=null;save();renderWorkbook();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',event=>{if(event.target===d){const box=d.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)d.close();}}));
function route(){
 if('speechSynthesis'in window)window.speechSynthesis.cancel();
 const hash=location.hash||'#home';
 if(hash==='#main'){main.focus({preventScroll:true});return;}
 if(hash==='#missions'){if(currentView!=='home')renderHome();requestAnimationFrame(()=>document.getElementById('missions')?.scrollIntoView({behavior:'smooth'}));return;}
 if(hash.startsWith('#case/'))renderCase(hash.slice(6));else if(hash==='#discoveries')renderDiscoveries();else renderHome();
 window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
route();
