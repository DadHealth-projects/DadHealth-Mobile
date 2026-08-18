import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const biometricSource = readFileSync(new URL('../lib/biometric.ts', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const startIndex = biometricSource.indexOf(start);
  const endIndex = biometricSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing ${start}`);
  assert.notEqual(endIndex, -1, `Missing ${end}`);
  return biometricSource.slice(startIndex, endIndex);
}

test('enrollment stores the device credential without invoking Face ID', () => {
  const enrollment = sourceBetween(
    'export async function enrollBiometricCredential',
    'export async function clearBiometricCredentials',
  );

  assert.doesNotMatch(enrollment, /authenticateAsync/);
  assert.match(enrollment, /SecureStore\.setItemAsync\(CREDENTIAL_KEY, credential, secureStoreOptions\)/);
});

test('Face ID is invoked by biometric login before the credential exchange', () => {
  const login = sourceBetween(
    'async function performBiometricLogin',
    'export async function biometricLogin',
  );

  const authenticationIndex = login.indexOf('LocalAuthentication.authenticateAsync');
  const credentialReadIndex = login.indexOf('SecureStore.getItemAsync(CREDENTIAL_KEY');
  const exchangeIndex = login.indexOf('/api/auth/biometric/exchange');

  assert.notEqual(authenticationIndex, -1);
  assert.ok(authenticationIndex < credentialReadIndex);
  assert.ok(credentialReadIndex < exchangeIndex);
});

test('the new credential does not reuse the biometric-gated v3 Keychain item', () => {
  assert.match(biometricSource, /dadhealth\.biometric\.device\.v4\.credential/);
  assert.doesNotMatch(biometricSource, /dadhealth\.biometric\.device\.v3\.credential/);
  assert.doesNotMatch(biometricSource, /requireAuthentication:\s*true/);
});

test('the only Face ID challenge is in the biometric login function', () => {
  const authenticationCalls = biometricSource.match(/LocalAuthentication\.authenticateAsync/g) ?? [];
  assert.equal(authenticationCalls.length, 1);

  const login = sourceBetween(
    'async function performBiometricLogin',
    'export async function biometricLogin',
  );
  assert.match(login, /LocalAuthentication\.authenticateAsync/);
});
