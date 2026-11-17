import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/weeklyReportPresentation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Date, Intl });
const { reportHeadline, reportFocus, reportChange, overallReportChange, reportProtection, createReportFocusGate } = exports;
const available = value => ({ state: 'available', value });
function report(changes = [1, 2, 3], scores = [50, 60, 70]) {
  return { access: 'pro', comparisonAvailable: true,
    pillars: ['Mind', 'Body', 'Bond'].map((name, i) => ({ name, score: available(scores[i]), change: available(changes[i]) })),
    details: { focus: { pillar: 'mind', action: 'mind_breathing', text: 'old saved wording' } } };
}
for (const [changes, title] of [
  [[1,2,3], 'Bond led the way, Dad.'], [[2,2,0], 'Your scores moved forward, Dad.'],
  [[1,-1,0], 'Some scores rose, others dipped, Dad.'], [[0,-1,-2], 'Your scores dipped, Dad. It happens.'],
  [[0,0,0], 'Your scores held steady, Dad.'], [[0.11,0.12,0], 'Body led the way, Dad.'],
  [[0.1,-0.1,0], 'Some scores rose, others dipped, Dad.'],
]) test(`exact changes select headline ${changes}`, () => {
  const saved = report(changes), before = JSON.stringify(saved);
  assert.equal(reportHeadline(saved).title, title);
  assert.equal(reportHeadline({ ...saved, access: 'free' }).title, title);
  assert.equal(JSON.stringify(saved), before);
});
test('unavailable history, model transitions, other incompatibility and missing scores are distinct', () => {
  const saved = { ...report(), comparisonAvailable: false, comparisonReason: 'incomplete_history' };
  assert.equal(reportHeadline(saved).body, 'Building first 7 day trend');
  saved.comparisonReason = 'model_mismatch';
  assert.equal(reportHeadline(saved).title, 'A fresh starting point, Dad.');
  assert.equal(reportHeadline(saved).body, 'Your scores use the updated scoring model this week.');
  saved.comparisonReason = 'observation_mismatch';
  assert.equal(reportHeadline(saved).title, 'Your week is ready, Dad.');
  assert.equal(reportHeadline(saved).body, undefined);
  saved.pillars[0].score = { state: 'missing' };
  assert.equal(reportHeadline(saved).title, 'Your week, Dad.');
});
test('point formatting rounds only display and never substitutes overall changes', () => {
  const saved = report();
  assert.equal(reportChange(saved, available(-3.6)), '↓ 4 pts');
  assert.equal(overallReportChange(saved), null);
  for (const [value, text] of [[5,'Up 5 points on last week'],[-6,'Down 6 points'],[0,'Held steady']]) {
    saved.overallChange = available(value); assert.equal(overallReportChange(saved), text);
  }
  saved.comparisonAvailable = false;
  assert.equal(reportChange(saved, available(9)), '—'); assert.equal(overallReportChange(saved), null);
});
test('focus uses saved weakest pillar, exact changes, tie priority and no Free details', () => {
  for (const [change, text] of [[-0.1,'Mind was your lowest score and fell this week. Choose one manageable session.'],
    [0.1,'Mind improved. Give it a little attention next week.'],[0,'Give Mind a little attention next week.']]) {
    const saved = report([change,5,10]); assert.equal(reportFocus(saved).explanation, text);
    assert.equal(reportFocus({ ...saved, access: 'free' }), null);
  }
  const tied = report([1,2,3], [40,40,80]);
  assert.equal(reportFocus(tied).pillar, 'mind');
  assert.equal(reportFocus(tied).explanation, 'Mind is your focus for next week. Choose one manageable session.');
  tied.details.focus.pillar = 'body'; assert.equal(reportFocus(tied), null);
  const saved = { ...report(), comparisonAvailable: false };
  assert.match(reportFocus(saved).explanation, /Choose one manageable session/);
  for (const [pillar,scores,title] of [['body',[70,20,60],'Ten minutes for your body'],['bond',[70,60,20],'Make time to connect']]) {
    const value=report([0,0,0],scores);value.details.focus.pillar=pillar;
    assert.equal(reportFocus(value).title,title);
  }
});
test('protected weekday comes only from the saved date', () => {
  assert.equal(reportProtection('2026-11-12'), 'Thursday was covered by your weekly streak freeze.');
});
test('focus queue waits for dismissal, consumes once and rejects duplicate/stale account actions', () => {
  const gate=createReportFocusGate('a');
  assert.equal(gate.queue('a','body'),true); assert.equal(gate.queue('a','mind'),false);
  assert.equal(gate.take('a'),'body'); assert.equal(gate.take('a'),null);
  assert.equal(gate.queue('a','bond'),true);assert.equal(gate.take('b'),null);assert.equal(gate.take('a'),null);
  assert.equal(gate.queue('b','mind'),false);
  gate.queue('a','mind');gate.cancel();assert.equal(gate.take('a'),null);assert.equal(gate.queue('a','mind'),false);
});
