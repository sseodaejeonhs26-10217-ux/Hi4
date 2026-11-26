'use strict';
const KEY = 'clean-tray-v1';
const reasons = ['양이 많음', '입맛에 안 맞음', '시간 부족'];
const $ = id => document.getElementById(id);
const dayKey = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let state = {preferences:{}, records:[], dailyMenus:{}};
const todayMenus = () => state.dailyMenus[dayKey()] || [];
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && Array.isArray(saved.records)) {
    // 이전 무게 기반 기록도 식사 결과로 읽어 기존 기록을 유지해요.
    state.records = saved.records.filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.menu === 'string' && r.menu.length <= 200 && (typeof r.hasLeftovers === 'boolean' || (Number.isInteger(r.grams) && r.grams >= 0 && r.grams <= 2000))).map(r => ({date:r.date, menu:r.menu, hasLeftovers:typeof r.hasLeftovers === 'boolean'?r.hasLeftovers:r.grams>0, reason:r.reason})).filter(r => !r.hasLeftovers || reasons.includes(r.reason));
    state.preferences = saved.preferences && typeof saved.preferences === 'object' ? saved.preferences : {};
    if (saved.dailyMenus && typeof saved.dailyMenus === 'object') {
      for (const [date, menus] of Object.entries(saved.dailyMenus)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(menus) && menus.length <= 20 && menus.every(m => typeof m === 'string' && m.trim() && m.length <= 40)) state.dailyMenus[date] = menus;
      }
    }
  }
} catch { /* A fresh state also works when storage is unavailable. */ }
function persist(next, status) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); state = next; return true; }
  catch { $(status).textContent = '저장 공간을 사용할 수 없어요. 브라우저 저장 설정을 확인해주세요.'; return false; }
}
function recommendation() {
  const recent = state.records.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
  if (!recent.length) return '첫 기록을 남기면 나에게 맞는 배식 팁을 알려드려요.';
  const counts = reasons.map(reason=>recent.filter(r=>r.hasLeftovers && r.reason===reason).length);
  if (Math.max(...counts)===0) return '깨끗하게 비운 식판, 잘했어요! 지금처럼 배고픔에 맞춰 받아보세요.';
  return ['최근에는 양이 많아 남긴 날이 있었어요. 처음에는 조금 받고, 부족하면 더 받아보세요.', '최근 입맛에 맞지 않는 반찬을 남겼어요. 익숙하지 않은 반찬은 소량부터 맛보세요.', '최근 식사 시간이 부족했어요. 식사 시간을 충분히 확보하고 천천히 먹어보세요.'][counts.indexOf(Math.max(...counts))];
}
function bar(label, value, max, suffix, empty=false) {
  return `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar" style="width:${max ? value/max*100 : 0}%"></div></div><span class="bar-value">${empty ? '기록 없음' : value+suffix}</span></div>`;
}
// 앱 내 예시 환산 기준이며 실제 배출량 측정 계수가 아니에요.
const IMPACT_ESTIMATE = { wasteKgPerClean: 0.1, co2eKgPerWasteKg: 2.5 };
function cleanImpact(records, today = dayKey()) {
  const cleanDates = [...new Set(records.filter(r => !r.hasLeftovers).map(r => r.date))].sort();
  const dayNumber = date => Date.parse(date + 'T00:00:00Z') / 86400000;
  let run = 0, bestStreak = 0, previous;
  for (const date of cleanDates) {
    const day = dayNumber(date);
    run = day === previous + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  }
  const latestDay = cleanDates.length ? dayNumber(cleanDates.at(-1)) : -Infinity;
  const gap = dayNumber(today) - latestDay;
  const currentStreak = gap === 0 || gap === 1 ? run : 0;
  const clean = cleanDates.length;
  const wasteKg = clean * IMPACT_ESTIMATE.wasteKgPerClean;
  return { clean, wasteKg, carbonKg: wasteKg * IMPACT_ESTIMATE.co2eKgPerWasteKg, currentStreak, bestStreak };
}
function renderImpact(records) {
  const impact = cleanImpact(records);
  const number = value => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('carbon').innerHTML = `${number(impact.carbonKg)}<small>kg CO2e</small>`;
  $('waste-summary').textContent = `예상 잔반 감소량 ${number(impact.wasteKg)}kg`;
  $('report-carbon').innerHTML = `${number(impact.carbonKg)}<small>kg CO2e</small>`;
  $('report-waste').innerHTML = `${number(impact.wasteKg)}<small>kg</small>`;
  $('report-clean').innerHTML = `${impact.clean}<small>회</small>`;
  $('report-points').innerHTML = `${impact.clean * 10}<small>P</small>`;
  const challenges = [
    { title:'첫 클린 식판', emoji:'✨', value:impact.clean, goal:1, unit:'회' },
    { title:'3일 연속 달성', emoji:'🔥', value:impact.bestStreak, goal:3, unit:'일' },
    { title:'7일 연속 달성', emoji:'🏅', value:impact.bestStreak, goal:7, unit:'일' },
    { title:'누적 10회 달성', emoji:'🌎', value:impact.clean, goal:10, unit:'회' }
  ];
  const badges = challenges.map(c => `<div class="badge ${c.value < c.goal ? 'locked' : ''}"><span>${c.emoji}</span>${c.title}<br><small>${c.value >= c.goal ? '획득 완료' : `${Math.min(c.value,c.goal)} / ${c.goal}${c.unit}`}</small></div>`).join('');
  $('challenge-summary').innerHTML = $('challenge-badges').innerHTML = badges;
  const next = challenges.find(c => c.value < c.goal);
  const goal = next ? `다음 목표: ${next.title} (${Math.min(next.value,next.goal)} / ${next.goal}${next.unit})` : '모든 챌린지 배지를 획득했어요!';
  $('challenge-goal').textContent = $('report-goal').textContent = goal;
  $('streak-summary').textContent = $('report-streak').textContent = `현재 ${impact.currentStreak}일 연속 · 최장 ${impact.bestStreak}일 연속`;
}
function render() {
  const records = state.records;
  const clean = records.filter(r=>!r.hasLeftovers).length;
  $('date').textContent = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  $('count').innerHTML = `${records.length}<small>끼</small>`;
  $('clean').innerHTML = `${clean}<small>회</small>`;
  $('points').innerHTML = `${clean*10}<small>P</small>`;
  renderImpact(records);
  $('recommend').textContent = $('report-tip').textContent = recommendation();
  const days = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const weekdays = days.map((_,i)=>{const rs=records.filter(r=>new Date(r.date+'T12:00:00+09:00').getUTCDay()===i);return {value:rs.filter(r=>!r.hasLeftovers).length,count:rs.length};});
  $('weekday-chart').innerHTML = [1,2,3,4,5,6,0].map(i=>bar(days[i],weekdays[i].value,Math.max(1,...weekdays.map(a=>a.value)),'회',!weekdays[i].count)).join('');
  $('badges').innerHTML = [[1,'🌱','첫걸음'],[3,'🌿','꾸준한 실천'],[7,'🌳','클린 마스터']].map(([n,emoji,title])=>`<div class="badge ${clean<n?'locked':''}"><span>${emoji}</span>${title}<br><small>${clean>=n?'획득 완료':`${clean} / ${n}회`}</small></div>`).join('');
  $('impact').textContent = records.length ? `지금까지 ${records.length}끼를 기록하고, ${clean}번의 식판을 깨끗하게 비웠어요. 작은 실천을 꾸준히 이어가요!` : '첫 클린 식판에 도전해보세요. 작은 습관이 시작돼요.';
  $('history').innerHTML = records.length ? records.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${r.date}</td><td>${r.hasLeftovers?escapeHTML(r.menu):'클린 식판'}</td><td>${r.hasLeftovers?'남겼어요':'다 먹었어요'}</td><td>${r.hasLeftovers?escapeHTML(r.reason):'모두 먹었어요'}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">아직 기록이 없어요. 오늘의 첫 식판을 남겨보세요.</td></tr>';
  const allMenus = [...new Set(records.filter(r=>r.hasLeftovers).map(r=>r.menu))];
  const rows=allMenus.map(menu=>({menu,count:records.filter(r=>r.menu===menu && r.hasLeftovers).length})).sort((a,b)=>b.count-a.count);
  $('menu-stats').innerHTML = rows.length ? rows.map(r=>`<tr><td>${escapeHTML(r.menu)}</td><td>${r.count}회</td></tr>`).join('') : '<tr><td colspan="2" class="empty">남긴 메뉴를 기록하면 통계가 나타나요.</td></tr>';
  const reasonCounts = reasons.map(reason=>records.filter(r=>r.hasLeftovers && r.reason===reason).length);
  $('reason-chart').innerHTML = reasons.map((reason,i)=>bar(reason,reasonCounts[i],Math.max(1,...reasonCounts),'회')).join('');
}
function restoreToday() {
  renderMenus();
  const pref=state.preferences[dayKey()];
  if(pref){document.querySelectorAll('[name=like],[name=portion]').forEach(el=>el.checked=el.value===pref.like || el.value===pref.portion);$('preference-status').textContent='오늘의 선호도가 저장되어 있어요.';}
  const record=state.records.find(r=>r.date===dayKey());
  if(record){document.querySelectorAll('[name=outcome]').forEach(el=>el.checked=el.value===(record.hasLeftovers?'leftovers':'clean'));$('menu').value=record.menu;document.querySelectorAll('[name=reason]').forEach(el=>el.checked=el.value===record.reason);$('record-status').textContent='오늘 기록이 있어요. 수정 후 다시 저장할 수 있어요.';}
  updateOutcome();
}
document.querySelectorAll('.nav').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-current',b===button?'page':'false');});
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==button.dataset.tab);
  window.scrollTo({top:0,behavior:'smooth'});
}));
$('preference-form').addEventListener('submit',event=>{
  event.preventDefault(); const data=new FormData(event.target);
  const next={...state,preferences:{...state.preferences,[dayKey()]:{like:data.get('like'),portion:data.get('portion')}}};
  if(persist(next,'preference-status')) $('preference-status').textContent=`오늘은 ${data.get('portion')} 받기로 했어요. 선호도를 저장했어요!`;
});
function updateOutcome() {
  const hasLeftovers=document.querySelector('[name=outcome]:checked')?.value==='leftovers';
  $('leftover-fields').hidden=!hasLeftovers;
  $('menu').required=hasLeftovers;
  document.querySelectorAll('[name=reason]').forEach(el=>{el.required=hasLeftovers;el.disabled=!hasLeftovers;});
}
document.querySelectorAll('[name=outcome]').forEach(el=>el.addEventListener('change',updateOutcome));
$('record-form').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.target),outcome=data.get('outcome');
  if(!['clean','leftovers'].includes(outcome)){$('record-status').textContent='오늘의 식사 결과를 선택해주세요.';return;}
  const hasLeftovers=outcome==='leftovers',reason=data.get('reason'),menu=$('menu').value.trim();
  if(hasLeftovers&&!menu){$('record-status').textContent='남긴 메뉴를 입력해주세요.';return;}
  if(hasLeftovers&&!reasons.includes(reason)){$('record-status').textContent='남긴 이유를 하나 선택해주세요.';return;}
  const record={date:dayKey(),hasLeftovers,menu:hasLeftovers?menu:'클린 식판',reason:hasLeftovers?reason:'모두 먹었어요'};
  const next={...state,records:[...state.records.filter(r=>r.date!==record.date),record]};
  if(persist(next,'record-status')){render();$('record-status').textContent=hasLeftovers?'오늘의 기록을 저장했어요. 다음 한 끼도 함께해요!':'클린 식판 인증 완료! 오늘의 포인트는 10P예요.';}
});
function renderMenus() {
  const menus = todayMenus();
  $('menu-input').value = menus.join(', ');
  $('menu-list').replaceChildren(...menus.map(menu => {const span=document.createElement('span');span.textContent=menu;return span;}));
  if (!menus.length) $('menu-list').textContent = '오늘 메뉴를 저장하면 여기에 표시돼요.';
  $('menu-options').replaceChildren(...[...new Set([...menus,'여러 메뉴','기타 음식'])].map(menu=>{const option=document.createElement('option');option.value=menu;return option;}));
}
$('menu-form').addEventListener('submit', event => {
  event.preventDefault();
  const menus = [...new Set($('menu-input').value.split(/[,，\n]+/).map(m=>m.trim()).filter(Boolean))];
  if(!menus.length || menus.length>20 || menus.some(m=>m.length>40)){$('menu-status').textContent='메뉴는 1~20개, 이름은 각각 40자 이내로 입력해주세요.';return;}
  if(persist({...state,dailyMenus:{...state.dailyMenus,[dayKey()]:menus}},'menu-status')) {
    renderMenus();
    $('menu-status').textContent='오늘 메뉴를 저장했어요.';
    if(!$('menu').value) $('menu').value=menus[0];
  }
});
let photoURL;
function clearPhoto() {
  if(photoURL) URL.revokeObjectURL(photoURL);
  photoURL=null;$('photo').value='';$('photo-preview').removeAttribute('src');
  $('photo-preview').hidden=true;$('photo-label').hidden=false;$('remove-photo').hidden=true;
}
$('photo').addEventListener('change',()=>{
  const file=$('photo').files[0];if(!file)return;
  clearPhoto();
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){$('record-status').textContent='JPG, PNG 또는 WebP 사진을 선택해주세요.';return;}
  if(file.size>10*1024*1024){$('record-status').textContent='사진은 10MB 이하로 선택해주세요.';return;}
  photoURL=URL.createObjectURL(file);$('photo-preview').src=photoURL;
  $('photo-preview').hidden=false;$('photo-label').hidden=true;$('remove-photo').hidden=false;
  $('record-status').textContent='사진을 첨부했어요. 사진은 미리보기만 제공해요.';
});
$('photo-preview').addEventListener('error',()=>{clearPhoto();$('record-status').textContent='사진을 읽을 수 없어요. 다른 사진을 선택해주세요.';});
$('remove-photo').addEventListener('click',clearPhoto);
$('reset').addEventListener('click',()=>{
  if(!confirm('이 브라우저에 저장된 메뉴, 선호도와 모든 급식 기록을 지울까요?'))return;
  if(persist({preferences:{},records:[],dailyMenus:{}},'record-status')){clearPhoto();$('preference-form').reset();$('record-form').reset();$('preference-status').textContent='';$('menu-status').textContent='';$('record-status').textContent='기록과 저장한 메뉴를 초기화했어요.';render();renderMenus();updateOutcome();}
});
render();restoreToday();
