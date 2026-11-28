import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const src = read('components/AnalyticsConsentControl.tsx');
// Evaluate only the pure message helper from the component source.
const helper = src.slice(src.indexOf('export function consentMessage'), src.indexOf('/** Consent belongs to this account'));
const js = ts.transpileModule(helper.replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const consentMessage = new Function(`${js}; return consentMessage;`)();

test('a build with analytics switched off reports the saved choice, not a failure', () => {
  assert.equal(consentMessage(true, true, false, false), 'Your choice is saved. Sharing starts when analytics is switched on in a future update.');
});

test('genuine failures still read as failures', () => {
  assert.equal(consentMessage(true, true, false, true), 'We couldn’t turn this on right now. Please try again later.', 'enabled build without a credential');
  assert.equal(consentMessage(true, false, false, true), 'We couldn’t save your analytics choice.', 'save did not stick');
  assert.equal(consentMessage(false, true, true, true), 'We couldn’t save your analytics choice.', 'turning off did not stick');
});

test('success and off states show no message', () => {
  assert.equal(consentMessage(true, true, true, true), '');
  assert.equal(consentMessage(false, false, false, false), '');
});

test('the toggle uses the helper for both the initial read and a change', () => {
  assert.equal((src.match(/consentMessage\(/g) ?? []).length, 3, 'definition + two call sites');
  assert.match(src, /getAnalyticsConsentStatus\(owner \?\? null\)\.then\(\(\{ granted, ready, enabled \}\)/);
  assert.match(src, /const \{ granted: saved, ready, enabled \} = await getAnalyticsConsentStatus/);
});


test('both consent controls keep feedback internal', () => {
  for (const file of [
    'components/AnalyticsConsentControl.tsx',
    'components/BillingAnalyticsConsentControl.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /accessibilityRole="alert"/);
  }
});
