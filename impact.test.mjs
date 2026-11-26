import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { textContent:'', innerHTML:'', value:'', addEventListener(){}, replaceChildren(){}, removeAttribute(){} });
  return elements.get(id);
};
const context = vm.createContext({
  Intl, Date, localStorage:{getItem:()=>null},
  document:{getElementById:element, querySelectorAll:()=>[], querySelector:()=>null, createElement:()=>({})}
});
vm.runInContext(source, context);
const calculate = records => context.cleanImpact(records, '2026-11-26');
const clean = date => ({date, hasLeftovers:false});

test('기록이 없으면 절감량과 연속 일수는 0이다', () => {
  for (const value of Object.values(calculate([]))) assert.equal(value, 0);
});
test('클린 식판만 환산하고 날짜 중복은 중복 적립하지 않는다', () => {
  const result = calculate([clean('2026-11-26'), clean('2026-11-26'), {date:'2026-11-25', hasLeftovers:true}]);
  assert.equal(result.clean, 1);
  assert.equal(result.wasteKg, 0.1);
  assert.equal(result.carbonKg, 0.25);
});
test('날짜순과 무관하게 달력 기준 연속 일수를 계산한다', () => {
  const result = calculate([clean('2026-11-26'), clean('2026-11-24'), clean('2026-11-25')]);
  assert.equal(result.currentStreak, 3);
  assert.equal(result.bestStreak, 3);
  assert.equal(calculate([clean('2026-11-24'), clean('2026-11-25')]).currentStreak, 2);
  const old = calculate([clean('2026-10-31'), clean('2026-11-01')]);
  assert.equal(old.currentStreak, 0);
  assert.equal(old.bestStreak, 2);
});
test('기록 수정 시 요약과 리포트의 수치 및 배지를 다시 계산한다', () => {
  context.renderImpact([clean('2026-11-24'), clean('2026-11-25'), clean('2026-11-26')]);
  assert.match(element('carbon').innerHTML, /^0.75/);
  assert.equal(element('carbon').innerHTML, element('report-carbon').innerHTML);
  assert.match(element('report-points').innerHTML, /^30/);
  assert.match(element('challenge-badges').innerHTML, /3일 연속 달성<br><small>획득 완료/);
  context.renderImpact([{date:'2026-11-26', hasLeftovers:true}]);
  assert.match(element('report-carbon').innerHTML, /^0.00/);
  assert.match(element('report-points').innerHTML, /^0</);
  assert.match(element('challenge-goal').textContent, /첫 클린 식판/);
  assert.equal(element('challenge-summary').innerHTML, element('challenge-badges').innerHTML);
});
