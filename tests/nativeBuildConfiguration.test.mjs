import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const config = require('../app.json').expo;

test('development bypass cannot remove HealthKit or OneSignal from build configuration', () => {
  const oldFlag = process.env.DADHEALTH_DISABLE_ONESIGNAL_EXTENSION;
  const oldProfile = process.env.EAS_BUILD_PROFILE;
  try {
    process.env.DADHEALTH_DISABLE_ONESIGNAL_EXTENSION = '1';
    process.env.EAS_BUILD_PROFILE = 'development';
    const result = configure({ config });
    const plugins = result.plugins.map(plugin => Array.isArray(plugin) ? plugin[0] : plugin);
    assert.ok(plugins.includes('onesignal-expo-plugin'));
    assert.ok(plugins.includes('@kingstinct/react-native-healthkit'));
    const health = result.plugins.find(plugin => plugin[0] === '@kingstinct/react-native-healthkit')[1];
    assert.ok(health.NSHealthShareUsageDescription);
    assert.ok(health.NSHealthUpdateUsageDescription);
    assert.deepEqual(result.ios.entitlements['com.apple.security.application-groups'], ['group.co.uk.dadhealth.onesignal']);
    assert.equal(require('../eas.json').build.development.env?.DADHEALTH_DISABLE_ONESIGNAL_EXTENSION, undefined);
  } finally {
    if (oldFlag === undefined) delete process.env.DADHEALTH_DISABLE_ONESIGNAL_EXTENSION;
    else process.env.DADHEALTH_DISABLE_ONESIGNAL_EXTENSION = oldFlag;
    if (oldProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = oldProfile;
  }
});
